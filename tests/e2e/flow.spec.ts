/**
 * E2E-Flow (Mobile-Emulation, Audit A1).
 *
 * Deckt den kompletten Ablauf ab: Titel → Lobby → Pass/Bet je Spieler → Arena-Platzhalter
 * → Result → nächste Runde. Läuft gegen iPhone 12 und Pixel 5 (playwright.config.ts).
 */

import { expect, test, type Page } from '@playwright/test';
import { ARENA_TIMEOUT, betAllAndStart } from './helpers';

const PLAYERS = ['Rudi', 'Blue', 'Gustav', 'Yoshi'];

/** Sammelt Console-Errors; A1 fordert einen Flow ohne sie. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function freshStart(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Nur beim allerersten Laden aufräumen — sonst würde ein Reload im Test
    // genau die Persistenz zerstören, die er prüfen soll.
    if (window.sessionStorage.getItem('e2e-initialised')) return;
    window.sessionStorage.setItem('e2e-initialised', '1');
    window.localStorage.clear();
    // 18+-Hinweis vorab quittieren, sonst deckt das Sheet den Titel-Screen ab.
    window.localStorage.setItem('drinkshot.disclaimer.v1', '1');
  });
  await page.goto('./');
}

async function setUpLobby(page: Page, names: string[]): Promise<void> {
  await page.getByRole('button', { name: 'Spielen' }).click();
  await expect(page.locator('.screen--lobby')).toBeVisible();

  const addButton = page.getByRole('button', { name: 'Spieler hinzufügen' });
  while ((await page.locator('.lobby__row').count()) < names.length) {
    await addButton.click();
  }

  const inputs = page.locator('.lobby__name');
  for (const [index, name] of names.entries()) {
    await inputs.nth(index).fill(name);
    await inputs.nth(index).blur();
    // Warten, bis der Name wirklich im Feld steht — unter Last kommt das `change`-Event
    // sonst erst nach der nächsten Interaktion an.
    await expect(inputs.nth(index)).toHaveValue(name);
  }
}

/** Liest die gespeicherten Spielernamen aus dem localStorage. */
async function storedNames(page: Page): Promise<string> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('drinkshot.session.v1');
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { players?: { name: string }[] };
    return (parsed.players ?? []).map((player) => player.name).join(',');
  });
}

/** Spielt eine komplette Betting-Phase durch und wartet auf den Result-Screen. */
async function playRound(page: Page, bets: number[]): Promise<void> {
  await betAllAndStart(page, { bets });
  await expect(page.locator('.screen--result')).toBeVisible({ timeout: ARENA_TIMEOUT });
}

test('kompletter Flow: 4 Spieler, 2 Runden', async ({ page }) => {
  // Zwei volle Runden mit je 15 s Show, 8 Wipes und 8 Screens — der Test ist absichtlich
  // langsam, weil er das echte Timing mitläuft.
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await freshStart(page);

  await expect(page.locator('.title__logo')).toHaveText('DRINKSHOT');
  await setUpLobby(page, PLAYERS);
  await page.getByRole('button', { name: "Los geht's!" }).click();

  /* --- Runde 1 --- */
  await playRound(page, [1, 2, 3, 5]);

  const headline = page.locator('.result__headline');
  await expect(headline).toContainText('trinkt');

  // Alle Einsätze sind jetzt öffentlich — und die Chancen stimmen (B = 11).
  const table = page.locator('.bets tbody tr');
  await expect(table).toHaveCount(4);
  await expect(page.locator('.bets tbody tr').first()).toContainText('45 %');

  // Genau ein Spieler ist als Opfer markiert.
  await expect(page.locator('.bets tbody tr.is-victim')).toHaveCount(1);

  /* --- Runde 2 --- */
  await page.getByRole('button', { name: 'Nächste Runde' }).click();
  await playRound(page, [4, 4, 4, 4]);

  await expect(page.locator('.result__headline')).toContainText('trinkt 4');
  /*
   * Scoreboard zählt über beide Runden. Die sichtbare Zahl läuft dorthin erst hoch
   * (Roadmap M5.3) — der Endwert steht aber sofort im `aria-label`, weil ein
   * Screenreader keine Zwischenstände vorlesen soll. Genau den liest der Test.
   */
  const scoreSum = await page.locator('.score__value').evaluateAll((nodes) =>
    nodes.reduce((sum, node) => sum + Number(node.getAttribute('aria-label')), 0)
  );
  expect(scoreSum).toBeGreaterThan(4);

  // Und nach dem Zählen stimmt auch, was dasteht.
  await expect
    .poll(async () =>
      page
        .locator('.score__value')
        .evaluateAll((nodes) => nodes.reduce((sum, node) => sum + Number(node.textContent), 0))
    )
    .toBe(scoreSum);

  expect(errors).toEqual([]);
});

