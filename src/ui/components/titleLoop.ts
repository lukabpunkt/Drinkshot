/**
 * Der laufende Shotling auf dem Titelbild (Roadmap M5.1).
 *
 * Bewusst **ohne** PIXI: Der Renderer und die Atlanten liegen im nachgeladenen
 * Arena-Chunk (ADR-36), und den für ein Vorspann-Gag zurückzuholen würde den ganzen
 * Split aufheben — der Start lädt dann wieder 159 statt 21 KB. Ein Inline-SVG mit
 * CSS-Keyframes kostet nichts, läuft auf dem Compositor und kann per Definition kein
 * Speicherleck bauen: Es gibt keinen Timer und keine Frame-Schleife, nur eine Animation,
 * die mit dem Element verschwindet (Audit A5: 10 Minuten Titelbild ohne Wachstum).
 *
 * Die Figur folgt der Rig-Spec (Art Direction §5.1) in Umrissen: dicke Outline, Chibi,
 * zwei Farben. Sie läuft von links durchs Bild, das Fadenkreuz fährt ein, es blitzt,
 * sie kippt um — und der Loop beginnt von vorn.
 */

import { hex, UI_COLORS } from '@/config/theme';

/** Länge eines Durchlaufs. Lang genug, dass der Gag nicht hektisch wirkt. */
export const TITLE_LOOP_MS = 6400;

const SHOTLING_SVG = `
<svg class="titleLoop__figure" viewBox="0 0 40 56" aria-hidden="true">
  <g class="titleLoop__body">
    <ellipse class="titleLoop__shadow" cx="20" cy="53" rx="11" ry="3"/>
    <rect x="11" y="20" width="18" height="20" rx="7"/>
    <circle cx="20" cy="13" r="11"/>
    <circle class="titleLoop__eye" cx="16" cy="12" r="2.1"/>
    <circle class="titleLoop__eye" cx="24" cy="12" r="2.1"/>
    <rect class="titleLoop__leg titleLoop__leg--l" x="13" y="39" width="5" height="12" rx="2.5"/>
    <rect class="titleLoop__leg titleLoop__leg--r" x="22" y="39" width="5" height="12" rx="2.5"/>
  </g>
</svg>`;

const RETICLE_SVG = `
<svg class="titleLoop__reticle" viewBox="0 0 48 48" aria-hidden="true">
  <circle cx="24" cy="24" r="18"/>
  <path d="M24 2v10M24 36v10M2 24h10M36 24h10"/>
</svg>`;

/**
 * Baut den Loop und gibt sein Element zurück.
 *
 * Kein `destroy`: Es hängt nichts am Element, das aufgeräumt werden müsste. Wer es aus
 * dem DOM nimmt, ist fertig.
 */
export function createTitleLoop(): HTMLElement {
  const stage = document.createElement('div');
  stage.className = 'titleLoop';
  // Reine Zierde — für Screenreader gibt es hier nichts zu holen.
  stage.setAttribute('aria-hidden', 'true');
  stage.style.setProperty('--loop-ms', `${TITLE_LOOP_MS}ms`);
  stage.style.setProperty('--loop-ink', hex(UI_COLORS.ink));
  stage.style.setProperty('--loop-accent', hex(UI_COLORS.accent));
  /*
   * Beide Figuren laufen in einer **Spur** über die volle Breite. Prozente in
   * `translateX` beziehen sich auf die eigene Breite des Elements — an der 56 px breiten
   * Figur wäre das unbrauchbar, an der Spur ist es genau die Container-Breite. Damit
   * stimmt der Weg im Portrait-Rahmen wie im Vollbild (Architektur §8).
   */
  stage.innerHTML =
    `<div class="titleLoop__track titleLoop__track--figure">${SHOTLING_SVG}</div>` +
    `<div class="titleLoop__track titleLoop__track--reticle">${RETICLE_SVG}</div>` +
    `<i class="titleLoop__flash"></i>`;
  return stage;
}
