/**
 * PIXI-Lifecycle (Architektur §7).
 *
 * **Ein** `Application`-Objekt für die gesamte Session: es wird beim ersten Betreten der
 * Arena erzeugt und danach wiederverwendet. Zwischen den Runden wird nur die Bühne geleert,
 * nie die App.
 *
 * Eine Uhr: der PIXI-Ticker treibt GSAP (§7.7). Zwei RAF-Schleifen nebeneinander würden
 * bei Slow-Mo und Hit-Stop auseinanderlaufen.
 */

import { Application, Assets, Container, type Spritesheet } from 'pixi.js';
// PIXI erzeugt Shader- und Uniform-Code per `new Function`. Unsere CSP verbietet
// `unsafe-eval` (Architektur §10), deshalb der eval-freie Pfad — ohne ihn stirbt die
// Arena beim ersten Render mit "Current environment does not allow unsafe-eval".
import 'pixi.js/unsafe-eval';
import gsap from 'gsap';
import { ARENA, RENDER } from '@/config/theme';

export interface ArenaAssets {
  shotlings: Spritesheet;
  props: Spritesheet;
}

/** Welche Auflösung des Atlas passt zum Gerät? */
function atlasSuffix(): '@1x' | '@2x' {
  return (globalThis.devicePixelRatio ?? 1) > 1.25 ? '@2x' : '@1x';
}

function atlasUrl(name: string): string {
  return `${import.meta.env.BASE_URL}atlas/${name}${atlasSuffix()}.json`;
}

let assetsPromise: Promise<ArenaAssets> | undefined;
let assetsReady = false;

/**
 * Lädt die Arena-Atlanten. Mehrfachaufrufe teilen sich dieselbe Promise, damit der
 * Preload während der Betting-Phase und das spätere Betreten der Arena nicht doppelt laden.
 */
export function loadArenaAssets(): Promise<ArenaAssets> {
  assetsPromise ??= (async () => {
    const [shotlings, props] = await Promise.all([
      Assets.load<Spritesheet>(atlasUrl('shotlings')),
      Assets.load<Spritesheet>(atlasUrl('props')),
    ]);
    assetsReady = true;
    return { shotlings, props };
  })();
  return assetsPromise;
}

/** Preload im Hintergrund (Architektur §7.12) — läuft während PASS/BET. */
export function preloadArenaAssets(): void {
  void loadArenaAssets().catch((error) => {
    console.warn('[arena] Preload fehlgeschlagen', error);
    // Beim echten Betreten der Arena wird erneut versucht.
    assetsPromise = undefined;
  });
}

/** True, sobald beide Atlanten im Speicher liegen — der Arena-Screen zeigt dann keinen Spinner. */
export function areArenaAssetsReady(): boolean {
  return assetsReady;
}

export interface ArenaAppHandle {
  readonly app: Application;
  /** Alles Spielbare hängt hier drin; wird in Weltkoordinaten (1000×1000) gerechnet. */
  readonly world: Container;
  /** Hängt das Canvas in ein Host-Element und startet den Ticker. */
  attach(host: HTMLElement): void;
  /** Nimmt das Canvas aus dem DOM und pausiert — die App bleibt am Leben. */
  detach(): void;
  /** Leert die Bühne zwischen zwei Runden; Pools und App bleiben bestehen. */
  clearWorld(): void;
  /** Gemessene Frame-Zeiten der letzten Sekunden (Dev-Panel, Low-Effects-Erkennung). */
  frameTimes(): readonly number[];
  /** Echte WebGL-Draw-Calls des letzten Frames (Audit A2: ≤ 3 in der Arena-Szene). */
  drawCalls(): number;
  destroy(): void;
}

let handle: ArenaAppHandle | undefined;

/**
 * Erzeugt die App beim ersten Aufruf und gibt danach immer dieselbe Instanz zurück.
 */