test('Einsatz ist nach dem Bestätigen nirgends mehr sichtbar', async ({ page }) => {
  await freshStart(page);
  await setUpLobby(page, ['Anna', 'Ben']);
  await page.getByRole('button', { name: "Los geht's!" }).click();

  await expect(page.locator('.screen--pass')).not.toHaveClass(/is-locked/, { timeout: 4000 });
  await page.locator('.screen--pass').click();
  await page.getByRole('button', { name: 'Einsatz erhöhen' }).click(); // 3 → 4
  await page.getByRole('button', { name: 'Bestätigen & verstecken' }).click();

  // Zurück auf dem Pass-Screen für Spieler 2: keine Zahl, kein Stepper.
  await expect(page.locator('.screen--pass')).toBeVisible();
  await expect(page.locator('.stepper__value')).toHaveCount(0);
  await expect(page.locator('.screen--pass')).not.toContainText('4');

  /*
   * Und auch der Start-Screen verrät nichts. Er ist die neue Stelle, an der man das
   * brechen könnte: Er kennt alle Einsätze und steht nach dem letzten Bestätigen.
   */
  await expect(page.locator('.screen--pass')).not.toHaveClass(/is-locked/, { timeout: 4000 });
  await page.locator('.screen--pass').click();
  await page.getByRole('button', { name: 'Einsatz senken' }).click(); // 3 → 2
  await page.getByRole('button', { name: 'Bestätigen & verstecken' }).click();

  const ready = page.locator('.screen--ready');
  await expect(ready).toBeVisible();
  await expect(page.locator('.stepper__value')).toHaveCount(0);
  // Keine der gesetzten Zahlen steht auf dem Screen — auch nicht in einer Summe (6).
  const text = (await ready.innerText()).replace(/\d+ von \d+/g, '');
  expect(text).not.toMatch(/\b(2|4|6)\b/);
});

