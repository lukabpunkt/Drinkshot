/**
 * Das Zielfernrohr (Art Direction §6).
 *
 * Wichtigste Regel: **Das Reticle folgt dem Ziel, nicht die Welt dem Reticle.** Die Arena
 * bleibt ruhig, ein eigener Container wandert von Männchen zu Männchen. Nur so bleibt die
 * Szene lesbar, wenn das Fadenkreuz in der Panik-Phase alle 300 ms springt.
 *
 * Der Scope lebt im **Bildschirmraum** (unskalierter Overlay-Container), die Ziele in
 * Weltkoordinaten — `worldToScreen` übersetzt dazwischen.
 */

import { Container, Graphics, Sprite, Texture, type Filter } from 'pixi.js';
import gsap from 'gsap';
import { createNoise2D } from 'simplex-noise';
import { CHOREO } from '@/config/choreo';
import { MOTION, SCOPE, UI_COLORS } from '@/config/theme';

/** Ein Ziel ist alles, was eine Weltposition hat — meist ein `ShotlingBrain`. */
export interface ScopeTarget {
  readonly x: number;
  readonly y: number;
}

export interface ScopeOptions {
  /** Umrechnung Welt → Bildschirm (Pixel im Overlay-Container). */
  worldToScreen: (x: number, y: number, out: { x: number; y: number }) => void;
  lowEffects?: boolean;
}

/** Wie weit die Eckklammern im Ruhezustand vom Zentrum weg sind (Anteil des Radius). */
const BRACKET_IDLE = 0.62;
const BRACKET_LOCKED = 0.3;
const BRACKET_ARM = 16;

const RETICLE_LINE_ALPHA = 0.7;
const MIL_DOT_COUNT = 4;

export class Scope {
  readonly view = new Container();

  private readonly vignette = new Sprite(Texture.WHITE);
  private readonly reticleLayer = new Container();
  private readonly reticleMask = new Graphics();
  private readonly reticle = new Container();
  private readonly crosshair = new Graphics();
  private readonly brackets: Graphics[] = [];
  private readonly glassHighlight = new Graphics();
  private readonly flashOverlay = new Graphics();

  private readonly noiseX = createNoise2D(() => 0.31);
  private readonly noiseY = createNoise2D(() => 0.77);

  private readonly worldToScreen: ScopeOptions['worldToScreen'];
  /** Wiederverwendete Vektoren — im Frame-Loop wird nichts allokiert (§7.11). */
  private readonly scratch = { x: 0, y: 0 };
  private readonly fromPoint = { x: 0, y: 0 };

  private width = 0;
  private height = 0;
  private _radius = 0;
  private lowEffects: boolean;

  private target: ScopeTarget | null = null;
  /** Fortschritt der laufenden Reticle-Fahrt, 0 … 1. */
  private travel = { progress: 1 };
  private elapsedMs = 0;

  /** Zustand der Klammern, 0 = offen, 1 = zugeschnappt. */
  private clamp = { value: 0 };
  private vignetteState = { alpha: SCOPE.vignetteAlpha };
  private locked = false;

  /** Filter werden nur während Lock/Shot gesetzt und danach wieder entfernt (§7.4). */
  private shockwaveFilter: Filter | undefined;
  private rgbSplitFilter: Filter | undefined;

  constructor(options: ScopeOptions) {
    this.worldToScreen = options.worldToScreen;
    this.lowEffects = options.lowEffects ?? false;

    this.vignette.anchor.set(0.5);
    this.vignette.tint = UI_COLORS.scopeVignette;

    this.buildReticle();

    this.flashOverlay.alpha = 0;
    this.flashOverlay.visible = false;
    this.view.addChild(
      this.vignette,
      this.reticleMask,
      this.reticleLayer,
      this.glassHighlight,
      this.flashOverlay
    );
    this.view.eventMode = 'none';
  }

  get radius(): number {
    return this._radius;
  }

  /** Bildschirmmitte — dorthin zoomt die Kamera beim Lock. */
  get centerX(): number {
    return this.width / 2;
  }

  get centerY(): number {
    return this.height / 2;
  }

  /* ------------------------------------------------------------------ */
  /* Aufbau                                                              */
  /* ------------------------------------------------------------------ */

  private buildReticle(): void {
    this.reticle.addChild(this.crosshair);
    for (let i = 0; i < 4; i++) {
      const bracket = new Graphics();
      this.brackets.push(bracket);
      this.reticle.addChild(bracket);
    }
    // Fadenkreuz und Klammern enden am Rand des Sichtfensters — sonst ragen die Linien
    // ins Vignetten-Dunkel und der Scope sieht aus wie ein Overlay statt wie ein Objektiv.
    this.reticleLayer.addChild(this.reticle);
    this.reticleLayer.mask = this.reticleMask;
  }