export async function getArenaApp(): Promise<ArenaAppHandle> {
  if (handle) return handle;

  const app = new Application();
  await app.init({
    backgroundAlpha: 0,
    antialias: RENDER.antialias,
    autoDensity: true,
    resolution: Math.min(globalThis.devicePixelRatio ?? 1, RENDER.maxResolution),
    powerPreference: RENDER.powerPreference,
    preference: 'webgl',
  });

  const world = new Container();
  app.stage.addChild(world);

  /* --- Eine Uhr: PIXI treibt GSAP (§7.7) --- */
  gsap.ticker.remove(gsap.updateRoot);
  let elapsed = 0;

  /* --- Frame-Zeiten für Dev-Panel und Low-Effects-Erkennung --- */
  const SAMPLES = 240;
  const samples = new Float32Array(SAMPLES);
  let sampleIndex = 0;
  let sampleCount = 0;

  /*
   * Draw-Calls ehrlich zählen: PIXI legt keinen offiziellen Zähler offen, also werden
   * `drawElements`/`drawArrays` im WebGL-Kontext umschlossen. Das ist die Zahl, die im
   * A2-Audit zählt — nicht eine interne Batch-Liste, die auch mal veraltet sein kann.
   */
  let drawsThisFrame = 0;
  let drawsLastFrame = 0;
  instrumentDrawCalls(app, () => {
    drawsThisFrame++;
  });

  app.ticker.add((ticker) => {
    drawsLastFrame = drawsThisFrame;
    drawsThisFrame = 0;
    elapsed += ticker.deltaMS;
    gsap.updateRoot(elapsed / 1000);
    samples[sampleIndex] = ticker.deltaMS;
    sampleIndex = (sampleIndex + 1) % SAMPLES;
    if (sampleCount < SAMPLES) sampleCount++;
  }, undefined, -100);

  let host: HTMLElement | undefined;
  let observer: ResizeObserver | undefined;

  /** Skaliert die 1000×1000-Welt so, dass sie mittig in den Host passt. */
  const layout = (): void => {
    if (!host) return;
    const width = host.clientWidth || 1;
    const height = host.clientHeight || 1;
    app.renderer.resize(width, height);
    const scale = Math.min(width, height) / ARENA.worldSize;
    world.scale.set(scale);
    world.position.set(
      (width - ARENA.worldSize * scale) / 2,
      (height - ARENA.worldSize * scale) / 2
    );
  };

  const onVisibility = (): void => {
    // §7.8: im Hintergrund kostet die Arena nichts.
    if (document.hidden) {
      app.ticker.stop();
      gsap.globalTimeline.pause();
    } else {
      gsap.globalTimeline.resume();
      app.ticker.start();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  handle = {
    app,
    world,

    attach(target) {
      host = target;
      target.append(app.canvas);
      observer?.disconnect();
      observer = new ResizeObserver(layout);
      observer.observe(target);
      layout();
      app.ticker.start();
    },

    detach() {
      observer?.disconnect();
      observer = undefined;
      app.canvas.remove();
      host = undefined;
      app.ticker.stop();
    },

    clearWorld() {
      world.removeChildren();
    },

    frameTimes() {
      return Array.from(samples.slice(0, sampleCount));
    },

    drawCalls() {
      return drawsLastFrame;
    },

    destroy() {
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
      app.destroy(true, { children: true });
      handle = undefined;
    },
  };

  return handle;
}

/** Nur für Tests: gibt den Singleton frei. */
export function resetArenaApp(): void {
  handle?.destroy();
  handle = undefined;
  assetsPromise = undefined;
  assetsReady = false;
}

/**
 * Legt einen Zähler um die WebGL-Draw-Aufrufe. Schlägt still fehl, wenn der Renderer
 * kein WebGL nutzt (Canvas-Fallback) — dann liefert `drawCalls()` eben 0.
 */
function instrumentDrawCalls(app: Application, onDraw: () => void): void {
  const gl = (app.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
  if (!gl) return;
  const drawElements = gl.drawElements.bind(gl);
  const drawArrays = gl.drawArrays.bind(gl);
  gl.drawElements = ((...args: Parameters<WebGLRenderingContext['drawElements']>) => {
    onDraw();
    return drawElements(...args);
  }) as WebGLRenderingContext['drawElements'];
  gl.drawArrays = ((...args: Parameters<WebGLRenderingContext['drawArrays']>) => {
    onDraw();
    return drawArrays(...args);
  }) as WebGLRenderingContext['drawArrays'];
}

/* ------------------------------------------------------------------ */
/* Low-Effects-Erkennung (Architektur §7.9)                            */
/* ------------------------------------------------------------------ */

interface DeviceInfo {
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

/**
 * Grobe Vorab-Einschätzung anhand der Geräte-Angaben. Der zweite Teil der Regel — der
 * gemessene Frame-Median über die ersten 2 s — läuft in `measureLowEffects()`.
 */
export function detectLowEffects(info: DeviceInfo = navigator as DeviceInfo): boolean {
  const memory = info.deviceMemory;
  const cores = info.hardwareConcurrency;
  if (memory !== undefined && memory <= RENDER.lowEffects.deviceMemoryMax) return true;
  if (cores !== undefined && cores <= RENDER.lowEffects.hardwareConcurrencyMax) return true;
  return false;
}

/** Median einer Frame-Zeit-Reihe. */
export function frameMedian(times: readonly number[]): number {
  if (times.length === 0) return 0;
  const sorted = [...times].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

/**
 * Misst nach dem Betreten der Arena und meldet, ob der Low-Effects-Modus greifen soll.
 * Wird als `true` aufgelöst, wenn der Frame-Median über der Schwelle liegt.
 */
export function measureLowEffects(target: ArenaAppHandle): Promise<boolean> {
  return new Promise((resolve) => {
    globalThis.setTimeout(() => {
      const median = frameMedian(target.frameTimes());
      resolve(median > RENDER.lowEffects.frameMedianMaxMs);
    }, RENDER.lowEffects.probeDurationMs);
  });
}
