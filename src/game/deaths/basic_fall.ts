/**
 * `basic_fall` — der schlichte Umfaller.
 *
 * Vollständig nach den sieben Animationsprinzipien (Art Direction §5.2) und damit das
 * Vorbild für alle anderen Sequenzen. Bleibt mit kleinem Gewicht im Pool, bis in M4c alle
 * zwölf stehen — als ruhiger Kontrast zwischen den grösseren Gags.
 */

import gsap from 'gsap';
import { impactStars } from '../fx/MuzzleFlash';
import { finishDeath, impactBeat } from '../fx/deathFinish';
import type { DeathContext, DeathSequence } from './DeathSequence';

export const basicFall: DeathSequence = {
  id: 'basic_fall',
  zone: 'body',
  weight: 3,
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
      victim.brain.stop();
      audio.play('hit_stop_thud');
      impactStars(fx.particles, { x, y: y - 120, power: 1 });
    });

    /* --- Squash & Stretch beim Aufprall des Impulses --- */
    impactBeat(timeline, view);

    /* --- Anticipation: kurz gegen die Fallrichtung, dann umkippen --- */
    timeline.to(view, { rotation: 0.12, duration: 0.1, ease: 'power2.out' });
    timeline.to(view, {
      rotation: -Math.PI / 2,
      duration: 0.42,
      ease: 'back.in(1.4)',
      onStart: () => audio.play('tree_fall'),
    });

    /* --- Aufprall: Staub, Kamera-Wackler --- */
    timeline.call(() => {
      audio.play('hit_stop_thud');
      fx.particles.emit('dust', x, y, 6, { speed: 150, gravity: -40, spread: Math.PI });
      camera.shakeScreen(160, 6);
    });
    // Follow-Through: der Körper federt nach dem Aufprall noch einmal nach.
    timeline.to(view.scale, {
      x: view.scale.x * 1.06,
      y: view.scale.y * 0.94,
      duration: 0.08,
      ease: 'power2.out',
    });
    timeline.to(view.scale, {
      x: view.scale.x,
      y: view.scale.y,
      duration: 0.24,
      ease: 'elastic.out(1, 0.45)',
    });

    return finishDeath(ctx, timeline, { x, y, delayMs: 150 });
  },
};