  /** Zeichnet Fadenkreuz und Mil-Dots neu — nur bei Resize nötig. */
  private drawReticle(): void {
    const reach = this._radius * 0.92;
    const gap = SCOPE.centerClearDiameterPx / 2;
    const color = this.locked ? UI_COLORS.danger : UI_COLORS.paper;

    this.crosshair.clear();
    this.crosshair
      .moveTo(-reach, 0)
      .lineTo(-gap, 0)
      .moveTo(gap, 0)
      .lineTo(reach, 0)
      .moveTo(0, -reach)
      .lineTo(0, -gap)
      .moveTo(0, gap)
      .lineTo(0, reach)
      .stroke({ width: 1.5, color, alpha: RETICLE_LINE_ALPHA });

    // Mil-Dots: kleine Striche entlang der Achsen, geben dem Scope die Optik-Anmutung.
    const step = (reach - gap) / (MIL_DOT_COUNT + 1);
    for (let i = 1; i <= MIL_DOT_COUNT; i++) {
      const d = gap + step * i;
      const tick = i % 2 === 0 ? 6 : 3;
      this.crosshair
        .moveTo(-d, -tick)
        .lineTo(-d, tick)
        .moveTo(d, -tick)
        .lineTo(d, tick)
        .moveTo(-tick, -d)
        .lineTo(tick, -d)
        .moveTo(-tick, d)
        .lineTo(tick, d)
        .stroke({ width: 1.5, color, alpha: RETICLE_LINE_ALPHA * 0.8 });
    }

    this.drawBrackets();
  }

  /** Vier Eckklammern; `clamp.value` zieht sie zum Zentrum. */
  private drawBrackets(): void {
    const spread = this._radius * (BRACKET_IDLE - (BRACKET_IDLE - BRACKET_LOCKED) * this.clamp.value);
    const color = this.locked ? UI_COLORS.danger : UI_COLORS.paper;
    const alpha = 0.55 + this.clamp.value * 0.45;

    this.brackets.forEach((bracket, index) => {
      const signX = index % 2 === 0 ? -1 : 1;
      const signY = index < 2 ? -1 : 1;
      const x = spread * signX;
      const y = spread * signY;

      bracket.clear();
      bracket
        .moveTo(x, y + BRACKET_ARM * -signY)
        .lineTo(x, y)
        .lineTo(x + BRACKET_ARM * -signX, y)
        .stroke({ width: 3, color, alpha, cap: 'round', join: 'round' });
    });
  }

  /**
   * Erzeugt die Vignette als weiche Radial-Textur. Ein `Graphics`-Kreis hätte eine harte
   * Kante; die Art Direction verlangt einen 24-px-Blur-Fade nach aussen (§6).
   */
  private drawVignette(): void {
    // Exakt so gross wie nötig: jeder Pixel mehr ist Overdraw über die ganze Fläche.
    const size = Math.ceil(Math.max(this.width, this.height));
    const canvas = document.createElement('canvas');
    const resolution = 256;
    canvas.width = resolution;
    canvas.height = resolution;

    const context = canvas.getContext('2d');
    if (!context) return;

    const half = resolution / 2;
    const inner = (this._radius / (size / 2)) * half;
    const fade = (SCOPE.edgeBlurPx / (size / 2)) * half;

    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    const innerStop = Math.min(0.999, inner / half);
    const outerStop = Math.min(1, (inner + fade) / half);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(innerStop, 'rgba(255,255,255,0)');
    gradient.addColorStop(outerStop, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,1)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, resolution, resolution);

