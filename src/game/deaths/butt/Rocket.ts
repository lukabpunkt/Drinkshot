/**
 * `butt_rocket` — Treffer in den Hosenboden. Das Männchen schiesst mit Rauchspur senkrecht
 * aus dem Bild, kommt eine Sekunde später kopfüber im Boden steckend zurück, strampelt
 * kurz mit den Beinen und wird still (GDD §4.1).
 *
 * Die leere Sekunde dazwischen trägt den Gag. Wer sie kürzt, nimmt ihm die Pointe.
 */

import gsap from 'gsap';
import { MOTION } from '@/config/theme';
import { finishDeath, impactBeat } from '../../fx/deathFinish';
import { spawnGroundProp } from '../../fx/GroundProp';
import type { DeathContext, DeathSequence } from '../DeathSequence';

export const buttRocket: DeathSequence = {
  id: 'butt_rocket',
  zone: 'butt',
  weight: 10,
  needsSecondShot: false,

  build(ctx: DeathContext): gsap.core.Timeline {
    const { victim, camera, fx, audio, arena } = ctx;
    const { body, legL, legR } = victim.rig;
    const timeline = gsap.timeline();

    const x = victim.brain.x;
    const y = victim.brain.y;
    const flightHeight = arena.centerY * 2.2;

    victim.setDriven(true);

    /* --- Treffer: Anticipation nach unten, dann der Start --- */
    timeline.call(() => {
      victim.setState('dead');
      victim.brain.stop();
      victim.setFace('scared');
      audio.play('hit_stop_thud');
      camera.shakeScreen(150, 7);
    });
    impactBeat(timeline, body, { squash: false });
    timeline.to(victim.view, { y: y + 16, duration: 0.09, ease: 'power2.out' });

    /* --- Der Start --- */
    let lastPuff = -1;
    const flight = { t: 0 };
    timeline.call(() => audio.play('rocket'));
    timeline.to(flight, {
      t: 1,
      duration: 0.62,
      ease: 'power2.in',
      onUpdate: () => {
        const height = flight.t * flightHeight;
        victim.view.y = y - height;
        victim.view.rotation = flight.t * 0.6;
        // Rauchspur in festen Abständen — reproduzierbar, nicht zufällig.
        const puff = Math.floor(flight.t * 12);
        if (puff !== lastPuff) {
          lastPuff = puff;
          fx.particles.emit('smoke', x, y - height + 30, 1, {
            speed: 40,
            gravity: -30,
            scale: 1.1,
          });
        }
      },
    });

    /* --- Die leere Sekunde --- */
    timeline.call(() => {
      victim.view.visible = false;
      audio.play('crowd_ooh');
    });
    timeline.to({}, { duration: 0.95 });

    /* --- Und zurück, kopfüber --- */
    timeline.call(() => {
      victim.view.visible = true;
      victim.view.rotation = Math.PI;
      victim.view.y = y - flightHeight;
      victim.setFace('x_eyes');
      audio.play('reticle_move', 0, -14);
    });
    timeline.to(victim.view, { y: y - victim.height * 0.42, duration: 0.42, ease: 'power2.in' });

    timeline.call(() => {
      audio.play('hit_stop_thud');
      fx.particles.emit('dirt', x, y, 10, { speed: 260, gravity: 720, spread: Math.PI });
      fx.particles.emit('smoke', x, y, 3, { speed: 80, gravity: -40, scale: 1.2 });
      camera.shakeScreen(220, 10);
      // Das Loch gehört auf den Boden, nicht an den kopfüber steckenden Körper.
      spawnGroundProp(fx.overlay, victim.textureFor('fx/hole'), {
        x,
        y,
        scale: victim.view.scale.x * 1.15,
      });
    });

    /* --- Die Beine strampeln und werden still --- */
    timeline.to(legL, { rotation: -0.9, duration: 0.11, repeat: 5, yoyo: true, ease: 'sine.inOut' });
    timeline.to(
      legR,
      { rotation: 0.9, duration: 0.11, repeat: 5, yoyo: true, ease: 'sine.inOut' },
      '<'
    );
    timeline.to(legL, { rotation: 0.1, duration: 0.3, ease: MOTION.easeElastic });
    timeline.to(legR, { rotation: -0.1, duration: 0.3, ease: MOTION.easeElastic }, '<');

    return finishDeath(ctx, timeline, { x, y, delayMs: 120 });
  },
};
