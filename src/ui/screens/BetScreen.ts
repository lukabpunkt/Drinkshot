/**
 * Bet-Screen (GDD §3.2 / §6.3, Roadmap M1.6).
 *
 * Stepper 1–10 mit Default 3. Nach dem Bestaetigen faehrt die Zahl in den Tresor und der
 * Einsatz ist **nirgends mehr sichtbar**, bis die Runde aufgeloest ist (Audit A1, MUSS).
 * Beim letzten Spieler loest `confirm` in der FSM die Ziehung aus (ADR-2).
 */

import { COACHMARK_MS, DEFAULT_BET } from '@/config/rules';
import { colorById, hex, MOTION } from '@/config/theme';
import { t } from '@/core/i18n';
import { safeAnimate } from '@/ui/animate';
import { createButton, createIconButton, ICON_CLOSE } from '@/ui/components/button';
import { createCoachmark } from '@/ui/components/coachmark';
import { createBetStepper } from '@/ui/components/stepper';
import { vibrate } from '@/ui/haptics';
import type { ScreenContext, ScreenInstance } from '@/ui/router';

export function createBetScreen(ctx: ScreenContext): ScreenInstance {
  const { players, playerIndex } = ctx.fsm.context;
  const playerId = players[playerIndex];
  const player = playerId ? ctx.session.playerById(playerId) : undefined;
  const colorId = player?.colorId ?? 'red';

  const el = document.createElement('section');
  el.className = 'screen screen--bet';
  el.style.setProperty('--bet-color', hex(colorById(colorId).hex));

  const headline = document.createElement('h1');
  headline.className = 'bet__headline';
  headline.textContent = t('bet.headline');

  const who = document.createElement('p');
  who.className = 'bet__who';
  who.textContent = player?.name ?? '';

  const stepper = createBetStepper({ value: DEFAULT_BET, colorId });

  const hint = document.createElement('p');
  hint.className = 'bet__hint';
  hint.textContent = t('bet.hint');

  const confirm = createButton({
    label: t('bet.confirm'),
    variant: 'primary',
    className: 'btn--block bet__confirm',
  });

  const exit = createIconButton({
    icon: ICON_CLOSE,
    ariaLabel: t('nav.abortAria'),
    className: 'screen__exit',
    onClick: ctx.abortRound,
  });

  el.append(exit, who, headline, stepper.el, hint, confirm);

  // Einmaliger Hinweis in der ersten Runde: was der Einsatz eigentlich bedeutet.
  const coach = createCoachmark('bet', { autoDismissMs: COACHMARK_MS });
  if (coach.el) el.append(coach.el);

  let submitted = false;

  const submit = async (): Promise<void> => {
    if (submitted) return;
    submitted = true;
    confirm.disabled = true;
    vibrate('confirm');

    /*
     * "Die Zahl verschwindet im Tresor": schrumpft und faellt nach unten weg.
     *
     * `safeAnimate`, nicht `.finished`: Im Hintergrund-Tab haelt Chrome Animationen an,
     * das Versprechen loeste nie auf — und weil `submitted` schon gesetzt ist, waere der
     * Knopf danach tot und die Runde nicht mehr zu bestaetigen. Wer waehrend des Tippens
     * angerufen wird, saesse fest.
     */
    const value = stepper.el.querySelector<HTMLElement>('.stepper__value');
    if (value) {
      await safeAnimate(
        value,
        [
          { transform: 'scale(1)', opacity: 1 },
          { transform: 'scale(1.18)', opacity: 1, offset: 0.35 },
          { transform: 'scale(0.1) translateY(90px)', opacity: 0 },
        ],
        { duration: MOTION.base, easing: 'cubic-bezier(.5,-0.3,.7,1)', fill: 'forwards' }
      );
    }

    coach.dismiss();
    ctx.fsm.send({ type: 'confirm', sips: stepper.getValue() });
  };

  confirm.addEventListener('click', () => void submit());

  return {
    el,
    activate() {
      confirm.focus({ preventScroll: true });
    },
    destroy() {
      coach.dismiss();
      stepper.destroy();
    },
  };
}
