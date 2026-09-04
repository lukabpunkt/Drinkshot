/**
 * Die Scope-Show (Audit A3).
 *
 * Geprüft wird, was sich nur im Browser prüfen lässt: dass die Dauer-Presets stimmen,
 * dass Filter ausserhalb von Lock und Schuss abgeschaltet sind, dass ein Tab-Wechsel
 * pausiert — und dass das Spiel stumm vollständig durchläuft.
 */

import { expect, test, type Page } from '@playwright/test';

/*
 * Diese Tests messen echte Wartezeiten einer 10–22 s langen Show. Die Reihenfolge ist
 * durch `workers: 1` und `fullyParallel: false` ohnehin sequenziell (playwright.config.ts).
 *
 * Bewusst **kein** `mode: 'serial'`: Der bricht nach dem ersten Fehler den Rest der Datei
 * ab. Bei einem Flake auf einem langsamen Runner verliert man dadurch das Ergebnis aller
 * folgenden Tests — und weiss hinterher weniger als vorher.
 */

const PLAYERS = 4;

/**
 * Ohne GPU rendert Chromium per SwiftShader. Wird ein Frame dann länger als PIXIs
 * `maxElapsedMS`, klemmt der Ticker den Zeitschritt ab — die Show läuft in Zeitlupe
 * weiter, statt zu springen. Das ist auf einem echten Gerät genau richtig, macht aber
 * jede Wanduhr-Messung wertlos. Solche Tests sagen es dann lieber, statt falsch rot zu
 * werden; die exakten Dauern prüft ohnehin `choreographer.test.ts` am Skript.
 */
async function isSoftwareRenderer(page: Page): Promise<boolean> {
  const renderer = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return info && gl ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  });
  return /swiftshader|llvmpipe|software/i.test(renderer);
}

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
  test.setTimeout(180_000);
  await enterArena(page);

  // LOCK-Schriftzug erscheint in der Lock-Phase.
  await expect(page.locator('.arena__lock')).toBeVisible({ timeout: 40_000 });
  // Nach dem Schuss darf übersprungen werden (GDD §6.4).
  await expect(page.locator('.arena__skip')).toBeVisible({ timeout: 40_000 });

  await expect(page.locator('.screen--result')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.result__headline')).toContainText('trinkt');
});

test('Dauer-Preset "Kurz" ist deutlich kürzer als "Lang"', async ({ page }) => {
  test.setTimeout(240_000);

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
    await page.locator('.screen--arena').waitFor({ timeout: 30_000 });
    /*
     * Erst warten, bis die Atlanten stehen. Beim ersten Durchlauf werden sie hier noch
     * geladen — läuft das in die Messung hinein, ist die erste Messung um die Ladezeit
     * zu lang und die Differenz stimmt nicht mehr.
     */
    await expect(page.locator('.screen--arena')).not.toHaveClass(/is-loading/, {
      timeout: 30_000,
    });
    const started = Date.now();
    /*
     * Bis zum **Schuss** messen, nicht bis zum Result.
     *
     * Das Dauer-Preset steuert das Drehbuch — Intro, Scan, Panik, Lock. Die
     * Todesanimation kommt danach und ist seit M4a absichtlich variabel: je nach
     * gewürfelter Sequenz 2,6 bis 4,5 s. Bis zum Result gemessen schwankt die Differenz
     * dadurch um zwei Sekunden und sagt nichts mehr über das Preset aus.
     * `.arena__skip` erscheint genau mit dem Schuss.
     */
    await page.locator('.arena__skip').waitFor({ state: 'visible', timeout: 90_000 });
    return Date.now() - started;
  };

  const short = await measure(/Kurz/);
  const software = await isSoftwareRenderer(page);
  const long = await measure(/Lang/);

  console.log(
    `Kurz ${short} ms · Lang ${long} ms (bis zum Schuss)${software ? ' — Software-Renderer' : ''}`
  );

  // Grundaussage gilt überall: „Lang" dauert spürbar länger als „Kurz".
  expect(long).toBeGreaterThan(short + 5_000);

  // Die exakte Spanne nur dort, wo die Wanduhr überhaupt etwas misst.
  test.skip(
    software,
    'Software-Renderer: PIXI klemmt lange Frames ab, die Show läuft dann gedehnt.'
  );
  // 22 s minus 10 s Skript, plus etwas Luft für Wipes und Anlaufzeit.
  expect(long - short).toBeGreaterThan(9_000);
  expect(long - short).toBeLessThan(15_000);
});

