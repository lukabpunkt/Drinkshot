/**
 * `leg_spin` — Das Bein wird getroffen, das Männchen rotiert wie ein Kreisel auf der
 * Stelle, wird immer schneller und bohrt sich ins Erdreich. Nur noch der Kopf guckt heraus.
 * Der zweite Schuss macht „plopp" — und ein Grabstein springt aus dem Loch (GDD §4.1).
 *
 * Die Beschleunigung ist wichtig: Ein gleichmässiger Kreisel sieht aus wie ein Fehler,
 * ein beschleunigender wie ein Bohrer.
 */

import gsap from 'gsap';
import { MOTION } from '@/config/theme';
import { finishDeath, impactBeat, secondShot } from '../../fx/deathFinish';
import { spawnGroundProp } from '../../fx/GroundProp';
import type { DeathContext, DeathSequence } from '../DeathSequence';
import { deathMeta } from '../catalog';

export const legSpin: DeathSequence = {
  ...deathMeta('leg_spin'),

  build(ctx: DeathContext): gsap.core.Timeline {
    const { victim, camera, fx, audio } = ctx;
    const { body } = victim.rig;
    const timeline = gsap.timeline();

    const x = victim.brain.x;
    const y = victim.brain.y;

    victim.setDriven(true);

    /* --- Treffer --- */
    timeline.call(() => {
      victim.setState('dead');
      victim.brain.stop();
      victim.setFace('panic');
      audio.play('hit_stop_thud');
      camera.shakeScreen(140, 6);
    });
    impactBeat(timeline, body, { squash: false });

    /* --- Der Kreisel: beschleunigt, deshalb `power2.in` --- */
    let hole: ReturnType<typeof spawnGroundProp> | undefined;

    timeline.call(() => audio.play('rocket', 0, 10));
    timeline.to(body, {
      rotation: Math.PI * 9,
      duration: 1.15,
      ease: 'power2.in',
    });
    // Er wird beim Rotieren schmaler — wie etwas, das sich eindreht.
    timeline.to(body.scale, { x: 0.72, duration: 1.15, ease: 'power2.in' }, '<');
    // Das Loch öffnet sich **unter** ihm, auf dem Boden — nicht am rotierenden Körper.
    timeline.call(
      () => {
        hole = spawnGroundProp(fx.overlay, victim.textureFor('fx/hole'), {
          x,
          y,
          scale: victim.view.scale.x * 1.1,
          popMs: 450,
        });
        fx.particles.emit('dirt', x, y, 10, { speed: 240, gravity: 700, spread: Math.PI });
      },
      undefined,
      '<0.55'
    );

    /* --- Er versinkt, nur der Kopf bleibt --- */
    timeline.call(() => {
      audio.play('hit_stop_thud', 0, -8);
      victim.setFace('spiral');
    });
    timeline.to(body, { y: victim.height * 0.62, duration: 0.34, ease: 'power3.in' });
    timeline.to(body.scale, { x: 0.72, y: 0.9, duration: 0.34, ease: 'power3.in' }, '<');

    /* --- Der zweite Schuss --- */
    secondShot(ctx, timeline, { trackMs: 700, holdMs: 300 });

    /* --- „Plopp" — er verschwindet ganz, der Grabstein kommt aus dem Loch --- */
    timeline.call(() => {
      audio.play('rip_pop', 0, 6);
      fx.particles.emit('dirt', x, y, 8, { speed: 200, gravity: 650, spread: Math.PI * 0.8 });
      fx.particles.emit('smoke', x, y - 20, 3, { speed: 70, gravity: -40, scale: 1.1 });
    });
    timeline.to(body, { y: victim.height, duration: 0.16, ease: 'power3.in' });
    timeline.to(body, { alpha: 0, duration: 0.12, ease: 'power2.in' }, '<0.06');
    timeline.call(() => {
      if (hole) gsap.to(hole.scale, { x: '+=0.16', y: '+=0.16', duration: 0.14, ease: MOTION.easeOvershoot });
    });

    return finishDeath(ctx, timeline, { x, y, delayMs: 90 });
  },
};
