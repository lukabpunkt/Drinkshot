/**
 * `body_deflate` — Das Männchen wird angeschossen wie ein Luftballon: Es zischt los,
 * fliegt in einer Schleifenbahn durch die Arena und landet schlaff als Häufchen (GDD §4.1).
 *
 * Die Bahn ist bewusst kein sauberer Kreis, sondern eine schrumpfende Spirale — Luft
 * entweicht, also wird jede Schleife kleiner und langsamer. Genau das liest man als
 * „geht die Luft aus".
 */

import gsap from 'gsap';
import { MOTION } from '@/config/theme';
import { finishDeath, impactBeat } from '../../fx/deathFinish';
import type { DeathContext, DeathSequence } from '../DeathSequence';
import { deathMeta } from '../catalog';

/** Wieviele Schleifen der Ballon fliegt, bevor die Luft raus ist. */
const LOOPS = 2.6;
const FLIGHT_MS = 1500;

export const bodyDeflate: DeathSequence = {
  ...deathMeta('body_deflate'),

  build(ctx: DeathContext): gsap.core.Timeline {
    const { victim, camera, fx, audio, arena, rng } = ctx;
    const { body } = victim.rig;
    const timeline = gsap.timeline();

    const startX = victim.brain.x;
    const startY = victim.brain.y;

    // Landepunkt: irgendwo in der Laufzone, aber nicht dort, wo er stand.
    const landAngle = rng.next() * Math.PI * 2;
    const landDistance = arena.walkRadius * rng.range(0.35, 0.8);
    const landX = arena.centerX + Math.cos(landAngle) * landDistance;
    const landY = arena.centerY + Math.sin(landAngle) * landDistance;

    victim.setDriven(true);

    /* --- Treffer: er bläht sich kurz auf, bevor es losgeht (Anticipation) --- */
    timeline.call(() => {
      victim.setState('dead');
      victim.brain.stop();
      victim.setFace('panic');
      audio.play('hit_stop_thud');
      camera.shakeScreen(130, 6);
    });
    impactBeat(timeline, body, { squash: false });
    timeline.to(victim.view.scale, {
      x: victim.view.scale.x * 1.3,
      y: victim.view.scale.y * 1.3,
      duration: 0.14,
      ease: 'power2.out',
    });

    /* --- Der Flug --- */
    const flight = { t: 0 };
    const baseScaleX = victim.view.scale.x;
    const baseScaleY = victim.view.scale.y;
    let lastPuff = -1;

    timeline.call(() => audio.play('balloon_deflate'));
    timeline.to(flight, {
      t: 1,
      duration: FLIGHT_MS / 1000,
      ease: 'power1.out',
      onUpdate: () => {
        const progress = flight.t;
        // Schrumpfende Spirale: Radius und Winkelgeschwindigkeit nehmen gemeinsam ab.
        const angle = progress * Math.PI * 2 * LOOPS;
        const radius = victim.height * 1.5 * (1 - progress);
        const pathX = startX + (landX - startX) * progress + Math.cos(angle) * radius;
        const pathY =
          startY + (landY - startY) * progress + Math.sin(angle) * radius * 0.55 - (1 - progress) * 60;

        victim.view.position.set(pathX, pathY);
        victim.view.rotation = angle * 0.6;
        // Die Luft geht raus: er wird kleiner und schlaffer.
        const shrink = 1 - progress * 0.45;
        victim.view.scale.set(baseScaleX * shrink, baseScaleY * shrink);
        victim.view.zIndex = pathY;

        /*
         * Partikel-Spur, aber nicht jeden Frame — sonst ist das Budget sofort leer.
         * Der Abstand hängt am Flugfortschritt, nicht am Zufall: Die Show muss aus dem
         * Seed reproduzierbar bleiben (Dev-Panel „Show erneut abspielen").
         */
        const puff = Math.floor(progress * 22);
        if (puff !== lastPuff) {
          lastPuff = puff;
          fx.particles.emit('smoke', pathX, pathY, 1, { speed: 40, gravity: -20, scale: 0.7 });
        }
      },
    });

    /* --- Landung als Häufchen --- */
    timeline.call(() => {
      victim.setFace('x_eyes');
      audio.play('hit_stop_thud', 0, -6);
      fx.particles.emit('dust', landX, landY, 6, { speed: 120, gravity: -30, spread: Math.PI });
      camera.shakeScreen(120, 4);
    });
    timeline.to(victim.view.scale, {
      x: baseScaleX * 0.95,
      y: baseScaleY * 0.3,
      duration: 0.16,
      ease: 'power3.out',
    });
    timeline.to(victim.view, { rotation: 0, duration: 0.16, ease: 'power2.out' }, '<');
    timeline.to(body, { y: 26, duration: 0.16, ease: 'power2.out' }, '<');
    // Ein letztes müdes Nachwippen.
    timeline.to(victim.view.scale, {
      y: baseScaleY * 0.34,
      duration: 0.26,
      ease: MOTION.easeElastic,
    });

    return finishDeath(ctx, timeline, { x: landX, y: landY, delayMs: 140 });
  },
};
