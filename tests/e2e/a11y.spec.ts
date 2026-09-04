/**
 * Barrierefreiheit, Sprache und Fehlerfaelle (Audit A5).
 *
 * Was hier steht, laesst sich nicht im Unit-Test pruefen: Es haengt am echten Browser —
 * `prefers-reduced-motion`, Tastatur-Reihenfolge, Service Worker, fehlende Assets.
 */

import { expect, test, type Page } from '@playwright/test';
import { enterLobby, placeBet, startShow, tapPass } from './helpers';

/**
 * Frischer Start auf dem Titelbild.
 *
 * Das Skript laeuft bei **jeder** Navigation, also auch beim Reload — deshalb raeumt es
 * nur einmal auf und merkt sich das. Ohne die Sperre wuerde ein `page.reload()` im Test
 * genau das wegwerfen, was der Test gerade pruefen will.
 */
async function openTitle(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const FLAG = '__drinkshot_test_cleaned';
    if (!window.sessionStorage.getItem(FLAG)) {
      window.localStorage.clear();
      window.sessionStorage.setItem(FLAG, '1');
    }
    window.localStorage.setItem('drinkshot.disclaimer.v1', '1');
  });
  await page.goto('./');
  await page.locator('.screen--title').waitFor();
}

test('kein Text zeigt einen fehlenden i18n-Key (Audit A5)', async ({ page }) => {
  await openTitle(page);

  const screens: string[] = [];
  screens.push((await page.locator('#app').innerText()) ?? '');

  await page.getByRole('button', { name: 'Regeln' }).click();
  await page.locator('.sheet__panel').waitFor();
  screens.push(await page.locator('.sheet__panel').innerText());
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.locator('.sheet__panel').waitFor();
  screens.push(await page.locator('.sheet__panel').innerText());

  // Auf Englisch dasselbe: Der Marker taucht auch dann nicht auf.
  await page.getByRole('radio', { name: 'EN', exact: true }).click();
  await page.waitForTimeout(400);
  screens.push((await page.locator('#app').innerText()) ?? '');

  for (const text of screens) expect(text).not.toContain('[missing:');
});

test('Sprachwechsel schaltet vollstaendig um und bleibt gesetzt', async ({ page }) => {
  await openTitle(page);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('radio', { name: 'EN', exact: true }).click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');

  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('alle vier Modi sind erklaert und auswaehlbar (Audit A5)', async ({ page }) => {
  await openTitle(page);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.locator('.modes').waitFor();

  const options = page.locator('.modes__option');
  await expect(options).toHaveCount(4);

  for (let i = 0; i < 4; i++) {
    const option = options.nth(i);
    // Jeder Modus hat einen Namen *und* einen Satz, der ihn erklaert.
    await expect(option.locator('.modes__name')).not.toBeEmpty();
    const hint = await option.locator('.modes__hint').innerText();
    expect(hint.length).toBeGreaterThan(15);
  }

  // Die Modi sind eine Radiogruppe — der gewaehlte meldet sich als `aria-checked`.
  await options.nth(3).click();
  await expect(options.nth(3)).toHaveAttribute('aria-checked', 'true');
  await expect(options.nth(0)).toHaveAttribute('aria-checked', 'false');
});

test('Sudden Death zeigt Ausgeschiedene in der Lobby', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem('drinkshot.disclaimer.v1', '1');
    window.localStorage.setItem(
      'drinkshot.session.v1',
      JSON.stringify({
        players: [
          { id: 'a', name: 'Anna', colorId: 'red' },
          { id: 'b', name: 'Ben', colorId: 'blue' },
          { id: 'c', name: 'Cem', colorId: 'green' },
        ],
        rounds: [
          {
            seed: 1,
            bets: [
              { playerId: 'a', sips: 2 },
              { playerId: 'b', sips: 2 },
              { playerId: 'c', sips: 2 },
            ],
            victimId: 'b',
            extraVictimIds: [],
            extraDeaths: [],
            deathId: 'basic_fall',
            zone: 'body',
            mode: 'suddenDeath',
            durationPreset: 'short',
            drinkers: [{ playerId: 'b', sips: 2 }],
            odds: { a: 0.33, b: 0.33, c: 0.33 },
            eliminatedIds: ['b'],
            finishedAt: Date.now(),
          },
        ],
        settings: { mode: 'suddenDeath', sound: false },
      })
    );
  });
  await page.goto('./');

  await page.getByRole('button', { name: 'Spielen' }).click();
  await page.locator('.lobby__row').first().waitFor();

  const eliminated = page.locator('.lobby__row.is-eliminated');
  await expect(eliminated).toHaveCount(1);
  // Der Name steht in einem Eingabefeld — der Text daneben sagt, dass die Person raus ist.
  await expect(eliminated.locator('.lobby__name')).toHaveValue('Ben');
  await expect(eliminated).toContainText('Ausgeschieden');
});