    this.vignette.texture.destroy(true);
    this.vignette.texture = Texture.from(canvas);
    this.vignette.width = size;
    this.vignette.height = size;
    this.vignette.position.set(this.centerX, this.centerY);
    this.vignette.alpha = this.vignetteState.alpha;
  }

  /** Glanzbogen oben links — reine Deko, im Low-Modus aus. */
  private drawGlass(): void {
    this.glassHighlight.clear();
    if (this.lowEffects) return;
    this.glassHighlight
      .arc(this.centerX, this.centerY, this._radius * 0.86, Math.PI * 1.15, Math.PI * 1.45)
      .stroke({ width: this._radius * 0.09, color: UI_COLORS.scopeGlass, alpha: 0.1, cap: 'round' });
  }

  /* ------------------------------------------------------------------ */
  /* Layout & Frame                                                      */
  /* ------------------------------------------------------------------ */

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    // Art Direction §6: Durchmesser = min(Breite − 16, Höhe × 0.62)
    this._radius = Math.min(width - 16, height * 0.62) / 2;

    this.drawVignette();
    this.drawReticle();
    this.drawGlass();

    this.flashOverlay.clear();
    this.flashOverlay.rect(0, 0, width, height).fill(UI_COLORS.paper);

    this.reticleMask.clear();
    this.reticleMask.circle(this.centerX, this.centerY, this._radius).fill(0xffffff);

    this.reticle.position.set(this.centerX, this.centerY);
  }

  /** Frame-Update: Reticle nachführen und Atem-Wobble auflegen. */
  update(dtMs: number): void {
    this.elapsedMs += dtMs;

    if (this.target) {
      this.worldToScreen(this.target.x, this.target.y, this.scratch);
      const progress = this.travel.progress;
      // Während der Fahrt wird zum *aktuellen* Ziel interpoliert, nicht zu einer alten
      // Position — sonst läuft das Reticle einem laufenden Männchen hinterher.
      const x = this.fromPoint.x + (this.scratch.x - this.fromPoint.x) * progress;
      const y = this.fromPoint.y + (this.scratch.y - this.fromPoint.y) * progress;
      this.reticle.position.set(x, y);
    }

    if (!this.lowEffects) {
      // Atem-Wobble: ±3 px bei 0.4 Hz (Art Direction §6).
      const phase = (this.elapsedMs / 1000) * SCOPE.breathFrequencyHz;
      this.reticle.x += this.noiseX(phase, 0) * SCOPE.breathAmplitudePx;
      this.reticle.y += this.noiseY(0, phase) * SCOPE.breathAmplitudePx;
    }

    this.vignette.alpha = this.vignetteState.alpha;
  }

  setLowEffects(value: boolean): void {
    this.lowEffects = value;
    this.drawGlass();
    if (value) this.clearFilters();
  }

  /* ------------------------------------------------------------------ */
  /* Show-Aktionen                                                       */
  /* ------------------------------------------------------------------ */

  /** Legt das Reticle in einer Fahrt auf ein neues Ziel. */
  aimAt(target: ScopeTarget, durationMs: number, style: 'smooth' | 'snap'): gsap.core.Tween {
    this.fromPoint.x = this.reticle.x;
    this.fromPoint.y = this.reticle.y;
    this.target = target;
    this.travel.progress = 0;

    return gsap.to(this.travel, {
      progress: 1,
      duration: durationMs / 1000,
      ease: style === 'smooth' ? CHOREO.hopEase : MOTION.easeOvershoot,
      overwrite: true,
    });
  }

  /** Setzt das Reticle ohne Fahrt (Intro). */
  snapTo(target: ScopeTarget): void {
    this.target = target;
    this.worldToScreen(target.x, target.y, this.scratch);
    this.fromPoint.x = this.scratch.x;
    this.fromPoint.y = this.scratch.y;
    this.travel.progress = 1;
    this.reticle.position.set(this.scratch.x, this.scratch.y);
  }

  /**
   * Echter Lock: Klammern schnappen zusammen, Reticle wird rot, Vignette pulsiert.
   */
  lock(durationMs: number): gsap.core.Timeline {
    this.locked = true;
    const timeline = gsap.timeline();

    timeline.to(this.clamp, {
      value: 1,
      duration: CHOREO.lockClampMs / 1000,
      ease: MOTION.easeSnappy,
      onUpdate: () => this.drawBrackets(),
    });
    timeline.call(() => this.drawReticle(), undefined, 0);

    // Vignette pulsiert im Herzschlag-Takt bis zum Schuss.
    timeline.to(
      this.vignetteState,
      {
        alpha: SCOPE.vignetteAlphaLocked,
        duration: 0.36,
        repeat: Math.max(1, Math.round(durationMs / 720)),
        yoyo: true,
        ease: 'sine.inOut',
      },
      0
    );

    return timeline;
  }

  /**
   * Fake-Lock: dieselbe Bewegung bis 70 % der Klammer-Schliessung, dann abrupter Abbruch.
   * Das ist der eigentliche Spannungstreiber (GDD §8).
   */
  fakeLock(durationMs: number): gsap.core.Timeline {
    const timeline = gsap.timeline();
    const closeMs = durationMs * CHOREO.fakeLockProgress;

    timeline.to(this.clamp, {
      value: CHOREO.fakeLockProgress,
      duration: closeMs / 1000,
      ease: MOTION.easeSnappy,
      onUpdate: () => this.drawBrackets(),
    });
    // Kurz fast-rot werden, dann zurück — die Farbe verrät nichts, sie droht nur.
    timeline.to(
      this.crosshair,
      { tint: UI_COLORS.danger, duration: closeMs / 1000, ease: 'none' },
      0
    );
    timeline.to(this.clamp, {
      value: 0,
      duration: CHOREO.fakeLockAbortMs / 1000,
      ease: CHOREO.fakeLockAbortEase,
      onUpdate: () => this.drawBrackets(),
    });
    timeline.to(
      this.crosshair,
      { tint: 0xffffff, duration: CHOREO.fakeLockAbortMs / 1000, ease: 'none' },
      '<'
    );

    return timeline;
  }

  /** Der Schuss: zwei Frames Vollbild-Weiss, Shockwave, roter Vignette-Blitz. */
  flash(): gsap.core.Timeline {
    const timeline = gsap.timeline();

    // Der Vollbild-Blitz ist ausserhalb des Schusses unsichtbar geschaltet, damit er
    // nicht jeden Frame eine Bildschirmfläche kostet.
    timeline.set(this.flashOverlay, { visible: true, alpha: 1 });
    timeline.to(this.flashOverlay, { alpha: 0, duration: 0.14, ease: 'power2.in' }, 0.033);
    timeline.set(this.flashOverlay, { visible: false });

    // Roter Puls über der Vignette, 120 ms.
    timeline.to(this.vignette, { tint: UI_COLORS.danger, duration: 0.06, ease: 'none' }, 0);
    timeline.to(
      this.vignette,
      { tint: UI_COLORS.scopeVignette, duration: 0.12, ease: 'none' },
      0.06
    );

    void this.applyShockwave();
    return timeline;
  }

  /** Nach Lock/Fake in den Ruhezustand zurück. */
  release(): void {
    this.locked = false;
    this.clamp.value = 0;
    this.vignetteState.alpha = SCOPE.vignetteAlpha;
    this.crosshair.tint = 0xffffff;
    this.drawReticle();
    this.clearFilters();
  }

  /* ------------------------------------------------------------------ */
  /* Filter — nur temporär (Architektur §7.4)                            */
  /* ------------------------------------------------------------------ */

  /**
   * Shockwave beim Schuss. Der Filter wird **lazy geladen** (eigener Chunk) und danach
   * sofort wieder entfernt: `view.filters` ist ausserhalb des Schusses immer leer.
   */
  private async applyShockwave(): Promise<void> {
    if (this.lowEffects) return;
    try {
      const { ShockwaveFilter } = await import('pixi-filters/shockwave');
      const filter = new ShockwaveFilter({
        center: { x: this.reticle.x, y: this.reticle.y },
        amplitude: 24,
        wavelength: 120,
        speed: 900,
        radius: this._radius * 1.6,
      });
      this.shockwaveFilter = filter;
      this.view.filters = [filter];

      gsap.to(filter, {
        time: 0.7,
        duration: 0.35,
        ease: 'none',
        onComplete: () => this.clearFilters(),
      });
    } catch (error) {
      console.warn('[scope] Shockwave nicht verfügbar', error);
    }
  }

  /** Chromatischer Rand während des Locks (Glas-Effekt, §6). */
  async applyGlassSplit(): Promise<void> {
    if (this.lowEffects) return;
    try {
      const { RGBSplitFilter } = await import('pixi-filters/rgb-split');
      const filter = new RGBSplitFilter({ red: { x: -1, y: 0 }, blue: { x: 1, y: 0 } });
      this.rgbSplitFilter = filter;
      this.view.filters = [filter];
    } catch (error) {
      console.warn('[scope] RGB-Split nicht verfügbar', error);
    }
  }

  /** Entfernt alle Filter — nach dieser Zeile ist `view.filters` garantiert leer. */
  clearFilters(): void {
    this.view.filters = [];
    this.shockwaveFilter?.destroy();
    this.rgbSplitFilter?.destroy();
    this.shockwaveFilter = undefined;
    this.rgbSplitFilter = undefined;
  }

  /** Testhilfe / Audit A3: sind gerade Filter aktiv? */
  get hasFilters(): boolean {
    const filters = this.view.filters;
    return Array.isArray(filters) ? filters.length > 0 : filters !== null && filters !== undefined;
  }

  destroy(): void {
    this.clearFilters();
    gsap.killTweensOf([this.travel, this.clamp, this.vignetteState, this.crosshair, this.vignette]);
    this.view.destroy({ children: true });
  }
}
