/**
 * `leg_hop` — Der erste Schuss trifft das Bein. Das Männchen hüpft auf einem Bein mit
 * „Aua!"-Sprechblase in Kreisen weiter und versucht zu flüchten. Das Reticle folgt ihm
 * anderthalb Sekunden — und dann fällt der zweite Schuss (GDD §4.1).
 *
 * Der Witz sitzt im Timing dazwischen: Man sieht das Fadenkreuz mitwandern und weiß, was
 * kommt. Genau dieses Warten ist die Pointe, nicht der Schuss.
 */

import gsap from 'gsap';
import { MOTION } from '@/config/theme';
import { t } from '@/core/i18n';
import { popSpeechBubble } from '../../fx/SpeechBubble';
import { finishDeath, impactBeat, secondShot } from '../../fx/deathFinish';
import type { DeathContext, DeathSequence } from '../DeathSequence';

/** Wie viele Hüpfer, bevor der Scharfschütze die Geduld verliert. */
const HOPS = 5;
const HOP_MS = 220;

export const legHop: DeathSequence = {
  id: 'leg_hop',
  zone: 'leg',
  weight: 10,
  needsSecondShot: true,

  build(ctx: DeathContext): gsap.core.Timeline {
    const { victim, camera, fx, audio, arena } = ctx;
    const { body, legL, legR, footL, armL, armR } = victim.rig;
    const timeline = gsap.timeline();

    const startX = victim.brain.x;
    const startY = victim.brain.y;
    const direction = victim.brain.facing;

    victim.setDriven(true);

    /* --- Treffer ins Bein: er zieht es sofort hoch --- */
    timeline.call(() => {
      victim.setState('dead'); // spielmechanisch tot, auch wenn er noch hüpft
      victim.brain.stop();
      victim.setFace('ouch');
      audio.play('hit_stop_thud');
      fx.particles.emit('dust', startX, startY, 4, { speed: 120, gravity: -30, spread: Math.PI });
      camera.shakeScreen(140, 6);
    });
    impactBeat(timeline, body, { squash: false });

    timeline.call(() => {
      const bubble = popSpeechBubble(fx.overlay, t('deaths.ouch'), startX, startY - victim.height, 900);
      bubble.sprite.zIndex = startY + 5000;
    });
    // Das getroffene Bein zieht sich an, das andere trägt.
    timeline.to(legL, { rotation: 1.35, duration: 0.14, ease: MOTION.easeOvershoot });
    timeline.to(footL, { y: footL.y - 34, duration: 0.14, ease: MOTION.easeOvershoot }, '<');
    timeline.to(armL, { rotation: -1.2, duration: 0.14, ease: MOTION.easeOvershoot }, '<');
    timeline.to(armR, { rotation: 1.2, duration: 0.14, ease: MOTION.easeOvershoot }, '<');

    /* --- Die Hüpfer: ein Bogen im Kreis um die Ausgangsposition --- */
    const radius = victim.height * 0.55;
    for (let i = 0; i < HOPS; i++) {
      const angle = (i / HOPS) * Math.PI * 1.4 * direction;
      const targetX = startX + Math.cos(angle) * radius * (i + 1) * 0.28;
      const targetY = startY + Math.sin(angle) * radius * (i + 1) * 0.18;

      timeline.call(() => audio.play('ui_tap', 0, -6 + i));
      // Hoch …
      timeline.to(victim.view, {
        x: (startX + targetX) / 2,
        y: (startY + targetY) / 2 - 42,
        duration: HOP_MS / 2000,
        ease: 'power2.out',
      });
      timeline.to(legR, { rotation: -0.4, duration: HOP_MS / 2000, ease: 'power2.out' }, '<');
      // … und runter, mit Squash beim Aufsetzen.
      timeline.to(victim.view, {
        x: targetX,
        y: targetY,
        duration: HOP_MS / 2000,
        ease: 'power2.in',
      });
      timeline.to(legR, { rotation: 0.2, duration: HOP_MS / 2000, ease: 'power2.in' }, '<');
      timeline.to(
        body.scale,
        { x: 1.14, y: 0.86, duration: 0.05, ease: 'power2.out' },
        `-=${0.03}`
      );
      timeline.to(body.scale, { x: 1, y: 1, duration: 0.09, ease: MOTION.easeElastic });

      victim.brain.x = targetX;
      victim.brain.y = targetY;
    }

    /* --- Das Reticle nimmt die Verfolgung auf --- */
    timeline.call(() => {
      victim.setFace('panic');
      const bubble = popSpeechBubble(
        fx.overlay,
        t('deaths.notAgain'),
        victim.view.x,
        victim.view.y - victim.height,
        800
      );
      bubble.sprite.zIndex = victim.view.y + 5000;
    });
    secondShot(ctx, timeline, { trackMs: 950, holdMs: 320 });

    /* --- Und er fällt wie ein gefällter Baum --- */
    const finalX = victim.view.x;
    const finalY = victim.view.y;
    timeline.call(() => {
      victim.setFace('x_eyes');
      audio.play('tree_fall');
    });
    timeline.to(victim.view, {
      rotation: (Math.PI / 2) * direction,
      duration: 0.44,
      ease: 'back.in(1.5)',
    });
    timeline.call(() => {
      audio.play('hit_stop_thud');
      fx.particles.emit('dust', finalX, finalY, 7, { speed: 170, gravity: -40, spread: Math.PI });
      camera.shakeScreen(190, 9);
    });
    timeline.to(body.scale, { x: 1.08, y: 0.92, duration: 0.16, ease: MOTION.easeElastic });

    void arena;
    return finishDeath(ctx, timeline, { x: finalX, y: finalY, delayMs: 150 });
  },
};
