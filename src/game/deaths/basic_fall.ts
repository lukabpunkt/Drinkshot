/**
 * `basic_fall` — der Platzhalter-Tod aus M3 (Roadmap M3.7).
 *
 * Bewusst schlicht, aber vollständig nach den sieben Animationsprinzipien
 * (Art Direction §5.2), damit die zwölf echten Sequenzen in M4 ein Vorbild haben:
 * Anticipation, Squash & Stretch, Overshoot, Hit-Stop, Follow-Through, Lesbarkeit,
 * Sound-Sync.
 */

import gsap from 'gsap';
import { ANIM } from '@/config/theme';
import { impactStars } from '../fx/MuzzleFlash';
import { popTombstone } from '../fx/Tombstone';
import type { DeathContext, DeathSequence } from './DeathSequence';

export const basicFall: DeathSequence = {
  id: 'basic_fall',
  zone: 'body',
  weight: 10,
  needsSecondShot: false,

  build(ctx: DeathContext): gsap.core.Timeline {
    const { victim, camera, fx, audio } = ctx;
    const view = victim.view;
    const timeline = gsap.timeline();

    const x = victim.brain.x;
    const y = victim.brain.y;

    /* --- Hit-Stop: 80 ms Standbild auf dem Treffer-Frame --- */
    timeline.call(() => {
      victim.setState('dead');
      audio.play('hit_stop_thud');
      impactStars(fx.particles, { x, y: y - 120, power: 1 });
    });
    timeline.to({}, { duration: ANIM.hitStopMs / 1000 });

    /* --- Squash & Stretch beim Aufprall des Impulses --- */
    timeline.to(view.scale, {
      x: view.scale.x * ANIM.squashScaleX,
      y: view.scale.y * ANIM.squashScaleY,
      duration: ANIM.squashMs / 1000,
      ease: 'power2.out',
    });

    /* --- Anticipation: kurz gegen die Fallrichtung, dann umkippen --- */
    timeline.to(view, { rotation: 0.12, duration: 0.1, ease: 'power2.out' });
    timeline.to(view, {
      rotation: -Math.PI / 2,
      duration: 0.42,
      ease: 'back.in(1.4)',
      onStart: () => audio.play('tree_fall'),
    });

    /* --- Aufprall: nochmal squashen, Staub, Kamera-Wackler --- */
    timeline.call(() => {
      audio.play('hit_stop_thud');
      fx.particles.emit('dust', x, y, 6, { speed: 150, gravity: -40, spread: Math.PI });
      camera.shakeScreen(160, 6);
    });
    timeline.to(view.scale, {
      x: view.scale.x,
      y: view.scale.y,
      duration: 0.22,
      ease: 'elastic.out(1, 0.45)',
    });

    /* --- Follow-Through: der Grabstein kommt später als der Körper --- */
    timeline.call(
      () => {
        audio.play('rip_pop');
        const { timeline: pop } = popTombstone(fx.overlay, x + 60, y, victim.view.scale.x * 1.4);
        timeline.add(pop, '>');
      },
      undefined,
      '+=0.15'
    );

    /* --- Nachbeben: Kamera zoomt sanft auf das Opfer --- */
    timeline.call(() => camera.afterShock());
    timeline.to({}, { duration: 0.5 });

    return timeline;
  },
};
