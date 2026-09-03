/**
 * `butt_hotfoot` — Treffer in den Hosenboden. Das Männchen springt mit beiden Händen am Po
 * hoch, rennt eine Rauchspur ziehend im Kreis, stolpert über die eigenen Füsse und liegt
 * mit Sternchen (GDD §4.1).
 *
 * Der Sturz muss abrupt kommen: erst schnelle Kreise, dann von einem Frame auf den anderen
 * flach. Ein weiches Ausrollen wäre kein Stolpern.
 */

import gsap from 'gsap';
import { MOTION } from '@/config/theme';
import { impactStars } from '../../fx/MuzzleFlash';
import { finishDeath, impactBeat } from '../../fx/deathFinish';
import type { DeathContext, DeathSequence } from '../DeathSequence';

const CIRCLE_MS = 1250;

export const buttHotfoot: DeathSequence = {
  id: 'butt_hotfoot',
  zone: 'butt',
  weight: 9,
  needsSecondShot: false,

  build(ctx: DeathContext): gsap.core.Timeline {
    const { victim, camera, fx, audio } = ctx;
    const { body, armL, armR } = victim.rig;
    const timeline = gsap.timeline();

    const x = victim.brain.x;
    const y = victim.brain.y;
    const radius = victim.height * 0.7;

    victim.setDriven(true);

    /* --- Treffer: Hände an den Po, Sprung nach oben --- */
    timeline.call(() => {
      victim.setState('dead');
      victim.brain.stop();
      victim.setFace('ouch');
      audio.play('hit_stop_thud');
      camera.shakeScreen(140, 6);
    });
    impactBeat(timeline, body, { squash: false });

    timeline.to(armL, { rotation: 2.5, duration: 0.1, ease: MOTION.easeOvershoot });
    timeline.to(armR, { rotation: -2.5, duration: 0.1, ease: MOTION.easeOvershoot }, '<');
    timeline.to(victim.view, { y: y - 70, duration: 0.16, ease: 'power2.out' });
    timeline.to(victim.view, { y, duration: 0.18, ease: 'power2.in' });
    timeline.call(() => audio.play('star_twinkle', 0, 4));

    /* --- Kreise mit Rauch --- */
    let lastPuff = -1;
    const run = { t: 0 };
    timeline.call(() => victim.setFace('panic'));
    timeline.to(run, {
      t: 1,
      duration: CIRCLE_MS / 1000,
      ease: 'none',
      onUpdate: () => {
        const angle = run.t * Math.PI * 4;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius * 0.45;
        victim.view.position.set(px, py);
        victim.view.zIndex = py;
        // Er lehnt sich in die Kurve.
        victim.view.rotation = Math.sin(angle) * 0.22;
        body.scale.x = Math.cos(angle) >= 0 ? 1 : -1;

        const puff = Math.floor(run.t * 16);
        if (puff !== lastPuff) {
          lastPuff = puff;
          fx.particles.emit('smoke', px, py, 1, { speed: 45, gravity: -25, scale: 0.85 });
        }
      },
    });

    /* --- Und stolpert. Abrupt. --- */
    const fallX = x + radius;
    timeline.call(() => {
      victim.setFace('x_eyes');
      audio.play('tree_fall', 0, 3);
      impactStars(fx.particles, { x: fallX, y: y - victim.height * 0.5, power: 1.1 });
      camera.shakeScreen(200, 9);
    });
    timeline.to(victim.view, {
      rotation: Math.PI / 2,
      x: fallX,
      y,
      duration: 0.2,
      ease: 'back.in(2)',
    });
    timeline.call(() => {
      audio.play('hit_stop_thud');
      fx.particles.emit('dust', fallX, y, 6, { speed: 160, gravity: -40, spread: Math.PI });
    });
    timeline.to(body.scale, { x: 1.12, y: 0.88, duration: 0.06, ease: 'power2.out' });
    timeline.to(body.scale, { x: 1, y: 1, duration: 0.22, ease: MOTION.easeElastic });
    timeline.to(armL, { rotation: 0.4, duration: 0.22, ease: MOTION.easeElastic }, '<');
    timeline.to(armR, { rotation: -0.4, duration: 0.22, ease: MOTION.easeElastic }, '<');

    return finishDeath(ctx, timeline, { x: fallX, y, delayMs: 140 });
  },
};
