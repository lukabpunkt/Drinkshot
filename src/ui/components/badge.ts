/**
 * Player-Badge (Art Direction §4.2).
 *
 * Kreis in Spielerfarbe mit `ink`-Outline und dem Symbol der Farbe — das Symbol ist der
 * Farbenblind-Fallback (GDD §3.1) und muss deshalb ueberall mitlaufen, wo Farbe Identitaet traegt.
 * Der Shotling-Kopf statt des reinen Kreises kommt in M2, sobald der Atlas existiert.
 */

import { colorById, hex, textColorOn, type ColorId, type SymbolId } from '@/config/theme';

const SYMBOL_PATHS: Record<SymbolId, string> = {
  circle: '<circle cx="12" cy="12" r="7.5"/>',
  triangle: '<path d="M12 4.2 20 19H4z"/>',
  square: '<rect x="5" y="5" width="14" height="14" rx="2.5"/>',
  star: '<path d="m12 3.6 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.9l6-.8z"/>',
  diamond: '<path d="m12 3.5 8 8.5-8 8.5-8-8.5z"/>',
  heart: '<path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9z"/>',
  bolt: '<path d="M13.6 3 6 13.4h4.6L9.8 21l7.8-10.6h-4.7z"/>',
  cross: '<path d="M9.6 3h4.8v6.6H21v4.8h-6.6V21H9.6v-6.6H3V9.6h6.6z"/>',
};

/** Inline-SVG des Farb-Symbols. */
export function symbolSvg(symbol: SymbolId, fill: string): string {
  return `<svg viewBox="0 0 24 24" fill="${fill}" aria-hidden="true">${SYMBOL_PATHS[symbol]}</svg>`;
}

export interface PlayerBadgeOptions {
  colorId: ColorId;
  /** Wird unter dem Kreis angezeigt, wenn gesetzt. */
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Ausgeschieden (Sudden Death) — Badge wird gedimmt. */
  eliminated?: boolean;
}

export function createPlayerBadge(options: PlayerBadgeOptions): HTMLElement {
  const color = colorById(options.colorId);

  const wrapper = document.createElement('div');
  wrapper.className = `badge badge--${options.size ?? 'md'}`;
  if (options.eliminated) wrapper.classList.add('badge--eliminated');

  const disc = document.createElement('span');
  disc.className = 'badge__disc';
  disc.style.setProperty('--badge-color', hex(color.hex));
  disc.style.setProperty('--badge-shade', hex(color.shade));
  disc.innerHTML = symbolSvg(color.symbol, hex(textColorOn(options.colorId)));
  wrapper.append(disc);

  if (options.name !== undefined) {
    const name = document.createElement('span');
    name.className = 'badge__name';
    name.textContent = options.name;
    wrapper.append(name);
  }

  return wrapper;
}
