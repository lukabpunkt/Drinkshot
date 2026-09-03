/**
 * Der gemeinsame Abschluss jeder Todesanimation (GDD §4.2 „Nachbeben").
 *
 * Audit A4 verlangt von **jeder** Sequenz: Grabstein-Pop (ausser Miracle) und
 * Nachbeben-Zoom. Zwölfmal kopiert wäre das zwölfmal eine Gelegenheit, es zu vergessen —
 * hier steht es einmal, und der Unit-Test prüft, dass jede Sequenz es benutzt.
 *
 * Dazu die Reaktion der Umstehenden: Die anderen bleiben stehen, drehen sich zum Opfer,
 * und einer klatscht. Das macht aus einem Einzelgag eine kleine Szene.
 */

import type { Container } from 'pixi.js';
import gsap from 'gsap';
import { ANIM, MOTION } from '@/config/theme';
import type { DeathContext } from '../deaths/DeathSequence';
import { DEATH_PROP_LABEL, popTombstone } from './Tombstone';

export interface FinishOptions {
  /** Wo der Grabstein aus dem Boden kommt — Weltkoordinaten. */
  x: number;
  y: number;
  /** Miracle-Sequenzen setzen keinen Grabstein. */
  tombstone?: boolean;
  /** Verzögerung, bevor der Abschluss einsetzt (Follow-Through). */
  delayMs?: number;
}

/** Markierung, damit der Test sieht, dass eine Sequenz den Abschluss benutzt hat. */
export const FINISHED_FLAG = 'drinkshotFinished';

export function finishDeath(
  ctx: DeathContext,
  timeline: gsap.core.Timeline,
  options: FinishOptions
): gsap.core.Timeline {
  const { camera, fx, audio, others, rng } = ctx;
  const withTombstone = options.tombstone ?? true;
  const delay = (options.delayMs ?? 150) / 1000;

  timeline.call(
    () => {
      /* --- Die anderen halten an und schauen hin --- */
      for (const other of others) {
        if (other.getState() === 'dead') continue;
        other.setState('idle');
        other.brain.stop();
        other.lookAt(options.x, options.y);
      }

      // Einer klatscht — winkende Arme, damit die Szene nicht erstarrt wirkt.
      if (others.length > 0) {
        const clapper = rng.pick(others);
        if (clapper.getState() !== 'dead') {
          clapper.setFace('happy');
          gsap.to(clapper.rig.armL, {
            rotation: -1.1,
            duration: 0.16,
            repeat: 5,
            yoyo: true,
            ease: 'power2.inOut',
          });
          gsap.to(clapper.rig.armR, {
            rotation: 1.1,
            duration: 0.16,
            repeat: 5,
            yoyo: true,
            ease: 'power2.inOut',
          });
          audio.play('crowd_laugh');
        }
      }

      /* --- Grabstein --- */
      if (withTombstone) {
        audio.play('rip_pop');
        const scale = ctx.victim.view.scale.x * 1.4;
        popTombstone(fx.overlay, options.x + 60, options.y, scale);
      }

      /* --- Nachbeben: die Kamera zoomt sanft auf das Opfer --- */
      camera.afterShock();
    },
    undefined,
    `+=${delay}`
  );

  // Etwas Luft, damit Grabstein und Zoom sichtbar zu Ende laufen.
  timeline.to({}, { duration: 0.5 });

  // Für den Audit-Test: die Timeline trägt sichtbar, dass sie sauber abgeschlossen wurde.
  (timeline as unknown as Record<string, boolean>)[FINISHED_FLAG] = true;
  return timeline;
}

/**
 * Entfernt Grabsteine und Sprechblasen einer vorherigen Sequenz.
 *
 * Im Spiel wird die Arena zwischen den Runden ohnehin geleert; gebraucht wird das beim
 * wiederholten Abspielen im Dev-Panel — sonst steht nach fünf Durchläufen ein Friedhof
 * herum und man sieht die Sequenz nicht mehr, die man beurteilen will.
 */
export function clearDeathProps(layer: Container): void {
  for (const child of [...layer.children]) {
    if (child.label === DEATH_PROP_LABEL) child.destroy();
  }
}

/** Hit-Stop plus Squash beim Treffer — der Auftakt fast jeder Sequenz. */
export function impactBeat(
  timeline: gsap.core.Timeline,
  target: { scale: { x: number; y: number } },
  options: { squash?: boolean } = {}
): gsap.core.Timeline {
  // 80 ms Standbild auf dem Treffer-Frame (Art Direction §5.2).
  timeline.to({}, { duration: ANIM.hitStopMs / 1000 });

  if (options.squash !== false) {
    const baseX = target.scale.x;
    const baseY = target.scale.y;
    timeline.to(target.scale, {
      x: baseX * ANIM.squashScaleX,
      y: baseY * ANIM.squashScaleY,
      duration: ANIM.squashMs / 1000,
      ease: 'power2.out',
    });
    timeline.to(target.scale, {
      x: baseX,
      y: baseY,
      duration: 0.18,
      ease: MOTION.easeElastic,
    });
  }

  return timeline;
}