test('Filter sind ausserhalb von Lock und Schuss abgeschaltet (Audit A3)', async ({ page }) => {
  test.setTimeout(180_000);
  await enterArena(page, '?dev=1&hold=1');

  // Frühe Phase: Scan und Panik laufen ohne Filter.
  const stats = page.locator('.dev__stats');
  for (let i = 0; i < 6; i++) {
    await expect(stats).toContainText('fltr  aus');
    await page.waitForTimeout(700);
  }
});

test('Tab-Wechsel pausiert die Show', async ({ page }) => {
  test.setTimeout(180_000);
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
  await expect(page.locator('.screen--result')).toBeVisible({ timeout: 60_000 });
});

test('stumm komplett spielbar (Audit A3)', async ({ page }) => {
  test.setTimeout(180_000);

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

  await expect(page.locator('.screen--result')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.result__headline')).toContainText('trinkt');
  expect(errors).toEqual([]);
});

test('Wunder: niemand trinkt, und der Result-Screen feiert es (Audit A4)', async ({ page }) => {
  test.setTimeout(180_000);

  /*
   * `?death=miracle_dodge` erzwingt die Sequenz. Ohne das müsste der Test im Schnitt
   * vierzig Runden spielen — die Rarität ist im GDD mit 1 zu 40 festgeschrieben.
   */
  await enterArena(page, '?dev=1&death=miracle_dodge', 3);
  await expect(page.locator('.screen--result')).toBeVisible({ timeout: 60_000 });

  // Der seltenste Ausgang bekommt sein eigenes Bild.
  await expect(page.locator('.result__legend')).toBeVisible();
  await expect(page.locator('.result__headline')).toContainText('Niemand trinkt');
  await expect(page.locator('.result__zone')).toContainText('Glück gehabt');

  // Und die Regel greift: das Scoreboard bleibt bei null (GDD §4.1, Modus Klassik).
  const totals = await page
    .locator('.score__value')
    .evaluateAll((nodes) => nodes.map((node) => Number(node.textContent)));
  expect(totals.length).toBeGreaterThan(0);
  expect(totals.every((value) => value === 0), `Scoreboard: ${totals.join(',')}`).toBe(true);
});

test('erzwungene Sequenz landet mit der richtigen Zone im Result', async ({ page }) => {
  test.setTimeout(180_000);

  await enterArena(page, '?dev=1&death=leg_hop', 2);
  await expect(page.locator('.screen--result')).toBeVisible({ timeout: 60_000 });
  // Zonen-Text aus der Registry, nicht aus einem Platzhalter.
  await expect(page.locator('.result__zone')).toContainText('Ins Bein');
});

test('Double Tap: zwei Opfer, zwei Schüsse, beide trinken (Audit A5)', async ({ page }) => {
  test.setTimeout(180_000);

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem('drinkshot.disclaimer.v1', '1');
    window.localStorage.setItem(
      'drinkshot.session.v1',
      JSON.stringify({ players: [], rounds: [], settings: { sound: false, mode: 'doubleTap' } })
    );
  });
  // Kurzes Preset: Der Nachschlag hängt hinten dran, die Runde wird ohnehin länger.
  await page.goto('./?dev=1');

  await page.getByRole('button', { name: 'Spielen' }).click();
  const add = page.getByRole('button', { name: 'Spieler hinzufügen' });
  while ((await page.locator('.lobby__row').count()) < PLAYERS) await add.click();
  await page.getByRole('button', { name: "Los geht's!" }).click();

  for (let i = 0; i < PLAYERS; i++) {
    await tapPass(page);
    await page.getByRole('button', { name: 'Bestätigen & verstecken' }).click();
    if (await page.locator('.screen--arena').count()) break;
  }
  await page.locator('.screen--arena').waitFor({ timeout: 20_000 });

  await expect(page.locator('.screen--result')).toBeVisible({ timeout: 120_000 });

  /*
   * Der Beleg steht im Result: Kopfzeile nennt das erste Opfer, die Unterzeile das
   * zweite — zwei verschiedene Namen, beide trinken (GDD §4.2).
   */
  const headline = (await page.locator('.result__headline').textContent()) ?? '';
  const sub = (await page.locator('.result__sub').textContent()) ?? '';
  expect(headline).toMatch(/trinkt/);
  expect(sub).toMatch(/trinkt/);

  const nameIn = (text: string) => text.match(/^(Spieler \d)/)?.[1];
  expect(nameIn(headline)).toBeTruthy();
  expect(nameIn(sub)).toBeTruthy();
  expect(nameIn(sub)).not.toBe(nameIn(headline));

  const rounds = await page.evaluate(
    () =>
      (
        window as unknown as {
          drinkshot: { session: { state: { rounds: { drinkers: unknown[] }[] } } };
        }
      ).drinkshot.session.state.rounds
  );
  expect(rounds[rounds.length - 1]?.drinkers).toHaveLength(2);
});
