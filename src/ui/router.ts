/**
 * Screen-Router.
 *
 * Mountet genau einen Screen in den Host und wechselt mit einem **diagonalen Farb-Wipe**
 * (Art Direction §4.6: 320 ms, nie Cross-Fade). Richtung ergibt sich aus der
 * Screen-Reihenfolge: vorwaerts von rechts, zurueck von links.
 * Bei `prefers-reduced-motion` wird aus dem Wipe ein kurzer Fade (§9).
 */

import { MOTION, hex, UI_COLORS } from '@/config/theme';
import type { Fsm } from '@/core/fsm';
import type { SessionStore } from '@/core/session';

export const SCREEN_ORDER = ['title', 'lobby', 'pass', 'bet', 'arena', 'result'] as const;
export type ScreenId = (typeof SCREEN_ORDER)[number];

export interface ScreenInstance {
  /** Das Wurzelelement des Screens. */
  el: HTMLElement;
  /** Laeuft, nachdem der Wipe den Screen freigegeben hat (Fokus, Animationen, Timer). */
  activate?(): void;
  /** Aufraeumen: Timer, Listener, Animationen. */
  destroy?(): void;
}

export interface ScreenContext {
  fsm: Fsm;
  session: SessionStore;
  router: Router;
  dev: boolean;
}

export type ScreenFactory = (ctx: ScreenContext) => ScreenInstance;

export interface NavigateOptions {
  direction?: 'forward' | 'back';
  /** Farbe des Wipes (CSS-Farbe). Default: `accent`. */
  color?: string;
}

export interface Router {
  register(id: ScreenId, factory: ScreenFactory): void;
  go(id: ScreenId, options?: NavigateOptions): Promise<void>;
  readonly current: ScreenId | null;
  /** Baut den aktuellen Screen neu auf (z. B. nach einem Sprachwechsel). */
  refresh(): Promise<void>;
}

export interface RouterOptions {
  host: HTMLElement;
  context: Omit<ScreenContext, 'router'>;
}

import { prefersReducedMotion } from '@/ui/animate';

/**
 * Setzt den Fokus auf den frisch gemounteten Screen (Audit A5).
 *
 * Ohne das bleibt der Fokus dort, wo der alte Screen war — nach dem Austausch also im
 * Nichts, und die Tab-Reihenfolge beginnt wieder ganz oben beim Dokument. Ein Screenreader
 * liest ausserdem nichts vor, weil sich für ihn nur DOM ausgetauscht hat.
 *
 * Der Container bekommt `tabindex="-1"`: fokussierbar per Skript, aber nicht per Tab —
 * er soll die Reihenfolge anführen, nicht selbst eine Station sein. `preventScroll`, weil
 * die Screens ohnehin bildschirmfüllend sind und ein Sprung nur ruckelt.
 */
function focusScreen(el: HTMLElement): void {
  /*
   * Nur setzen, wenn der Screen nicht selbst ein Bedienelement ist: Der Pass-Screen ist
   * eine grosse Taste mit `tabindex="0"` — auf -1 gezogen wäre er per Tastatur nicht mehr
   * erreichbar.
   */
  if (!el.hasAttribute('tabindex')) el.tabIndex = -1;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

/** Leitet die Richtung aus der Position in `SCREEN_ORDER` ab. */
function directionBetween(from: ScreenId | null, to: ScreenId): 'forward' | 'back' {
  if (from === null) return 'forward';
  return SCREEN_ORDER.indexOf(to) >= SCREEN_ORDER.indexOf(from) ? 'forward' : 'back';
}

export function createRouter(options: RouterOptions): Router {
  const { host } = options;
  const factories = new Map<ScreenId, ScreenFactory>();

  let current: ScreenId | null = null;
  let instance: ScreenInstance | null = null;
  /** Serialisiert Navigationen, damit sich zwei Wipes nie ueberlagern. */
  let queue: Promise<void> = Promise.resolve();

  const mount = (id: ScreenId): void => {
    const factory = factories.get(id);
    if (!factory) throw new Error(`Kein Screen registriert fuer "${id}"`);

    instance?.destroy?.();
    host.replaceChildren();

    instance = factory({ ...options.context, router });
    instance.el.dataset.screen = id;
    host.append(instance.el);
    current = id;
    focusScreen(instance.el);
  };

  /**
   * Deckt den Screen mit einem schraegen Farbstreifen zu, tauscht den Inhalt aus
   * und gibt ihn wieder frei. Eine Animation, zwei Haelften à 160 ms.
   */
  const wipe = async (id: ScreenId, opts: NavigateOptions): Promise<void> => {
    const direction = opts.direction ?? directionBetween(current, id);
    const color = opts.color ?? hex(UI_COLORS.accent);
    const half = MOTION.wipeMs / 2;

    const overlay = document.createElement('div');
    overlay.className = 'wipe';
    overlay.style.setProperty('--wipe-color', color);
    overlay.setAttribute('aria-hidden', 'true');
    host.append(overlay);

    const reduced = prefersReducedMotion();
    const enter = reduced
      ? [{ opacity: 0 }, { opacity: 1 }]
      : direction === 'forward'
        ? [{ transform: 'translate3d(115%,0,0)' }, { transform: 'translate3d(0,0,0)' }]
        : [{ transform: 'translate3d(-115%,0,0)' }, { transform: 'translate3d(0,0,0)' }];
    const leave = reduced
      ? [{ opacity: 1 }, { opacity: 0 }]
      : direction === 'forward'
        ? [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(-115%,0,0)' }]
        : [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(115%,0,0)' }];

    await overlay.animate(enter, { duration: half, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' })
      .finished;

    mount(id);

    await overlay.animate(leave, { duration: half, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' })
      .finished;

    overlay.remove();
    instance?.activate?.();
  };

  const router: Router = {
    register(id, factory) {
      factories.set(id, factory);
    },

    go(id, navOptions = {}) {
      queue = queue.then(async () => {
        if (current === null) {
          // Erster Screen: kein Wipe, sonst blitzt die Farbe beim Start auf.
          mount(id);
          instance?.activate?.();
          return;
        }
        if (current === id) return;
        await wipe(id, navOptions);
      });
      return queue;
    },

    refresh() {
      queue = queue.then(() => {
        if (current === null) return;
        const id = current;
        mount(id);
        instance?.activate?.();
      });
      return queue;
    },

    get current() {
      return current;
    },
  };

  return router;
}
