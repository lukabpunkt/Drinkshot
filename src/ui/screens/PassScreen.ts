/**
 * Privacy-Screen (GDD §3.2 / §6.2, Roadmap M1.5).
 *
 * Vollflaeche in der Spielerfarbe mit langsam wanderndem Streifenmuster. Der Screen ist
 * 800 ms lang **taub** — sonst reicht ein Doppeltap vom vorigen Bestaetigen bis hierher
 * durch und der Nachbar sieht das Bet-UI (Audit A1, MUSS).
 */

import { COACHMARK_MS, PASS_TAP_LOCK_MS } from '@/config/rules';
import { colorById, hex, textColorOn } from '@/config/theme';
import { t } from '@/core/i18n';
import { createCoachmark } from '@/ui/components/coachmark';
import { vibrate } from '@/ui/haptics';
import type { ScreenContext, ScreenInstance } from '@/ui/router';

export function createPassScreen(ctx: ScreenContext): ScreenInstance {
  const { players, playerIndex } = ctx.fsm.context;
  const playerId = players[playerIndex];
  const player = playerId ? ctx.session.playerById(playerId) : undefined;
  const colorId = player?.colorId ?? 'red';
  const color = colorById(colorId);

  const el = document.createElement('section');
  // `is-locked` steht schon beim Mount, nicht erst in activate(): sonst gibt es ein
  // Zeitfenster, in dem der Screen ungesperrt *aussieht*, aber noch nicht reagiert.
  el.className = 'screen screen--pass is-locked';
  el.style.setProperty('--pass-color', hex(color.hex));
  el.style.setProperty('--pass-shade', hex(color.shade));
  el.style.setProperty('--pass-ink', hex(textColorOn(colorId)));

  const stripes = document.createElement('div');
  stripes.className = 'pass__stripes';
  stripes.setAttribute('aria-hidden', 'true');

  const inner = document.createElement('div');
  inner.className = 'pass__inner';

  const position = document.createElement('p');
  position.className = 'pass__position';
  position.textContent = t('pass.position', { index: playerIndex + 1, count: players.length });

  const lead = document.createElement('p');
  lead.className = 'pass__lead';
  lead.textContent = t('pass.handOver');

  const name = document.createElement('p');
  name.className = 'pass__name';
  name.textContent = player?.name ?? '';

  const instruction = document.createElement('p');
  instruction.className = 'pass__instruction';
  instruction.textContent = t('pass.tapWhenReady');

  inner.append(position, lead, name, instruction);
  el.append(stripes, inner);

  // Einmaliger Hinweis in der ersten Runde: warum das Handy überhaupt wandert.
  const coach = createCoachmark('pass', { autoDismissMs: COACHMARK_MS });
  if (coach.el) el.append(coach.el);

  /* --- Tap-Sperre --- */
  let armed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onTap = (): void => {
    if (!armed) return;
    armed = false;
    coach.dismiss();
    vibrate('tap');
    ctx.fsm.send({ type: 'tap' });
  };

  el.addEventListener('click', onTap);
  el.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onTap();
    }
  });

  // Der Screen ist selbst der Button — deshalb fokussierbar und beschriftet.
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `${t('pass.handOver')} ${player?.name ?? ''}. ${t('pass.tapWhenReady')}`);

  return {
    el,
    activate() {
      timer = globalThis.setTimeout(() => {
        armed = true;
        el.classList.remove('is-locked');
      }, PASS_TAP_LOCK_MS);
      el.focus({ preventScroll: true });
    },
    destroy() {
      coach.dismiss();
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}
