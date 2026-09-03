/**
 * Performance-Test der Arena (docs/03-ARCHITECTURE.md §12, Audit A2/A3).
 *
 * Fährt die Arena mit 8 Shotlings hoch, drosselt die CPU per CDP und sammelt 10 s lang
 * Frame-Zeiten über `requestAnimationFrame`. Fällt fehl bei:
 *   p50 > 20 ms · p95 > 40 ms · mehr als 2 Long-Tasks > 50 ms
 *
 * Läuft nur unter Chromium — `Emulation.setCPUThrottlingRate` gibt es in WebKit nicht.
 */

import { expect, test, type Page } from '@playwright/test';

const PLAYERS = 8;
const SAMPLE_MS = 10_000;
const CPU_THROTTLE = 4;

const BUDGET = { p50: 20, p95: 40, longTasks: 2, updateP95: 4 } as const;

/**
 * Headless-Chromium rendert ohne GPU per SwiftShader in Software. Die Arena läuft dann
 * mit 30 statt 60 fps — das misst den Testrechner, nicht das Spiel. Die Frame-Zeit-Tests
 * überspringen diesen Fall mit klarer Ansage; die JS-Zeit wird trotzdem gemessen, denn
 * die hängt nicht am Renderer.
 */
async function rendererName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return info && gl ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unbekannt';
  });
}

function isSoftwareRenderer(name: string): boolean {
  return /swiftshader|llvmpipe|software/i.test(name);
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index]!;
}

/** Spielt sich bis in die Arena durch; `hold=1` hält sie danach offen. */
async function enterArena(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem('drinkshot.disclaimer.v1', '1');
  });
  await page.goto('./?dev=1&hold=1');

  await page.getByRole('button', { name: 'Spielen' }).click();
  const add = page.getByRole('button', { name: 'Spieler hinzufügen' });
  while ((await page.locator('.lobby__row').count()) < PLAYERS) await add.click();
  await page.getByRole('button', { name: "Los geht's!" }).click();

  for (let i = 0; i < PLAYERS; i++) {
    const pass = page.locator('.screen--pass');
    await pass.waitFor({ timeout: 15_000 });
    await expect(pass).not.toHaveClass(/is-locked/, { timeout: 5_000 });
    await pass.click();
    await page.getByRole('button', { name: 'Bestätigen & verstecken' }).click();
  }

  await page.locator('.screen--arena').waitFor({ timeout: 15_000 });
  // Warten, bis die Atlanten stehen, der erste Frame gerendert ist und die
  // Low-Effects-Messung (2 s) durch ist — sonst misst man die Anlaufphase mit.
  await expect(page.locator('.screen--arena')).not.toHaveClass(/is-loading/, { timeout: 20_000 });
  await page.waitForTimeout(2500);
}

