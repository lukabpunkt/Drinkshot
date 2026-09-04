/**
 * Die Scope-Show (Audit A3).
 *
 * Geprüft wird, was sich nur im Browser prüfen lässt: dass die Dauer-Presets stimmen,
 * dass Filter ausserhalb von Lock und Schuss abgeschaltet sind, dass ein Tab-Wechsel
 * pausiert — und dass das Spiel stumm vollständig durchläuft.
 */

import { expect, test, type Page } from '@playwright/test';
import { betAllAndStart, enterLobby, prepare } from './helpers';

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

/** Spielt bis in die Arena. `query` hängt Dev-Parameter an. */
async function enterArena(
  page: Page,
  query = '',
  players = PLAYERS,
  settings?: Record<string, unknown>
): Promise<void> {
  await prepare(page, settings);
  await page.goto(`./${query}`);
  await enterLobby(page, players);
  await page.getByRole('button', { name: "Los geht's!" }).click();
  await betAllAndStart(page, { players });
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
    await prepare(page);
    await page.goto('./');
    await page.getByRole('button', { name: 'Einstellungen' }).click();
    await page.getByRole('dialog').getByRole('radio', { name: option }).click();
    await page.locator('.sheet__close').click();
    await expect(page.locator('.sheet')).toHaveCount(0);

    await enterLobby(page, 2);
    await page.getByRole('button', { name: "Los geht's!" }).click();
    /*
     * `betAllAndStart` wartet, bis die Atlanten stehen. Beim ersten Durchlauf werden sie
     * dort noch geladen — liefe das in die Messung hinein, wäre die erste Messung um die
     * Ladezeit zu lang und die Differenz stimmte nicht mehr.
     */
    await betAllAndStart(page, { players: 2 });
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

  await enterLobby(page, 2);
  await page.getByRole('button', { name: "Los geht's!" }).click();
  await betAllAndStart(page, { players: 2 });

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

  await enterLobby(page, PLAYERS);
  await page.getByRole('button', { name: "Los geht's!" }).click();
  await betAllAndStart(page, { players: PLAYERS });

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

test('Showdown: alle bis auf einen fallen, niemand scheidet dauerhaft aus', async ({ page }) => {
  test.setTimeout(180_000);

  // Kurzes Preset: Bei vier Spielern fallen drei Schüsse, das dauert ohnehin.
  await enterArena(page, '?dev=1', PLAYERS, { sound: false, mode: 'showdown', duration: 'short' });

  await expect(page.locator('.screen--result')).toBeVisible({ timeout: 120_000 });

  /*
   * Genau einer überlebt: Die Kopfzeile feiert ihn, die Unterzeile sagt, was die anderen
   * trinken (GDD §3.6).
   */
  await expect(page.locator('.result__headline')).toContainText('überlebt');
  await expect(page.locator('.result__crown')).toBeVisible();
  await expect(page.locator('.result__zone')).toContainText('Schüsse');

  const round = await page.evaluate(
    () =>
      (
        window as unknown as {
          drinkshot: {
            session: {
              state: {
                rounds: {
                  drinkers: unknown[];
                  eliminatedIds: string[];
                  winnerId?: string;
                }[];
              };
            };
          };
        }
      ).drinkshot.session.state.rounds.at(-1)!
  );

  // Vier Spieler, drei trinken, einer gewinnt.
  expect(round.drinkers).toHaveLength(PLAYERS - 1);
  expect(round.winnerId).toBeTruthy();
  /*
   * Der Unterschied zu Sudden Death: Das Ausscheiden gilt nur innerhalb der Runde. Wäre
   * `eliminatedIds` gefüllt, wäre die Session nach dieser einen Runde vorbei.
   */
  expect(round.eliminatedIds).toEqual([]);

  // Und der Beleg dafür: Die nächste Runde lässt sich starten.
  const next = page.getByRole('button', { name: 'Nächste Runde' });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.locator('.screen--pass')).toBeVisible({ timeout: 20_000 });
});

