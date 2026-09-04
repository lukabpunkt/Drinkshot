/**
 * Speicher-Messung des Titel-Loops (Audit A5: „Titel-Loop laeuft ohne Speicherleck").
 *
 * Der Loop laeuft auf dem Titelbild endlos. Genau dort steht ein Handy, wenn die Runde
 * pausiert — oft minutenlang. Ein Leck faellt hier zuerst auf und ist genau hier am
 * unangenehmsten, weil der Browser die Seite dann still verwirft.
 *
 * Gemessen wird der Heap **nach erzwungener GC**: Ohne die sieht man nur den Saegezahn
 * des Allokators, nicht das eigentliche Wachstum.
 *
 * Aufruf: `node scripts/measure-title-heap.mjs [URL] [Minuten]`
 */

import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:4173/Drinkshot/';
const minutes = Number(process.argv[3] ?? 10);

const browser = await chromium.launch({
  args: ['--js-flags=--expose-gc', '--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(() => window.localStorage.setItem('drinkshot.disclaimer.v1', '1'));
await page.goto(url);
await page.waitForSelector('.titleLoop__figure');

const client = await page.context().newCDPSession(page);
const heap = async () => {
  await client.send('HeapProfiler.collectGarbage');
  const { result } = await client.send('Runtime.evaluate', {
    expression: 'performance.memory.usedJSHeapSize',
  });
  return Number(result.value);
};
const kb = (bytes) => (bytes / 1024).toFixed(0);

// Erst einschwingen lassen — die ersten Sekunden gehoeren dem Aufbau, nicht dem Loop.
await page.waitForTimeout(20_000);
const start = await heap();
console.log(`Start ${kb(start)} KB · ${minutes} Minuten Titelbild\n`);

let last = start;
for (let minute = 1; minute <= minutes; minute++) {
  await page.waitForTimeout(60_000);
  last = await heap();
  console.log(`min ${String(minute).padStart(2)}  ${kb(last)} KB  (${last >= start ? '+' : ''}${kb(last - start)} KB seit Start)`);
}

const nodes = await page.evaluate(() => document.getElementsByTagName('*').length);
const animations = await page.evaluate(() => document.getAnimations().length);
const timers = await page.evaluate(() => (window.performance.getEntriesByType('resource') ?? []).length);

console.log(`\nStart ${kb(start)} KB → Ende ${kb(last)} KB · Delta ${kb(last - start)} KB`);
console.log(`DOM-Knoten ${nodes} · laufende Animationen ${animations} · geladene Ressourcen ${timers}`);

/* Der Loop hat keine Timer und keine Frame-Schleife: Was hier waechst, waere ein Fehler. */
const LIMIT_KB = 512;
if ((last - start) / 1024 > LIMIT_KB) {
  console.error(`\nFEHLER: Heap waechst um mehr als ${LIMIT_KB} KB.`);
  process.exit(1);
}
console.log(`\nBESTANDEN: Wachstum unter ${LIMIT_KB} KB.`);
await browser.close();