/** Sammelt Frame-Zeiten und Long-Tasks im Browser. */
async function sampleFrames(page: Page, durationMs: number): Promise<number[]> {
  return page.evaluate(async (ms) => {
    const frames: number[] = [];
    let last = performance.now();
    const stopAt = last + ms;
    await new Promise<void>((resolve) => {
      const tick = (now: number): void => {
        frames.push(now - last);
        last = now;
        if (now >= stopAt) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return frames.slice(1); // erster Wert enthält die Anlaufzeit
  }, durationMs);
}

test.describe('Arena-Performance', () => {
  // Nacheinander laufen lassen: parallele Arenen nehmen sich gegenseitig die CPU weg
  // und verfälschen die Messung um den Faktor zwei.
  test.describe.configure({ mode: 'serial' });

  // CPU-Drosselung gibt es nur in Chromium.
  test.skip(({ browserName }) => browserName !== 'chromium', 'braucht CDP');

  test(`8 Shotlings, CPU ${CPU_THROTTLE}×: p50 ≤ ${BUDGET.p50} ms, p95 ≤ ${BUDGET.p95} ms`, async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);

    const cdp = await context.newCDPSession(page);
    await enterArena(page);

    const renderer = await rendererName(page);
    test.skip(
      isSoftwareRenderer(renderer),
      `Software-Renderer (${renderer}) — Frame-Zeiten sagen hier nichts über echte Geräte aus.`
    );

    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
    const frames = await sampleFrames(page, SAMPLE_MS);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    expect(frames.length, 'zu wenige Frames gemessen').toBeGreaterThan(100);

    const sorted = [...frames].sort((a, b) => a - b);
    const p50 = percentile(sorted, 0.5);
    const p95 = percentile(sorted, 0.95);
    const longTasks = frames.filter((frame) => frame > 50).length;
    const draws = await page.evaluate(
      () => (window as unknown as { drinkshot?: { app?: unknown } }).drinkshot !== undefined
    );

    console.log(
      `Renderer ${renderer}\n` +
        `Frames ${frames.length} · p50 ${p50.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · ` +
        `Long-Tasks ${longTasks} · dev-handle ${draws}`
    );

    expect(p50, `p50 ${p50.toFixed(1)} ms`).toBeLessThanOrEqual(BUDGET.p50);
    expect(p95, `p95 ${p95.toFixed(1)} ms`).toBeLessThanOrEqual(BUDGET.p95);
    expect(longTasks, 'Long-Tasks > 50 ms').toBeLessThanOrEqual(BUDGET.longTasks);
  });

  test('Draw-Calls bleiben klein: Arena + Scope ≤ 6 (Audit A2/A3)', async ({ page }) => {
    test.setTimeout(120_000);
    await enterArena(page);
    await page.waitForTimeout(1000);

    const stats = await page.locator('.dev__stats').textContent();
    const value = Number(/draw\s+(-?\d+)/.exec(stats ?? '')?.[1] ?? -1);

    /*
     * Die Arena allein kostet einen Draw-Call (M2, alles in einem Batch). Das Scope legt
     * Vignette, Stencil-Maske für das Fadenkreuz und die Reticle-Geometrie darüber.
     * Sechs ist die Obergrenze, ab der etwas nicht mehr batcht.
     */
    console.log(`Draw-Calls: ${value}`);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThanOrEqual(6);
  });

  test(`JS-Zeit pro Frame bleibt unter ${BUDGET.updateP95} ms (Architektur §7.10)`, async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    const cdp = await context.newCDPSession(page);
    await enterArena(page);

    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
    await page.waitForTimeout(6000);
    const times = await page.evaluate(() => {
      const scope = window as unknown as {
        drinkshot?: { arenaUpdateTimes?: () => number[] };
      };
      return scope.drinkshot?.arenaUpdateTimes?.() ?? [];
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    expect(times.length, 'keine Update-Zeiten gemessen').toBeGreaterThan(60);
    const sorted = [...times].sort((a, b) => a - b);
    const p50 = percentile(sorted, 0.5);
    const p95 = percentile(sorted, 0.95);

    console.log(`JS-Update p50 ${p50.toFixed(2)} ms · p95 ${p95.toFixed(2)} ms (CPU ${CPU_THROTTLE}×)`);
    expect(p95).toBeLessThanOrEqual(BUDGET.updateP95);
  });

  test('Heap bleibt über 30 s flach (keine Allokationen im Loop)', async ({ page, context }) => {
    test.setTimeout(180_000);
    const cdp = await context.newCDPSession(page);
    await enterArena(page);

    const readHeap = async (): Promise<number> => {
      await cdp.send('HeapProfiler.collectGarbage');
      const metrics = await cdp.send('Performance.getMetrics');
      return metrics.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0;
    };

    await cdp.send('Performance.enable');
    await cdp.send('HeapProfiler.enable');

    await page.waitForTimeout(2000);
    const before = await readHeap();
    await page.waitForTimeout(30_000);
    const after = await readHeap();

    const growthKb = (after - before) / 1024;
    console.log(`Heap ${(before / 1024 / 1024).toFixed(2)} MB → ${(after / 1024 / 1024).toFixed(2)} MB (${growthKb.toFixed(0)} KB)`);

    // 30 s Arena dürfen den Heap nach GC nicht nennenswert wachsen lassen.
    expect(growthKb).toBeLessThan(1500);
  });
});
