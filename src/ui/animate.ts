/**
 * Kleine DOM-Animationshelfer für die Menü-Screens (Roadmap M5.3).
 *
 * PIXI und GSAP bleiben in der Arena — hier reicht `Element.animate` und ein
 * `requestAnimationFrame`-Zähler. Das spart den Renderer im Einstiegs-Chunk (ADR-36).
 *
 * Alles hier respektiert `prefers-reduced-motion`: Dann steht der Endwert sofort da,
 * statt zu laufen (Audit A5).
 */

import { UI_TIMING } from '@/config/theme';

/** Nutzer hat "Bewegung reduzieren" gesetzt — dann keine Zeitschleifen (Audit A5). */
export function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Zählt eine Zahl von 0 auf `value` hoch.
 *
 * Die Zahl ist das Ergebnis — sie soll ankommen, nicht nur dastehen. `easeOut` bremst
 * kurz vor Schluss, damit der Endwert lesbar landet statt durchzurauschen.
 *
 * Gibt eine Abbruchfunktion zurück: Wird der Screen vorher verlassen, läuft kein
 * verwaister Frame-Callback weiter.
 */
export function countUp(
  el: HTMLElement,
  value: number,
  options: { durationMs?: number; delayMs?: number; format?: (n: number) => string } = {}
): () => void {
  const format = options.format ?? ((n: number) => String(n));
  const final = format(value);

  /*
   * Der Endwert steht sofort als zugänglicher Name da. Sonst läse ein Screenreader die
   * Zwischenstände mit — oder, schlimmer, einen zufälligen davon. Sichtbar zählt es
   * trotzdem hoch: Die Animation ist für die Augen, die Zahl für alle.
   */
  el.setAttribute('aria-label', final);

  if (prefersReducedMotion() || value === 0) {
    el.textContent = final;
    return () => undefined;
  }

  const duration = options.durationMs ?? UI_TIMING.countUpMs;
  const delay = options.delayMs ?? 0;
  el.textContent = format(0);

  let frame = 0;
  let started = 0;

  const step = (now: number): void => {
    if (started === 0) started = now;
    const elapsed = now - started - delay;
    if (elapsed < 0) {
      frame = requestAnimationFrame(step);
      return;
    }
    const progress = Math.min(1, elapsed / duration);
    // easeOutCubic — schnell los, sanft ins Ziel.
    const eased = 1 - (1 - progress) ** 3;
    // Der letzte Frame setzt den formatierten Endwert, nicht die gerundete Näherung.
    el.textContent = progress < 1 ? format(Math.round(value * eased)) : final;
    if (progress < 1) frame = requestAnimationFrame(step);
  };

  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

/**
 * Lässt einen Balken auf seine Breite wachsen.
 *
 * Über `--score-fill` statt über `width`, weil die Farbe im selben Custom-Property-Satz
 * steckt und der Balken so ohne Layout-Rechnung animiert.
 */
export function growBar(el: HTMLElement, percent: number, delayMs = 0): void {
  const target = `${percent}%`;
  if (prefersReducedMotion()) {
    el.style.setProperty('--score-fill', target);
    return;
  }
  el.style.setProperty('--score-fill', '0%');
  // Erst im nächsten Frame setzen, sonst sieht der Browser nur den Endwert.
  setTimeout(() => el.style.setProperty('--score-fill', target), Math.max(delayMs, 16));
}

/**
 * `Element.animate`, aber ohne Absturz, wenn es die Web Animations API nicht gibt.
 *
 * In jedem Zielbrowser gibt es sie — aber nicht in jsdom, und nicht in sehr alten
 * WebViews. Eine fehlende Schmuck-Animation darf keinen Ablauf abbrechen, und genau das
 * passiert, wenn irgendwo `await el.animate(...).finished` steht.
 *
 * Fehlt sie, ist der Effekt sofort fertig: Das Versprechen löst direkt auf, der Aufrufer
 * macht weiter, und das Ergebnis sieht aus wie bei „Bewegung reduzieren".
 */
export function safeAnimate(
  el: Element,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions
): Promise<void> {
  if (prefersReducedMotion() || typeof el.animate !== 'function') return Promise.resolve();
  try {
    return el.animate(keyframes, options).finished.then(
      () => undefined,
      () => undefined
    );
  } catch {
    return Promise.resolve();
  }
}
