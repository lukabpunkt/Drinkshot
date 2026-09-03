/**
 * Die Scope-Show (Audit A3).
 *
 * Geprüft wird, was sich nur im Browser prüfen lässt: dass die Dauer-Presets stimmen,
 * dass Filter ausserhalb von Lock und Schuss abgeschaltet sind, dass ein Tab-Wechsel
 * pausiert — und dass das Spiel stumm vollständig durchläuft.
 */

import { expect, test, type Page } from '@playwright/test';

/*
 * Nacheinander laufen lassen: Diese Tests messen echte Wartezeiten einer 10–22 s langen
 * Show. Parallel laufende Shows nehmen sich gegenseitig die CPU weg und verschieben die
 * gemessenen Dauern — dieselbe Falle wie bei den Perf-Tests.
 */
test.describe.configure({ mode: 'serial' });

const PLAYERS = 4;

async function tapPass(page: Page): Promise<void> {
  const pass = page.locator('.screen--pass');
  await pass.waitFor({ timeout: 20_000 });
  await expect(pass).not.toHaveClass(/is-locked/, { timeout: 8_000 });
  await pass.click();
  await page.locator('.screen--bet').waitFor({ timeout: 20_000 });
}

/** Spielt bis in die Arena. `query` hängt Dev-Parameter an. */
async function enterArena(page: Page, query = '', players = PLAYERS): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem('drinkshot.disclaimer.v1', '1');
  });
  await page.goto(`./${query}`);

  await page.getByRole('button', { name: 'Spielen' }).click();
  const add = page.getByRole('button', { name: 'Spieler hinzufügen' });
  while ((await page.locator('.lobby__row').count()) < players) await add.click();
  await page.getByRole('button', { name: "Los geht's!" }).click();

  for (let i = 0; i < players; i++) {
    await tapPass(page);
    await page.getByRole('button', { name: 'Bestätigen & verstecken' }).click();
    if (await page.locator('.screen--arena').count()) break;
  }
  await page.locator('.screen--arena').waitFor({ timeout: 20_000 });
  await expect(page.locator('.screen--arena')).not.toHaveClass(/is-loading/, { timeout: 20_000 });
}

test('die Show läuft durch und endet im Result', async ({ page }) => {
  test.setTimeout(120_000);
  await enterArena(page);

  // LOCK-Schriftzug erscheint in der Lock-Phase.
  await expect(page.locator('.arena__lock')).toBeVisible({ timeout: 20_000 });
  // Nach dem Schuss darf übersprungen werden (GDD §6.4).
  await expect(page.locator('.arena__skip')).toBeVisible({ timeout: 20_000 });

  await expect(page.locator('.screen--result')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.result__headline')).toContainText('trinkt');
});

test('Dauer-Preset "Kurz" ist deutlich kürzer als "Lang"', async ({ page }) => {
  test.setTimeout(180_000);

  const measure = async (option: RegExp): Promise<number> => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem('drinkshot.disclaimer.v1', '1');
    });
    await page.goto('./');
    await page.getByRole('button', { name: 'Einstellungen' }).click();
    await page.getByRole('dialog').getByRole('radio', { name: option }).click();
    await page.locator('.sheet__close').click();
    await expect(page.locator('.sheet')).toHaveCount(0);

    await page.getByRole('button', { name: 'Spielen' }).click();
    const add = page.getByRole('button', { name: 'Spieler hinzufügen' });
    while ((await page.locator('.lobby__row').count()) < 2) await add.click();
    await page.getByRole('button', { name: "Los geht's!" }).click();
    for (let i = 0; i < 2; i++) {
      await tapPass(page);
      await page.getByRole('button', { name: 'Bestätigen & verstecken' }).click();
    }
    await page.locator('.screen--arena').waitFor({ timeout: 20_000 });
    const started = Date.now();
    await page.locator('.screen--result').waitFor({ timeout: 60_000 });
    return Date.now() - started;
  };

  const short = await measure(/Kurz/);
  const long = await measure(/Lang/);

  console.log(`Kurz ${short} ms · Lang ${long} ms`);
  // 10 s gegen 22 s Skript; die Todesanimation kommt bei beiden gleich obendrauf.
  expect(long - short).toBeGreaterThan(8_000);
  expect(long - short).toBeLessThan(16_000);
});

test('Filter sind ausserhalb von Lock und Schuss abgeschaltet (Audit A3)', async ({ page }) => {
  test.setTimeout(120_000);
  await enterArena(page, '?dev=1&hold=1');

  // Frühe Phase: Scan und Panik laufen ohne Filter.
  const stats = page.locator('.dev__stats');
  for (let i = 0; i < 6; i++) {
    await expect(stats).toContainText('fltr  aus');
    await page.waitForTimeout(700);
  }
});

test('Tab-Wechsel pausiert die Show', async ({ page }) => {
  test.setTimeout(120_000);
  await enterArena(page, '?dev=1');

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(3000);
  // Während der Pause darf die Show nicht ins Result durchlaufen.
  await expect(page.locator('.screen--arena')).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.screen--result')).toBeVisible({ timeout: 40_000 });
});

test('stumm komplett spielbar (Audit A3)', async ({ page }) => {
  test.setTimeout(120_000);

  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem('drinkshot.disclaimer.v1', '1');
    // Ton aus, bevor irgendetwas startet.
    window.localStorage.setItem(
      'drinkshot.session.v1',
      JSON.stringify({ players: [], rounds: [], settings: { sound: false } })
    );
    // Zusätzlich den AudioContext ganz entfernen — das simuliert ein Gerät ohne Audio.
    Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true });
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined, configurable: true });
  });
  await page.goto('./');

  await page.getByRole('button', { name: 'Spielen' }).click();
  const add = page.getByRole('button', { name: 'Spieler hinzufügen' });
  while ((await page.locator('.lobby__row').count()) < 2) await add.click();
  await page.getByRole('button', { name: "Los geht's!" }).click();
  for (let i = 0; i < 2; i++) {
    await tapPass(page);
    await page.getByRole('button', { name: 'Bestätigen & verstecken' }).click();
  }

  await expect(page.locator('.screen--result')).toBeVisible({ timeout: 40_000 });
  await expect(page.locator('.result__headline')).toContainText('trinkt');
  expect(errors).toEqual([]);
});
