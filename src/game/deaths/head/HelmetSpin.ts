/**
 * `head_helmet_spin` — Der Kopf schraubt sich drei Mal um die eigene Achse, das Männchen
 * bleibt stehen, blinzelt einmal ungläubig und fällt dann steif wie ein Brett nach hinten.
 * Sternchen kreisen (GDD §4.1).
 *
 * Der Witz lebt von der Pause: Erst passiert etwas Absurdes, dann *nichts*, und erst dann
 * die Konsequenz. Ohne das Blinzeln dazwischen ist es nur eine Drehung.
 */

import gsap from 'gsap';
import { ANIM, MOTION } from '@/config/theme';
import { impactStars } from '../../fx/MuzzleFlash';
import { finishDeath, impactBeat } from '../../fx/deathFinish';
import type { DeathContext, DeathSequence } from '../DeathSequence';

export const headHelmetSpin: DeathSequence = {
  id: 'head_helmet_spin',
  zone: 'head',
  weight: 10,
  needsSecondShot: false,

  build(ctx: DeathContext): gsap.core.Timeline {
    const { victim, camera, fx, audio } = ctx;
    const { head, body } = victim.rig;
    const timeline = gsap.timeline();

    const x = victim.brain.x;
    const y = victim.brain.y;
    const headY = y - victim.height * 0.72;

    victim.setDriven(true);

    /* --- Treffer: Hit-Stop, Sterne, Kopf staucht --- */
    timeline.call(() => {
      victim.setState('dead');
      victim.brain.stop();
      victim.setFace('x_eyes');
      audio.play('hit_stop_thud');
      audio.play('star_twinkle', 0.06);
      impactStars(fx.particles, { x, y: headY, power: 1.1 });
      camera.shakeScreen(180, 8);
    });
    impactBeat(timeline, head);

    /* --- Anticipation: der Kopf zieht kurz gegen die Drehrichtung --- */
    timeline.to(head, { rotation: -0.35, duration: 0.12, ease: 'power2.out' });

    /* --- Die Schraube: drei volle Umdrehungen, am Ende ausrollend --- */
    timeline.to(head, {
      rotation: Math.PI * 6,
      duration: 0.9,
      ease: 'power2.out',
      onStart: () => audio.play('rocket', 0, 6),
    });
    /*
     * Ein runder Kopf, der sich dreht, sieht aus wie ein runder Kopf. Lesbar wird die
     * Schraube erst dadurch, dass er sich sichtbar **in den Torso hineinschraubt** und
     * dabei schmaler wird — dann versteht man die Bewegung auch ohne den Hut als Zeiger.
     */
    timeline.to(head, { y: head.y + 26, duration: 0.9, ease: 'power1.inOut' }, '<');
    timeline.to(head.scale, { x: 0.86, y: 0.94, duration: 0.9, ease: 'power1.inOut' }, '<');

    /* --- Und wieder heraus, mit Überschwung --- */
    timeline.to(head, { y: head.y, duration: 0.22, ease: MOTION.easeOvershoot });
    timeline.to(head.scale, { x: 1, y: 1, duration: 0.22, ease: MOTION.easeOvershoot }, '<');

    /* --- Die Pause: er merkt es noch gar nicht --- */
    timeline.call(() => victim.setFace('blink'));
    timeline.to({}, { duration: 0.22 });
    timeline.call(() => victim.setFace('x_eyes'));
    timeline.to({}, { duration: 0.18 });

    /* --- Und dann kippt er steif nach hinten --- */
    timeline.to(body, {
      rotation: -Math.PI / 2,
      duration: 0.4,
      ease: 'back.in(1.2)',
      onStart: () => audio.play('tree_fall'),
    });
    timeline.call(() => {
      audio.play('hit_stop_thud');
      fx.particles.emit('dust', x, y, 6, { speed: 160, gravity: -40, spread: Math.PI });
      camera.shakeScreen(160, 6);
    });
    // Follow-Through: der Kopf schwingt beim Aufprall nach.
    timeline.to(head, { rotation: Math.PI * 6 + 0.4, duration: 0.2, ease: MOTION.easeElastic });

    return finishDeath(ctx, timeline, { x, y, delayMs: ANIM.hitStopMs * 2 });
  },
};