test('Showdown markiert niemanden in der Lobby als ausgeschieden', async ({ page }) => {
  test.setTimeout(180_000);

  await enterArena(page, '?dev=1', 3, { sound: false, mode: 'showdown', duration: 'short' });
  await expect(page.locator('.screen--result')).toBeVisible({ timeout: 120_000 });

  await page.getByRole('button', { name: 'Spieler ändern' }).click();
  await page.locator('.screen--lobby').waitFor({ timeout: 20_000 });

  // Zwei von drei sind erschossen worden — trotzdem ist niemand markiert.
  await expect(page.locator('.lobby__row.is-eliminated')).toHaveCount(0);
  await expect(page.locator('.lobby__row')).toHaveCount(3);
});

test('Intro: jede Runde bekommt den vollen Auftakt', async ({ page }) => {
  test.setTimeout(240_000);

  await enterArena(page, '?dev=1', 2, { sound: false, duration: 'short' });

  /*
   * Gemessen wird bis zum Schuss (`.arena__skip`) — dasselbe Maß wie beim
   * Dauer-Preset-Test. Der Auftakt liegt davor, also schlägt er voll durch.
   */
  const toShot = async (): Promise<number> => {
    const started = Date.now();
    await expect(page.locator('.arena__skip')).toBeVisible({ timeout: 90_000 });
    return Date.now() - started;
  };

  const first = await toShot();
  await expect(page.locator('.screen--result')).toBeVisible({ timeout: 90_000 });

  await page.getByRole('button', { name: 'Nächste Runde' }).click();
  await betAllAndStart(page, { players: 2 });
  const second = await toShot();

  console.log(`Runde 1 ${first} ms · Runde 2 ${second} ms (bis zum Schuss)`);

  /*
   * Frueher lief der Auftakt nur in der ersten Runde — und weil `roundNumber` nirgends
   * zurueckgesetzt wurde, danach bis zum Neuladen der Seite nie wieder (ADR-59). Beide
   * Runden haben dieselbe Show-Laenge, also darf sich nur noch Messrauschen unterscheiden.
   */
  expect(Math.abs(first - second)).toBeLessThan(3_000);
  // Und der Auftakt ist auch wirklich drin: unter 5 s ginge das nicht.
  expect(second).toBeGreaterThan(8_000);
});

test('Intro: ein Streifen in den ersten Millisekunden loescht den Auftakt nicht', async ({
  page,
}) => {
  test.setTimeout(180_000);

  await enterArena(page, '?dev=1', 2, { sound: false, duration: 'short' });

  /*
   * Der READY-Screen fordert auf, das Handy hinzulegen — wer das tut, streift den Schirm.
   * Ohne Karenzzeit war der Skip-Handler schon waehrend des Wipes scharf und der Schuetze
   * damit weg, noch bevor man ihn gesehen hatte (ADR-59).
   */
  await page.locator('.screen--arena').click({ position: { x: 100, y: 300 } });

  // Der Auftakt laeuft weiter: Bis zum Schuss vergehen weiterhin ueber acht Sekunden.
  const started = Date.now();
  await expect(page.locator('.arena__skip')).toBeVisible({ timeout: 90_000 });
  expect(Date.now() - started).toBeGreaterThan(8_000);
});

test('Intro: ein Tipp springt zur Show, nicht ins Ergebnis', async ({ page }) => {
  test.setTimeout(180_000);

  await enterArena(page, '?dev=1', 3, { sound: false, duration: 'short' });

  /*
   * Erst nach der Karenzzeit tippen (`INTRO.armMs`, 700 ms) — davor ist der Skip
   * absichtlich taub, sonst loescht ein Streifen den Auftakt. Der Schuetze steht drei
   * Sekunden, hier landet der Tipp also mitten in der Frontalansicht.
   */
  await expect(page.locator('.arena__hud')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_200);
  await page.locator('.screen--arena').click({ position: { x: 100, y: 300 } });

  /*
   * Der Beleg, dass der Tipp die **Show** startet und nicht die Runde abkürzt: Das
   * Ergebnis darf nicht sofort da sein, sondern erst nach der vollen Show.
   */
  await expect(page.locator('.screen--result')).toHaveCount(0);
  await expect(page.locator('.arena__lock')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.screen--result')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.result__headline')).toContainText('trinkt');
});
