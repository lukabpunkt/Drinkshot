/**
 * Bet-Stepper (Art Direction §4.3).
 *
 * Riesige Zahl im Display-Font in Spielerfarbe mit Outline-Stroke, +/- Buttons à 72 px,
 * Long-Press mit Auto-Repeat (300 ms initial, dann 90 ms) und der Risiko-Ampel darunter,
 * damit Neulinge den Einsatz einordnen koennen.
 */

import { MAX_BET, MIN_BET, riskTier, STEPPER_REPEAT_MS } from '@/config/rules';
import { colorById, hex, type ColorId } from '@/config/theme';
import { t } from '@/core/i18n';

export interface BetStepperOptions {
  value: number;
  colorId: ColorId;
  onChange?: (value: number) => void;
}

export interface BetStepper {
  el: HTMLElement;
  getValue(): number;
  destroy(): void;
}

export function createBetStepper(options: BetStepperOptions): BetStepper {
  const color = colorById(options.colorId);
  let value = Math.min(MAX_BET, Math.max(MIN_BET, Math.round(options.value)));

  const el = document.createElement('div');
  el.className = 'stepper';
  el.style.setProperty('--stepper-color', hex(color.hex));

  const row = document.createElement('div');
  row.className = 'stepper__row';

  const minus = createStepButton('−', t('bet.decrease'));
  const plus = createStepButton('+', t('bet.increase'));

  const number = document.createElement('output');
  number.className = 'stepper__value';
  number.setAttribute('aria-live', 'polite');

  row.append(minus, number, plus);

  const risk = document.createElement('p');
  risk.className = 'stepper__risk';

  el.append(row, risk);

  const render = (punch: boolean): void => {
    number.textContent = String(value);
    number.setAttribute('aria-label', t('bet.value', { sips: value }));
    const tier = riskTier(value);
    risk.textContent = t(`bet.risk.${tier}`);
    risk.dataset.tier = tier;
    minus.disabled = value <= MIN_BET;
    plus.disabled = value >= MAX_BET;

    if (punch) {
      // Neustart der Animation erzwingen: Klasse entfernen, Reflow, wieder setzen.
      number.classList.remove('is-punched');
      void number.offsetWidth;
      number.classList.add('is-punched');
    }
  };

  const step = (delta: number): void => {
    const next = Math.min(MAX_BET, Math.max(MIN_BET, value + delta));
    if (next === value) return;
    value = next;
    render(true);
    options.onChange?.(value);
  };

  /* --- Long-Press mit Auto-Repeat --- */
  let initialTimer: ReturnType<typeof setTimeout> | undefined;
  let repeatTimer: ReturnType<typeof setInterval> | undefined;

  const stopRepeat = (): void => {
    if (initialTimer !== undefined) clearTimeout(initialTimer);
    if (repeatTimer !== undefined) clearInterval(repeatTimer);
    initialTimer = undefined;
    repeatTimer = undefined;
  };

  const startRepeat = (delta: number): void => {
    stopRepeat();
    initialTimer = globalThis.setTimeout(() => {
      repeatTimer = globalThis.setInterval(() => step(delta), STEPPER_REPEAT_MS.interval);
    }, STEPPER_REPEAT_MS.initial);
  };

  const bind = (button: HTMLButtonElement, delta: number): void => {
    button.addEventListener('click', () => step(delta));
    button.addEventListener('pointerdown', () => startRepeat(delta));
    button.addEventListener('pointerup', stopRepeat);
    button.addEventListener('pointercancel', stopRepeat);
    button.addEventListener('pointerleave', stopRepeat);
  };

  bind(minus, -1);
  bind(plus, +1);

  // Tastatur (Desktop, A11y)
  el.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      step(+1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    }
  });

  render(false);

  return {
    el,
    getValue: () => value,
    destroy: () => {
      stopRepeat();
      globalThis.removeEventListener('pointerup', stopRepeat);
    },
  };
}

function createStepButton(glyph: string, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'stepper__btn';
  button.textContent = glyph;
  button.setAttribute('aria-label', label);
  return button;
}
