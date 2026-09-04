/**
 * `miss_then_hit` — Der erste Schuss geht daneben: eine Erdfontäne neben dem Männchen.
 * Es dreht sich erleichtert zur Kamera, winkt „Puh!" — und wird mitten im Winken getroffen
 * (GDD §4.1).
 *
 * Das ist der grausamste Gag der Sammlung und lebt komplett vom Timing: Die Erleichterung
 * muss lang genug sein, dass man sie mitfühlt, und der zweite Schuss muss fallen, während
 * die Hand noch oben ist. Kommt er danach, ist es nur ein zweiter Schuss.
 */

import gsap from 'gsap';
import { MOTION } from '@/config/theme';
import { t } from '@/core/i18n';
import { dirtFountain } from '../../fx/MuzzleFlash';
import { popSpeechBubble } from '../../fx/SpeechBubble';
import { finishDeath, secondShot } from '../../fx/deathFinish';
import type { DeathContext, DeathSequence } from '../DeathSequence';
import { deathMeta } from '../catalog';

export const missThenHit: DeathSequence = {
  ...deathMeta('miss_then_hit'),

  build(ctx: DeathContext): gsap.core.Timeline {
    const { victim, camera, fx, audio } = ctx;
    const { body, armL, armR, head } = victim.rig;
    const timeline = gsap.timeline();

    const x = victim.brain.x;
    const y = victim.brain.y;
    const direction = victim.brain.facing;
    const missX = x + 70 * direction;

    victim.setDriven(true);

    /* --- Daneben: die Erde spritzt neben ihm hoch --- */
    timeline.call(() => {
      victim.brain.stop();
      victim.setFace('scared');
      audio.play('hit_stop_thud', 0, -4);
      dirtFountain(fx.particles, { x: missX, y });
      camera.shakeScreen(120, 5);
    });
    // Er zuckt weg — Anticipation für die Erleichterung danach.
    timeline.to(body, { x: -14 * direction, rotation: -0.18 * direction, duration: 0.1, ease: 'power2.out' });
    timeline.to({}, { duration: 0.18 });

    /* --- Erleichterung --- */
    timeline.call(() => {
      victim.setFace('happy');
      audio.play('crowd_ooh', 0, 4);
    });
    timeline.to(body, { x: 0, rotation: 0, duration: 0.24, ease: MOTION.easeOvershoot });
    // Er dreht sich zur Kamera.
    timeline.to(body.scale, { x: -direction, duration: 0.22, ease: 'power2.inOut' });

    /* --- Und winkt --- */
    timeline.call(() => {
      victim.setFace('wave');
      const bubble = popSpeechBubble(fx.overlay, t('deaths.phew'), x, y - victim.height, 1100);
      bubble.sprite.zIndex = y + 5000;
    });
    timeline.to(armR, { rotation: -2.3, duration: 0.16, ease: MOTION.easeOvershoot });
    // Das Winken läuft weiter, während das Reticle schon wieder anlegt.
    timeline.to(armR, {
      rotation: -1.7,
      duration: 0.22,
      repeat: 3,
      yoyo: true,
      ease: 'sine.inOut',
    });

    /* --- Der zweite Schuss, mitten im Winken --- */
    secondShot(ctx, timeline, { trackMs: 620, holdMs: 200 });

    /* --- Einfrieren, X-Augen, umkippen --- */
    timeline.call(() => {
      /*
       * Erst **hier** ist er tot — vorher lebt er noch, und genau das ist der Gag.
       * Ohne diese Zeile bliebe er im Zustand `walk` und liefe nach der Runde weiter.
       */
      victim.setState('dead');
      // Der Arm bleibt oben stehen — das ist das Bild, das hängen bleibt.
      gsap.killTweensOf(armR);
      armR.rotation = -2.1;
      victim.setFace('x_eyes');
      audio.play('star_twinkle', 0, -2);
    });
    // Hit-Stop: 80 ms Standbild auf genau diesem Frame.
    timeline.to({}, { duration: 0.08 });

    timeline.to(body.scale, { x: -direction * 1.3, y: 0.7, duration: 0.06, ease: 'power2.out' });
    timeline.to(body.scale, { x: -direction, y: 1, duration: 0.16, ease: MOTION.easeElastic });

    timeline.call(() => audio.play('tree_fall'));
    timeline.to(victim.view, {
      rotation: (Math.PI / 2) * direction,
      duration: 0.4,
      ease: 'back.in(1.4)',
    });
    timeline.to(head, { rotation: -0.3, duration: 0.4, ease: 'power2.in' }, '<');
    timeline.call(() => {
      audio.play('hit_stop_thud');
      fx.particles.emit('dust', x, y, 7, { speed: 170, gravity: -40, spread: Math.PI });
      camera.shakeScreen(200, 9);
    });
    timeline.to(armL, { rotation: 0.3, duration: 0.2, ease: MOTION.easeElastic });

    return finishDeath(ctx, timeline, { x, y, delayMs: 150 });
  },
};
