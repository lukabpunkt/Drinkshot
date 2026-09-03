/**
 * Bet-Screen (GDD §3.2 / §6.3, Roadmap M1.6).
 *
 * Stepper 1–10 mit Default 3. Nach dem Bestaetigen faehrt die Zahl in den Tresor und der
 * Einsatz ist **nirgends mehr sichtbar**, bis die Runde aufgeloest ist (Audit A1, MUSS).
 * Beim letzten Spieler loest `confirm` in der FSM die Ziehung aus (ADR-2).
 */

import { DEFAULT_BET } from '@/config/rules';
import { colorById, hex, MOTION } from '@/config/theme';
import { t } from '@/core/i18n';
import { createButton } from '@/ui/components/button';
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

  el.append(who, headline, stepper.el, hint, confirm);

  let submitted = false;

  const submit = async (): Promise<void> => {
    if (submitted) return;
    submitted = true;
    confirm.disabled = true;
    vibrate('confirm');

    // "Die Zahl verschwindet im Tresor": schrumpft und faellt nach unten weg.
    const value = stepper.el.querySelector<HTMLElement>('.stepper__value');
    if (value && !prefersReducedMotion()) {
      await value.animate(
        [
          { transform: 'scale(1)', opacity: 1 },
          { transform: 'scale(1.18)', opacity: 1, offset: 0.35 },
          { transform: 'scale(0.1) translateY(90px)', opacity: 0 },
        ],
        { duration: MOTION.base, easing: 'cubic-bezier(.5,-0.3,.7,1)', fill: 'forwards' }
      ).finished;
    }

    ctx.fsm.send({ type: 'confirm', sips: stepper.getValue() });
  };

  confirm.addEventListener('click', () => void submit());

  return {
    el,
    activate() {
      confirm.focus({ preventScroll: true });
    },
    destroy() {
      stepper.destroy();
    },
  };
}

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
