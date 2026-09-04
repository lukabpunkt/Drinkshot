/**
 * `body_dramatic` — Der Theater-Tod: Hand auf die Brust, drei taumelnde Schritte, Drehung,
 * auf die Knie, noch einmal aufstehen („noch nicht!"), dann endgültig fallen (GDD §4.1).
 *
 * 2,5 Sekunden Overacting. Die zweite Aufsteh-Bewegung ist der Gag — sie muss deshalb
 * einen Moment zu lange dauern, sonst wirkt sie wie ein Fehler statt wie Absicht.
 */

import gsap from 'gsap';
import { MOTION } from '@/config/theme';
import { t } from '@/core/i18n';
import { popSpeechBubble } from '../../fx/SpeechBubble';
import { finishDeath, impactBeat } from '../../fx/deathFinish';
import type { DeathContext, DeathSequence } from '../DeathSequence';
import { deathMeta } from '../catalog';

export const bodyDramatic: DeathSequence = {
  ...deathMeta('body_dramatic'),

  build(ctx: DeathContext): gsap.core.Timeline {
    const { victim, camera, fx, audio } = ctx;
    const { body, armL, armR, head } = victim.rig;
    const timeline = gsap.timeline();

    const x = victim.brain.x;
    const y = victim.brain.y;
    const direction = victim.brain.facing;

    victim.setDriven(true);

    /* --- Treffer: Hand fährt an die Brust --- */
    timeline.call(() => {
      victim.setState('dead');
      victim.brain.stop();
      victim.setFace('ouch');
      audio.play('hit_stop_thud');
      camera.shakeScreen(150, 7);
    });
    impactBeat(timeline, body);

    timeline.to(armL, { rotation: -1.5, duration: 0.16, ease: MOTION.easeOvershoot });
    timeline.to(armR, { rotation: 0.9, duration: 0.16, ease: MOTION.easeOvershoot }, '<');
    timeline.to(head, { rotation: -0.3, duration: 0.16, ease: MOTION.easeOvershoot }, '<');

    /* --- Drei taumelnde Schritte, jeder kürzer als der vorige --- */
    const steps = [46, 32, 20];
    steps.forEach((distance, index) => {
      timeline.to(victim.view, {
        x: victim.view.x + distance * direction,
        duration: 0.22,
        ease: 'power1.out',
      });
      timeline.to(
        body,
        { rotation: (index % 2 === 0 ? 0.22 : -0.18), duration: 0.22, ease: 'sine.inOut' },
        '<'
      );
    });

    /* --- Drehung zur Kamera --- */
    timeline.to(body.scale, { x: -direction, duration: 0.2, ease: 'power2.inOut' });
    timeline.call(() => {
      const bubble = popSpeechBubble(fx.overlay, t('deaths.notYet'), x, y - victim.height, 700);
      bubble.sprite.zIndex = y + 5000;
      audio.play('crowd_ooh');
    });

    /* --- Auf die Knie --- */
    timeline.to(body, { y: 26, rotation: 0.1, duration: 0.3, ease: 'power2.in' });
    timeline.to(body.scale, { y: 0.82, duration: 0.3, ease: 'power2.in' }, '<');
    timeline.call(() => audio.play('hit_stop_thud', 0, -5));

    /* --- Und noch einmal hoch. Zu lange, absichtlich. --- */
    timeline.to({}, { duration: 0.22 });
    timeline.call(() => victim.setFace('panic'));
    timeline.to(body, { y: -6, rotation: -0.05, duration: 0.34, ease: MOTION.easeOvershoot });
    timeline.to(body.scale, { y: 1.06, duration: 0.34, ease: MOTION.easeOvershoot }, '<');
    timeline.to(armL, { rotation: -2.4, duration: 0.34, ease: MOTION.easeOvershoot }, '<');
    timeline.to({}, { duration: 0.3 });

    /* --- Endgültig --- */
    timeline.call(() => {
      victim.setFace('x_eyes');
      audio.play('tree_fall');
    });
    timeline.to(body, {
      rotation: (Math.PI / 2) * direction,
      y: 10,
      duration: 0.4,
      ease: 'back.in(1.4)',
    });
    timeline.to(armL, { rotation: -0.2, duration: 0.4, ease: 'power2.in' }, '<');
    timeline.call(() => {
      audio.play('hit_stop_thud');
      fx.particles.emit('dust', x, y, 7, { speed: 170, gravity: -40, spread: Math.PI });
      camera.shakeScreen(190, 8);
    });
    timeline.to(body.scale, { y: 0.94, x: 1.08, duration: 0.18, ease: MOTION.easeElastic });

    return finishDeath(ctx, timeline, { x, y, delayMs: 160 });
  },
};