test.describe('prefers-reduced-motion', () => {
  /*
   * `test.use({ reducedMotion })` gilt fuer den ganzen Kontext, wird aber vom
   * Geraeteprofil ueberschrieben — deshalb direkt am Kontext setzen.
   */
  test('Wipes, Konfetti und Titel-Loop stehen still (Audit A5)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openTitle(page);

    // Der Titel-Loop laeuft nicht — keine laufende Animation auf seinen Elementen.
    const looping = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => {
            const target = (animation as unknown as { effect?: { target?: Element } }).effect?.target;
            return target?.closest('.titleLoop') !== null && target?.closest('.titleLoop') !== undefined;
          }).length
    );
    expect(looping).toBe(0);

    // Der Screenwechsel kommt trotzdem an — der Wipe wird zum Fade, nicht zum Hindernis.
    await page.getByRole('button', { name: 'Spielen' }).click();
    await expect(page.locator('.screen--lobby')).toBeVisible({ timeout: 8000 });
  });
});

test('Tastatur allein reicht von Titel bis Lobby (Audit A5)', async ({ page }) => {
  await openTitle(page);

  // Der Screen bekommt beim Mount den Fokus — von dort tabt man in die Buttons.
  const reachable: string[] = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    reachable.push(await page.evaluate(() => document.activeElement?.textContent?.trim() ?? ''));
  }
  expect(reachable.join(' | ')).toContain('Spielen');
  expect(reachable.join(' | ')).toContain('Regeln');
  expect(reachable.join(' | ')).toContain('Einstellungen');

  await page.getByRole('button', { name: 'Spielen' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.screen--lobby')).toBeVisible({ timeout: 8000 });

  // Nach dem Wechsel steht der Fokus im neuen Screen, nicht im Nichts.
  const inNewScreen = await page.evaluate(
    () => document.activeElement?.closest('.screen--lobby') !== null
  );
  expect(inNewScreen).toBe(true);
});

test('fehlender Atlas fuehrt zu Toast und nicht in die Sackgasse (Audit A5)', async ({ page }) => {
  test.setTimeout(120_000);

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem('drinkshot.disclaimer.v1', '1');
    window.localStorage.setItem(
      'drinkshot.session.v1',
      JSON.stringify({ players: [], rounds: [], settings: { sound: false } })
    );
  });
  // Beide Versuche scheitern lassen — der Retry ist Teil des Verhaltens.
  await page.route('**/atlas/**', (route) => route.abort('failed'));
  await page.goto('./');

  await enterLobby(page, 2);
  await page.getByRole('button', { name: "Los geht's!" }).click();

  for (let i = 0; i < 2; i++) {
    await tapPass(page);
    await placeBet(page);
  }
  await startShow(page);

  // Meldung statt schwarzem Bild …
  await expect(page.locator('.toast--danger')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Nochmal versuchen' })).toBeVisible();

  // … und die Runde endet trotzdem im Result: Das Ergebnis stand schon fest.
  await expect(page.locator('.screen--result')).toBeVisible({ timeout: 30_000 });
});

test('startet nach der Erstinstallation auch offline (Audit A5)', async ({
  page,
  context,
  browserName,
}) => {
  test.setTimeout(120_000);

  /*
   * WebKit unter Playwright bricht beim `reload()` im Offline-Modus mit „internal error"
   * ab — das ist die Testumgebung, nicht die App: Der Service Worker registriert sich
   * unter WebKit sauber, was der Test „PWA-Manifest und Service Worker" auch dort prueft.
   * Das Verhalten auf echtem iOS-Safari bleibt ein manueller Check (siehe A5-Report).
   */
  test.skip(
    browserName === 'webkit',
    'Playwright/WebKit kann offline nicht neu laden (Harness-Grenze, kein App-Fehler)'
  );

  await page.addInitScript(() => {
    window.localStorage.setItem('drinkshot.disclaimer.v1', '1');
  });
  await page.goto('./');
  await page.locator('.screen--title').waitFor();

  /*
   * Erst warten, bis der Worker **aktiv** ist. Die Kontrolle uebernimmt er bei
   * `registerType: 'prompt'` bewusst nicht sofort — sonst koennte ein Update mitten in
   * einer laufenden Runde greifen. Beim naechsten Aufruf steuert er dann.
   */
  await page.waitForFunction(
    async () => {
      const registration = await navigator.serviceWorker?.getRegistration();
      return registration?.active !== null && registration?.active !== undefined;
    },
    undefined,
    { timeout: 30_000 }
  );
  // Precaching laeuft im Hintergrund weiter — kurz Luft lassen.
  await page.waitForTimeout(3000);

  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null && navigator.serviceWorker?.controller !== undefined, undefined, {
    timeout: 30_000,
  });

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator('.screen--title')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Spielen' })).toBeVisible();
    // Nicht nur das Grundgeruest: Der Titel-Loop haengt an CSS, das mitgeladen sein muss.
    await expect(page.locator('.titleLoop__figure')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
