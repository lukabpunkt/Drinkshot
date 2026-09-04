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

/** Sicherheitsabstand auf die Nennlaufzeit, bevor der Notausgang greift. */
const ANIMATION_TIMEOUT_MARGIN_MS = 400;

export interface SafeAnimateOptions {
  /**
   * Bei „Bewegung reduzieren" sofort auflösen, ohne zu animieren. Default `true`.
   * Wer selbst eine ruhige Variante anbietet (der Router macht aus dem Wipe einen Fade),
   * setzt das auf `false`.
   */
  respectReducedMotion?: boolean;
}

/**
 * `Element.animate`, aber das Versprechen löst **immer** auf.
 *
 * Zwei Fälle, in denen `await el.animate(...).finished` sonst den Ablauf dahinter
 * anhält — und beide sind keine Randfälle:
 *
 * 1. **Die API fehlt.** In jedem Zielbrowser gibt es sie, aber nicht in jsdom und nicht
 *    in sehr alten WebViews.
 * 2. **Der Tab ist im Hintergrund.** Chrome hält Animationen dann an: `playState` bleibt
 *    „running", `currentTime` bleibt bei 0, und `finished` löst nie auf. Wer während
 *    eines Screenwechsels aufs Handy angerufen wird, käme sonst zurück auf einen Screen,
 *    der sich nie wieder wechseln lässt.
 *
 * Deshalb ein Wettlauf gegen die Nennlaufzeit plus Reserve. Der Effekt läuft weiter, wenn
 * er kann — der Ablauf wartet nur nicht mehr auf ihn.
 */
export function safeAnimate(
  el: Element,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
  safeOptions: SafeAnimateOptions = {}
): Promise<void> {
  const respectReduced = safeOptions.respectReducedMotion ?? true;
  if ((respectReduced && prefersReducedMotion()) || typeof el.animate !== 'function') {
    return Promise.resolve();
  }

  try {
    const animation = el.animate(keyframes, options);
    const budget =
      Number(options.duration ?? 0) + Number(options.delay ?? 0) + ANIMATION_TIMEOUT_MARGIN_MS;

    return Promise.race([
      animation.finished.then(
        () => undefined,
        () => undefined
      ),
      new Promise<void>((resolve) => globalThis.setTimeout(resolve, budget)),
    ]);
  } catch {
    return Promise.resolve();
  }
}
