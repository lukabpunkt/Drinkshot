/**
 * Arena — in M1 bewusst nur ein **Platzhalter** (Roadmap M1.7).
 *
 * Schwarzer Screen, 3 s Countdown, dann "SHOT!" und der Name des Opfers. Das Opfer steht
 * zu diesem Zeitpunkt laengst fest: die FSM hat beim letzten `confirm` gezogen (ADR-2).
 * Dieser Screen liest nur — er entscheidet nichts.
 *
 * TODO(M2): PIXI-Canvas einhaengen (`game/ArenaApp.ts`), Preload waehrend BET.
 * TODO(M3): ShowDirector, Scope, Choreografie, echter Schuss; Wake-Lock aktivieren.
 */

import { colorById, hex } from '@/config/theme';
import { t } from '@/core/i18n';
import { vibrate } from '@/ui/haptics';
import type { ScreenContext, ScreenInstance } from '@/ui/router';

const COUNTDOWN_FROM = 3;
const TICK_MS = 1000;
const SHOT_HOLD_MS = 1400;

/**
 * Wake-Lock-Stub (GDD §6). Wird in M3 scharf geschaltet, wenn die Show wirklich
 * 10–22 s ohne Eingabe laeuft. Hier schon gekapselt, damit M3 nur noch aufrufen muss.
 */
function requestWakeLock(): () => void {
  // TODO(M3): navigator.wakeLock.request('screen') anfordern und bei exit erneuern.
  return () => {
    /* noop bis M3 */
  };
}

export function createArenaScreen(ctx: ScreenContext): ScreenInstance {
  const round = ctx.fsm.context.round;
  const victim = round ? ctx.session.playerById(round.victimId) : undefined;

  const el = document.createElement('section');
  el.className = 'screen screen--arena';

  const hud = document.createElement('p');
  hud.className = 'arena__hud';
  hud.textContent = t('arena.hud', {
    round: ctx.fsm.context.roundNumber + 1,
    count: ctx.fsm.context.players.length,
  });

  const stage = document.createElement('div');
  stage.className = 'arena__stage';

  const countdown = document.createElement('p');
  countdown.className = 'arena__countdown';
  countdown.setAttribute('aria-live', 'assertive');

  const shot = document.createElement('p');
  shot.className = 'arena__shot';
  shot.textContent = t('arena.shot');
  shot.hidden = true;

  const victimName = document.createElement('p');
  victimName.className = 'arena__victim';
  victimName.hidden = true;
  if (victim) {
    victimName.textContent = victim.name;
    victimName.style.setProperty('--victim-color', hex(colorById(victim.colorId).hex));
  }

  const note = document.createElement('p');
  note.className = 'arena__note';
  note.textContent = t('arena.placeholder');

  stage.append(countdown, shot, victimName);
  el.append(hud, stage, note);

  const timers: ReturnType<typeof setTimeout>[] = [];
  let releaseWakeLock: (() => void) | undefined;
  let finished = false;

  const finish = (): void => {
    if (finished) return;
    finished = true;
    ctx.fsm.send({ type: 'showFinished' });
  };

  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'arena__skip';
  skip.textContent = t('arena.skip');
  skip.hidden = true;
  skip.addEventListener('click', finish);
  el.append(skip);

  return {
    el,
    activate() {
      releaseWakeLock = requestWakeLock();

      let remaining = COUNTDOWN_FROM;
      countdown.textContent = String(remaining);

      const tick = (): void => {
        remaining -= 1;
        if (remaining > 0) {
          countdown.textContent = String(remaining);
          countdown.classList.remove('is-punched');
          void countdown.offsetWidth;
          countdown.classList.add('is-punched');
          timers.push(globalThis.setTimeout(tick, TICK_MS));
          return;
        }

        countdown.hidden = true;
        shot.hidden = false;
        victimName.hidden = false;
        skip.hidden = false;
        vibrate('shot');
        timers.push(globalThis.setTimeout(finish, SHOT_HOLD_MS));
      };

      timers.push(globalThis.setTimeout(tick, TICK_MS));
    },
    destroy() {
      for (const timer of timers) clearTimeout(timer);
      releaseWakeLock?.();
    },
  };
}
