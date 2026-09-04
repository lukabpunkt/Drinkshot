/**
 * Gemeinsame Schritte für die E2E-Tests.
 *
 * Die Einsatz-Schleife („Pass antippen → Zahl setzen → bestätigen") stand vorher fünfmal
 * im Code — in `flow.spec`, dreimal inline in `show.spec`, in `a11y.spec` und in
 * `perf.spec`. Als der Start-Screen dazukam, hätten alle fünf denselben Klick gebraucht.
 * Deshalb liegt der Ablauf jetzt an einer Stelle.
 */

import { expect, type Page } from '@playwright/test';

/**
 * Die Show dauert 15 s plus Todesanimation und Wipes. Auf einem Runner ohne GPU klemmt
 * PIXI lange Frames ab und die Show läuft gedehnt — deshalb reichlich Luft.
 */
export const ARENA_TIMEOUT = 60_000;

/** Setzt localStorage zurück und quittiert den 18+-Hinweis vorab. */
export async function prepare(page: Page, settings?: Record<string, unknown>): Promise<void> {
  await page.addInitScript(
    ([json]) => {
      /*
       * Nur beim allerersten Laden aufräumen. Das Skript läuft bei **jeder** Navigation —
       * ohne die Sperre würde ein `page.reload()` im Test genau die Persistenz zerstören,
       * die er prüfen soll.
       */
      if (!window.sessionStorage.getItem('e2e-initialised')) {
        window.sessionStorage.setItem('e2e-initialised', '1');
        window.localStorage.clear();
        if (json) window.localStorage.setItem('drinkshot.session.v1', json);
      }
      window.localStorage.setItem('drinkshot.disclaimer.v1', '1');
    },
    [settings ? JSON.stringify({ players: [], rounds: [], settings }) : '']
  );
}

/**
 * Titel → Lobby → gewünschte Spielerzahl.
 *
 * Der Screen legt seine Startspieler erst in `activate()` an — also **nach** dem Wipe.
 * Wer vorher zählt, sieht null Zeilen, klickt „Spieler hinzufügen" und bekommt kurz
 * darauf die Startspieler obendrauf: Aus zwei gewünschten werden drei. Auf einem
 * schnellen Rechner fällt das nie auf, auf einem ausgelasteten CI-Runner jedes Mal.
 *
 * Deshalb zuerst abwarten, dass die Lobby ihre Zeilen hat — und am Ende die Zahl
 * zusichern, damit ein Fehler hier auffliegt und nicht erst drei Screens später.
 */
export async function enterLobby(page: Page, players: number): Promise<void> {
  await page.getByRole('button', { name: 'Spielen' }).click();
  await expect(page.locator('.screen--lobby')).toBeVisible();
  await expect(page.locator('.lobby__row')).not.toHaveCount(0);

  const add = page.getByRole('button', { name: 'Spieler hinzufügen' });
  while ((await page.locator('.lobby__row').count()) < players) await add.click();

  await expect(page.locator('.lobby__row')).toHaveCount(players);
}

/** Wartet die 800-ms-Sperre ab und tippt den Privacy-Screen an. */
export async function tapPass(page: Page): Promise<void> {
  const pass = page.locator('.screen--pass');
  await pass.waitFor({ timeout: 20_000 });
  await expect(pass).not.toHaveClass(/is-locked/, { timeout: 10_000 });
  await pass.click();
  await page.locator('.screen--bet').waitFor({ timeout: 20_000 });
}

/** Stellt den Stepper auf den gewünschten Wert und bestätigt. */
export async function placeBet(page: Page, sips?: number): Promise<void> {
  if (sips !== undefined) {
    const current = Number(await page.locator('.stepper__value').textContent());
    const delta = sips - current;
    const step = page.getByRole('button', {
      name: delta > 0 ? 'Einsatz erhöhen' : 'Einsatz senken',
    });
    for (let i = 0; i < Math.abs(delta); i++) await step.click();
    await expect(page.locator('.stepper__value')).toHaveText(String(sips));
  }
  await page.getByRole('button', { name: 'Bestätigen & verstecken' }).click();
}

/**
 * Drückt den Start-Knopf auf dem READY-Screen.
 *
 * Der Knopf ist `READY_ARM_MS` lang taub — er sitzt an derselben Stelle wie das
 * „Bestätigen & verstecken" davor, und ohne Sperre reichte ein Doppeltap durch.
 */
export async function startShow(page: Page): Promise<void> {
  const ready = page.locator('.screen--ready');
  await ready.waitFor({ timeout: 20_000 });
  await expect(ready).not.toHaveClass(/is-locked/, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Los!' }).click();
}

/**
 * Setzt für alle Spieler und startet die Show. Endet, sobald die Arena steht.
 *
 * `bets` gibt die Einsätze vor; `players` allein lässt den Default (3) stehen — das spart
 * in Tests, die nur in die Arena wollen, ein paar Dutzend Klicks.
 */
export async function betAllAndStart(
  page: Page,
  options: { bets?: number[]; players?: number } = {}
): Promise<void> {
  const count = options.bets?.length ?? options.players ?? 0;
  for (let i = 0; i < count; i++) {
    await tapPass(page);
    await placeBet(page, options.bets?.[i]);
  }
  await startShow(page);
  await page.locator('.screen--arena').waitFor({ timeout: 20_000 });
  await expect(page.locator('.screen--arena')).not.toHaveClass(/is-loading/, {
    timeout: 20_000,
  });
}
