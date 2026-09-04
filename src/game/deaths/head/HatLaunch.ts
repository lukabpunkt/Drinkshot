/**
 * `head_hat_launch` — Der Schuss trifft den Hut, nicht den Kopf. Der Hut steigt
 * raketenartig aus dem Bild, das Männchen schaut ihm nach, kippt um — und anderthalb
 * Sekunden später landet der Hut auf dem bereits Ohnmächtigen (GDD §4.1).
 *
 * Die späte Landung ist der eigentliche Gag: Der Zuschauer hat den Hut schon vergessen.
 * Deshalb ist die Sequenz auch länger als die anderen — sie braucht die Leere dazwischen.
 *
 * Voraussetzung ist ein Hut (`requiresHat` im Katalog). Rund 40 % der Männchen tragen
 * keinen; die Arena setzt dem Opfer dann einen auf, statt die Sequenz auszuschliessen.
 */

import gsap from 'gsap';
import { MOTION } from '@/config/theme';
import { impactStars } from '../../fx/MuzzleFlash';
import { finishDeath, impactBeat } from '../../fx/deathFinish';
import type { DeathContext, DeathSequence } from '../DeathSequence';
import { deathMeta } from '../catalog';

export const headHatLaunch: DeathSequence = {
  ...deathMeta('head_hat_launch'),

  build(ctx: DeathContext): gsap.core.Timeline {
    const { victim, camera, fx, audio, arena } = ctx;
    const { head, body } = victim.rig;
    const timeline = gsap.timeline();

    const x = victim.brain.x;
    const y = victim.brain.y;
    const headY = y - victim.height * 0.72;

    victim.setDriven(true);

    /* --- Treffer --- */
    timeline.call(() => {
      victim.setState('dead');
      victim.brain.stop();
      victim.setFace('scared');
      audio.play('hit_stop_thud');
      impactStars(fx.particles, { x, y: headY, power: 0.8 });
      camera.shakeScreen(140, 7);
    });
    impactBeat(timeline, head);

    /* --- Der Hut startet --- */
    const hat = victim.detachHat(arena.actorLayer);
    if (hat) {
      hat.zIndex = 100_000; // fliegt über allem
      timeline.call(() => audio.play('rocket'));
      // Anticipation: erst ein Stück nach unten, dann raus.
      timeline.to(hat, { y: hat.y + 14, duration: 0.08, ease: 'power2.out' });
      timeline.to(hat, {
        y: hat.y - arena.centerY * 2.4,
        rotation: Math.PI * 5,
        duration: 0.75,
        ease: 'power2.in',
      });
      timeline.call(() =>
        fx.particles.emit('smoke', x, headY, 5, { speed: 70, gravity: -120, scale: 1.1 })
      );
    }

    /* --- Er schaut hinterher --- */
    timeline.to(head, { rotation: -0.45, duration: 0.28, ease: MOTION.easeOvershoot }, '<0.1');
    timeline.call(() => victim.setFace('ouch'));
    timeline.to({}, { duration: 0.25 });

    /* --- Und kippt --- */
    timeline.call(() => victim.setFace('spiral'));
    timeline.to(body, {
      rotation: Math.PI / 2,
      duration: 0.38,
      ease: 'back.in(1.3)',
      onStart: () => audio.play('tree_fall'),
    });
    timeline.call(() => {
      audio.play('hit_stop_thud');
      fx.particles.emit('dust', x, y, 5, { speed: 140, gravity: -40, spread: Math.PI });
      camera.shakeScreen(150, 6);
    });

    /* --- Warten. Der Zuschauer hat den Hut schon vergessen. --- */
    timeline.to({}, { duration: 0.8 });

    /* --- Und dann kommt er zurück --- */
    if (hat) {
      timeline.call(() => audio.play('reticle_move', 0, -12));
      timeline.fromTo(
        hat,
        { y: y - arena.centerY * 2.4 },
        { y: y - 20, duration: 0.55, ease: 'power2.in' }
      );
      timeline.to(hat, { rotation: Math.PI * 7.15, duration: 0.55, ease: 'none' }, '<');
      timeline.call(() => {
        audio.play('rip_pop', 0, -4);
        fx.particles.emit('dust', x, y, 3, { speed: 90, gravity: -30, spread: Math.PI });
      });
      // Landung mit Nachfedern.
      timeline.to(hat.scale, {
        x: hat.scale.x * 1.25,
        y: hat.scale.y * 0.72,
        duration: 0.07,
        ease: 'power2.out',
      });
      timeline.to(hat.scale, {
        x: hat.scale.x,
        y: hat.scale.y,
        duration: 0.22,
        ease: MOTION.easeElastic,
      });
    }

    return finishDeath(ctx, timeline, { x, y, delayMs: 120 });
  },
};
