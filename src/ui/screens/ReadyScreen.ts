/**
 * Start-Screen zwischen dem letzten Einsatz und der Arena (GDD §6, Roadmap M5b).
 *
 * Bis hierher wandert das Handy von Hand zu Hand. Dieser Screen ist der Moment, in dem
 * es aufhört zu wandern und in die Mitte gelegt wird — vorher startete die Show noch in
 * der Hand des letzten Spielers, und niemand sah den Anfang.
 *
 * Was hier **nicht** steht: Einsätze. Ab dem Bestätigen ist keine Zahl mehr sichtbar
 * (Audit A1, MUSS) — und dieser Screen ist die neue Stelle, an der man das brechen
 * könnte.
 */

import { hex, UI_COLORS } from '@/config/theme';
import { READY_ARM_MS } from '@/config/rules';
import { t } from '@/core/i18n';
import { createButton, createChip } from '@/ui/components/button';
import { createPlayerBadge } from '@/ui/components/badge';
import { vibrate } from '@/ui/haptics';
import type { ScreenContext, ScreenInstance } from '@/ui/router';

export function createReadyScreen(ctx: ScreenContext): ScreenInstance {
  const el = document.createElement('section');
  /*
   * `is-locked` steht schon beim Mount, nicht erst in `activate()` — sonst gäbe es ein
   * Zeitfenster, in dem der Knopf bedienbar *aussieht*, aber noch nicht reagiert. Dasselbe
   * Muster wie beim Pass-Screen.
   */
  el.className = 'screen screen--ready is-locked';

  const { settings } = ctx.session.state;
  const players = ctx.fsm.context.players.length
    ? ctx.fsm.context.players
    : ctx.session.activePlayers().map((player) => player.id);

  el.style.setProperty('--ready-color', hex(UI_COLORS.accent));

  const headline = document.createElement('h1');
  headline.className = 'ready__headline';
  headline.textContent = t('ready.headline');

  /* --- Wer mitspielt: nur Farbe und Symbol, keine Namen-Wand --- */
  const roster = document.createElement('div');
  roster.className = 'ready__roster';
  roster.setAttribute('aria-label', t('ready.players', { count: players.length }));
  for (const playerId of players) {
    const player = ctx.session.playerById(playerId);
    if (!player) continue;
    roster.append(createPlayerBadge({ colorId: player.colorId, size: 'sm' }));
  }

  /* --- Der eigentliche Zweck dieses Screens --- */
  const putDown = document.createElement('p');
  putDown.className = 'ready__putDown';
  putDown.textContent = t('ready.putDown');

  /* --- Woran man noch einmal erinnert wird, bevor es losgeht --- */
  const chips = document.createElement('div');
  chips.className = 'ready__chips';
  chips.append(
    createChip({ label: t('lobby.mode'), value: t(`mode.${settings.mode}`) }),
    createChip({
      label: t('lobby.duration'),
      value: t(`settings.durationOption.${settings.duration}`),
    })
  );

  const modeHint = document.createElement('p');
  modeHint.className = 'ready__modeHint';
  modeHint.textContent = t(`mode.${settings.mode}Hint`);

  const start = createButton({
    label: t('ready.start'),
    variant: 'primary',
    wobble: true,
    className: 'btn--block ready__start',
    disabled: true,
    onClick: () => {
      if (start.disabled) return;
      start.disabled = true;
      vibrate('confirm');
      ctx.fsm.send({ type: 'startShow' });
    },
  });

  el.append(headline, roster, putDown, chips, modeHint, start);

  let armTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    el,
    activate() {
      armTimer = globalThis.setTimeout(() => {
        start.disabled = false;
        el.classList.remove('is-locked');
        start.focus({ preventScroll: true });
      }, READY_ARM_MS);
    },
    destroy() {
      if (armTimer !== undefined) globalThis.clearTimeout(armTimer);
    },
  };
}
