/**
 * Kamera-Effekte über der Arena (Art Direction §6/§7, Roadmap M3.2).
 *
 * Die Kamera bewegt nicht die Welt-Logik, sondern nur den Container: Zoom beim Lock,
 * Parallax beim Reticle-Sprung, Screen-Shake beim Schuss, Slow-Mo über `timeScale`.
 *
 * Slow-Mo betrifft **beide** Uhren: die GSAP-Timeline der Show und die Laufgeschwindigkeit
 * der Männchen. Sonst würde die Zeit für das Reticle langsamer laufen, für die Beine aber
 * nicht — und genau das sieht falsch aus.
 */

import type { Container } from 'pixi.js';
import gsap from 'gsap';
import { ANIM } from '@/config/theme';
import { CHOREO } from '@/config/choreo';

export interface CameraOptions {
  /** Der Container, der bewegt wird — die gesamte Spielwelt. */
  world: Container;
  /** Ruhezustand: Skalierung und Position, die `ArenaApp` gesetzt hat. */
  baseScale: number;
  baseX: number;
  baseY: number;
}

export class Camera {
  private world: Container;
  private baseScale: number;
  private baseX: number;
  private baseY: number;

  /** Getrennte Offsets, damit sich Shake und Parallax nicht gegenseitig überschreiben. */
  private shake = { x: 0, y: 0 };
  private parallax = { x: 0, y: 0 };
  private zoom = { value: 1 };

  /** Wird von aussen gelesen, um die Männchen mit zu verlangsamen. */
  timeScale = 1;

  constructor(options: CameraOptions) {
    this.world = options.world;
    this.baseScale = options.baseScale;
    this.baseX = options.baseX;
    this.baseY = options.baseY;
  }

  /** Nach einem Resize die Ruhelage neu übernehmen. */
  rebase(baseScale: number, baseX: number, baseY: number): void {
    this.baseScale = baseScale;
    this.baseX = baseX;
    this.baseY = baseY;
    this.apply();
  }

  private apply(): void {
    const scale = this.baseScale * this.zoom.value;
    this.world.scale.set(scale);
    // Beim Zoom auf die Mitte halten, damit die Arena nicht aus dem Bild wandert.
    const drift = ((this.zoom.value - 1) * this.baseScale * 1000) / 2;
    this.world.position.set(
      this.baseX - drift + this.shake.x + this.parallax.x,
      this.baseY - drift + this.shake.y + this.parallax.y
    );
  }

  /** Zoom beim Lock: +15 % (Art Direction §6). */
  zoomIn(durationMs: number, factor = 1.15): gsap.core.Tween {
    return gsap.to(this.zoom, {
      value: factor,
      duration: durationMs / 1000,
      ease: 'power2.inOut',
      onUpdate: () => this.apply(),
    });
  }

  zoomOut(durationMs: number): gsap.core.Tween {
    return gsap.to(this.zoom, {
      value: 1,
      duration: durationMs / 1000,
      ease: 'power2.out',
      onUpdate: () => this.apply(),
    });
  }

  /**
   * Parallax beim Reticle-Sprung: die Arena verschiebt sich 4 % in die Gegenrichtung.
   * Das erzeugt das Gefühl, das Gewehr schwenke — obwohl sich das Reticle bewegt.
   */
  parallaxNudge(dirX: number, dirY: number): gsap.core.Tween {
    const length = Math.hypot(dirX, dirY) || 1;
    const amount = this.baseScale * 1000 * CHOREO.parallaxFactor;
    return gsap.to(this.parallax, {
      x: (-dirX / length) * amount,
      y: (-dirY / length) * amount,
      duration: 0.18,
      ease: CHOREO.parallaxEase,
      onUpdate: () => this.apply(),
      onComplete: () => {
        gsap.to(this.parallax, {
          x: 0,
          y: 0,
          duration: 0.4,
          ease: 'power2.out',
          onUpdate: () => this.apply(),
        });
      },
    });
  }

  /** Screen-Shake: 250 ms, Amplitude 12 px, exponentiell abklingend (GDD §4.2). */
  shakeScreen(durationMs = ANIM.shakeMs, amplitude = ANIM.shakeAmplitudePx): gsap.core.Tween {
    const state = { t: 0 };
    return gsap.to(state, {
      t: 1,
      duration: durationMs / 1000,
      ease: 'none',
      onUpdate: () => {
        const decay = Math.pow(1 - state.t, 2);
        // Deterministisch genug und ohne Allokation: zwei Sinusse mit krummen Frequenzen.
        this.shake.x = Math.sin(state.t * 97) * amplitude * decay;
        this.shake.y = Math.cos(state.t * 131) * amplitude * decay;
        this.apply();
      },
      onComplete: () => {
        this.shake.x = 0;
        this.shake.y = 0;
        this.apply();
      },
    });
  }

  /** Nachbeben nach dem Tod: sanft heranzoomen und halten. */
  afterShock(): gsap.core.Tween {
    return gsap.to(this.zoom, {
      value: CHOREO.afterShockZoom,
      duration: CHOREO.afterShockMs / 1000,
      ease: 'power2.out',
      onUpdate: () => this.apply(),
    });
  }

  /**
   * Slow-Mo.
   *
   * Verlangsamt **die Welt**, nicht das Drehbuch: `timeScale` skaliert den Zeitschritt
   * der Männchen und Partikel. Die Show-Timeline läuft weiter in Echtzeit — sonst würde
   * sich die Lock-Phase um den Faktor 2.5 dehnen und die Dauer-Presets (10/15/22 s)
   * wären hinfällig (Audit A3).
   */
  slowMotion(scale: number, rampMs = CHOREO.slowMoRampMs): gsap.core.Tween {
    const state = { value: this.timeScale };
    return gsap.to(state, {
      value: scale,
      duration: rampMs / 1000,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.timeScale = state.value;
      },
      onComplete: () => {
        this.timeScale = scale;
      },
    });
  }

  /** Slow-Mo hart beenden — der Schuss bricht sie ab (GDD §3.5). */
  resetTime(): void {
    gsap.killTweensOf(this);
    this.timeScale = 1;
  }

  reset(): void {
    this.timeScale = 1;
    gsap.killTweensOf([this.zoom, this.shake, this.parallax, this]);
    this.zoom.value = 1;
    this.shake.x = 0;
    this.shake.y = 0;
    this.parallax.x = 0;
    this.parallax.y = 0;
    this.apply();
  }
}
