/**
 * Sticker-Button (Art Direction §4.1).
 *
 * 64 px hoch, 20 px Radius, 3 px `ink`-Outline, 6 px Bottom-Kante in der Schattenfarbe.
 * Press-State drueckt den Button 4 px nach unten und die Kante auf 2 px — das ist der
 * gesamte Trick, warum er sich wie ein echter Knopf anfuehlt.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonOptions {
  label: string;
  variant?: ButtonVariant;
  onClick?: (event: MouseEvent) => void;
  /** Inline-SVG-Markup, wird vor dem Label eingesetzt. */
  icon?: string;
  /** Wenn das Label nicht selbsterklaerend ist (Icon-only). */
  ariaLabel?: string;
  /** Idle-Wobble alle 4 s — nur fuer den Primary-CTA. */
  wobble?: boolean;
  /** Zusaetzliche Klassen, z. B. fuer Breite. */
  className?: string;
  disabled?: boolean;
}

export function createButton(options: ButtonOptions): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `btn btn--${options.variant ?? 'primary'}`;
  if (options.className) button.classList.add(...options.className.split(' '));
  if (options.wobble) button.classList.add('btn--wobble');
  if (options.disabled) button.disabled = true;
  if (options.ariaLabel) button.setAttribute('aria-label', options.ariaLabel);

  if (options.icon) {
    const icon = document.createElement('span');
    icon.className = 'btn__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = options.icon;
    button.append(icon);
  }

  const label = document.createElement('span');
  label.className = 'btn__label';
  label.textContent = options.label;
  button.append(label);

  if (options.onClick) button.addEventListener('click', options.onClick);

  return button;
}

/** Setzt das Label nachtraeglich (z. B. Sound-Toggle). */
export function setButtonLabel(button: HTMLButtonElement, label: string): void {
  const target = button.querySelector('.btn__label');
  if (target) target.textContent = label;
}

/**
 * Chip mit Label und Wert — fuer Modus und Dauer in der Lobby (Roadmap M1.4).
 */
export interface ChipOptions {
  label: string;
  value: string;
  onClick?: () => void;
  ariaLabel?: string;
}

export function createChip(options: ChipOptions): HTMLButtonElement {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  if (options.ariaLabel) chip.setAttribute('aria-label', options.ariaLabel);

  const label = document.createElement('span');
  label.className = 'chip__label';
  label.textContent = options.label;

  const value = document.createElement('span');
  value.className = 'chip__value';
  value.textContent = options.value;

  chip.append(label, value);
  if (options.onClick) chip.addEventListener('click', options.onClick);
  return chip;
}

/**
 * Ikonen-Knopf am Bildschirmrand — Heimweg und Rundenabbruch (ADR-55).
 *
 * Bewusst kein Sticker-Button: Er soll erreichbar sein, aber nicht mit dem CTA um
 * Aufmerksamkeit ringen. Volle 44-px-Trefferflaeche, Glyphe deutlich kleiner.
 */
export function createIconButton(options: {
  icon: string;
  ariaLabel: string;
  className?: string;
  onClick: () => void;
}): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-btn';
  if (options.className) button.classList.add(...options.className.split(' '));
  button.setAttribute('aria-label', options.ariaLabel);
  button.innerHTML = options.icon;
  button.addEventListener('click', options.onClick);
  return button;
}

export const ICON_HOME =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 11.5 12 4l8 7.5M6.5 10v9h11v-9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';

export const ICON_CLOSE =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6 18 18M18 6 6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>';