test('Start-Screen ist per Tastatur bedienbar', async ({ page }) => {
  await freshStart(page);
  await setUpLobby(page, ['Anna', 'Ben']);
  await page.getByRole('button', { name: "Los geht's!" }).click();

  for (let i = 0; i < 2; i++) {
    await expect(page.locator('.screen--pass')).not.toHaveClass(/is-locked/, { timeout: 4000 });
    await page.locator('.screen--pass').click();
    await page.getByRole('button', { name: 'Bestätigen & verstecken' }).click();
  }

  const ready = page.locator('.screen--ready');
  await expect(ready).not.toHaveClass(/is-locked/, { timeout: 4000 });
  // Nach dem Entsperren liegt der Fokus auf dem Start-Knopf — Enter reicht.
  await expect(page.getByRole('button', { name: 'Los!' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.screen--arena')).toBeVisible({ timeout: 20_000 });
});

test('Privacy-Screen blockiert Taps 800 ms lang', async ({ page }) => {
  await freshStart(page);
  await setUpLobby(page, ['Anna', 'Ben']);
  await page.getByRole('button', { name: "Los geht's!" }).click();

  const pass = page.locator('.screen--pass');
  await expect(pass).toBeVisible();
  // Sofortiger Tap darf nichts auslösen.
  await pass.click({ force: true });
  await expect(page.locator('.screen--bet')).toHaveCount(0);

  await expect(pass).not.toHaveClass(/is-locked/, { timeout: 4000 });
  await pass.click();
  await expect(page.locator('.screen--bet')).toBeVisible();
});

test('Lobby validiert die Mindest-Spielerzahl', async ({ page }) => {
  await freshStart(page);
  await page.getByRole('button', { name: 'Spielen' }).click();

  const rows = page.locator('.lobby__row');
  await expect(rows).toHaveCount(2); // wird beim ersten Start aufgefüllt

  await page.locator('.lobby__remove').first().click();
  await expect(rows).toHaveCount(1);
  await expect(page.getByRole('button', { name: "Los geht's!" })).toBeDisabled();
  await expect(page.locator('.lobby__hint')).toContainText('Duell');
});

test('Namen und Einstellungen überleben einen Reload', async ({ page }) => {
  await freshStart(page);
  await setUpLobby(page, ['Marlene', 'Konstantin']);

  await page.getByRole('button', { name: /^Dauer/ }).click();
  await page.getByRole('dialog').getByRole('radio', { name: /Lang/ }).click();
  await page.locator('.sheet__close').click();
  await expect(page.locator('.sheet')).toHaveCount(0);

  /*
   * Erst neu laden, wenn wirklich geschrieben wurde. Sonst prüft der Test unter Last
   * gelegentlich einen Reload, der dem letzten Schreibvorgang zuvorgekommen ist — und
   * meldet einen Persistenzfehler, den es nicht gibt.
   */
  await expect.poll(() => storedNames(page)).toContain('Marlene');
  await page.reload();
  await page.getByRole('button', { name: 'Spielen' }).click();

  await expect(page.locator('.lobby__name').first()).toHaveValue('Marlene');
  await expect(page.locator('.lobby__name').nth(1)).toHaveValue('Konstantin');
  await expect(page.locator('.chip').nth(1)).toContainText('Lang');
});

test('alle Touch-Ziele sind mindestens 48 px hoch, Primary-CTAs 64 px', async ({ page }) => {
  await freshStart(page);
  await page.getByRole('button', { name: 'Spielen' }).click();

  const small = await page.locator('button, input, [role="button"]').evaluateAll((nodes) =>
    nodes
      .filter((node) => (node as HTMLElement).offsetParent !== null)
      .map((node) => ({ text: node.textContent?.trim().slice(0, 24) ?? '', height: node.getBoundingClientRect().height }))
      .filter((entry) => entry.height < 48)
  );
  expect(small).toEqual([]);

  const primaryHeight = await page
    .getByRole('button', { name: "Los geht's!" })
    .evaluate((node) => node.getBoundingClientRect().height);
  expect(primaryHeight).toBeGreaterThanOrEqual(64);
});

test('Zurück-Button fragt in der Betting-Phase nach', async ({ page }) => {
  await freshStart(page);
  await setUpLobby(page, ['Anna', 'Ben']);
  await page.getByRole('button', { name: "Los geht's!" }).click();
  await expect(page.locator('.screen--pass')).toBeVisible();

  await page.goBack();
  const dialog = page.getByRole('dialog', { name: 'Runde abbrechen?' });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Weiterspielen' }).click();
  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect(page.locator('.screen--pass')).toBeVisible();

  await page.goBack();
  const second = page.getByRole('dialog', { name: 'Runde abbrechen?' });
  await expect(second).toBeVisible();
  await second.getByRole('button', { name: 'Ja, abbrechen' }).click();
  await expect(page.locator('.screen--lobby')).toBeVisible();
});

test('Sprachwechsel schaltet die ganze Oberfläche um', async ({ page }) => {
  await freshStart(page);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('radio', { name: 'EN', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  // `text-transform: uppercase` faerbt nur die Anzeige — im DOM steht der i18n-Text.
  await expect(page.locator('.title__tagline')).toHaveText('Bet. Run. Drink.');
  // Kein Platzhalter für fehlende Keys.
  await expect(page.locator('body')).not.toContainText('[missing:');
});

test('Regeln zeigen vier Karten', async ({ page }) => {
  await freshStart(page);
  await page.getByRole('button', { name: 'Regeln' }).click();
  await expect(page.getByRole('dialog', { name: 'Regeln' })).toBeVisible();
  await expect(page.locator('.rules__card')).toHaveCount(4);
});

test('Landscape zeigt das "Handy drehen"-Overlay', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await freshStart(page);
  const overlay = page.locator('.orientation-lock');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('.orientation-lock__title')).not.toBeEmpty();
});

test('PWA-Manifest und Service Worker', async ({ page, request }) => {
  await freshStart(page);

  const href = await page.getAttribute('link[rel="manifest"]', 'href');
  const manifestResponse = await request.get(new URL(href!, page.url()).toString());
  expect(manifestResponse.ok()).toBe(true);

  const manifest = (await manifestResponse.json()) as {
    name: string;
    display: string;
    icons: { sizes: string; purpose?: string }[];
  };
  expect(manifest.name).toBe('Drinkshot');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          if (!('serviceWorker' in navigator)) return 0;
          return (await navigator.serviceWorker.getRegistrations()).length;
        }),
      { timeout: 10_000 }
    )
    .toBeGreaterThan(0);
});

test('Portrait scrollt nicht horizontal', async ({ page }) => {
  await freshStart(page);
  await page.getByRole('button', { name: 'Spielen' }).click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow).toBe(false);
});
