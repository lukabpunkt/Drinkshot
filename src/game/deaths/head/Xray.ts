/**
 * `head_xray` — Ein kurzer Röntgen-Blitz: Vier Frames lang ist statt des Männchens sein
 * Skelett zu sehen, dann sinkt es mit Spiral-Augen in sich zusammen (GDD §4.1).
 *
 * Das Flackern muss hart sein — ein weicher Übergang würde wie ein Effekt aussehen statt
 * wie ein Blitz. Deshalb `set()` statt `to()`, vier Mal, ohne Easing dazwischen.
 */

import gsap from 'gsap';
import { UI_COLORS } from '@/config/theme';
import { impactStars } from '../../fx/MuzzleFlash';
import { finishDeath, impactBeat } from '../../fx/deathFinish';
import type { DeathContext, DeathSequence } from '../DeathSequence';

/** Vier Frames bei 60 Hz — genau so kurz, dass man es sieht, ohne es zu begreifen. */
const FLICKER_FRAMES = 4;
const FRAME_MS = 1000 / 60;

export const headXray: DeathSequence = {
  id: 'head_xray',
  zone: 'head',
  weight: 9,
  needsSecondShot: false,

  build(ctx: DeathContext): gsap.core.Timeline {
    const { victim, camera, fx, audio } = ctx;
    const { body, head } = victim.rig;
    const timeline = gsap.timeline();

    const x = victim.brain.x;
    const y = victim.brain.y;
    const headY = y - victim.height * 0.72;

    victim.setDriven(true);

    /* --- Der Blitz --- */
    const skeleton = victim.addOverlay(
      victim.textureFor('fx/skeleton'),
      { anchorY: 1, y: 8 }
    );
    skeleton.visible = false;
    skeleton.tint = UI_COLORS.paper;

    timeline.call(() => {
      victim.setState('dead');
      victim.brain.stop();
      audio.play('xray_zap');
      camera.shakeScreen(120, 5);
    });

    // Hartes Flackern: Skelett an, Körper aus — und zurück.
    for (let i = 0; i < FLICKER_FRAMES; i++) {
      timeline.call(() => {
        skeleton.visible = true;
        body.alpha = 0.12;
      });
      timeline.to({}, { duration: FRAME_MS / 1000 });
      timeline.call(() => {
        skeleton.visible = false;
        body.alpha = 1;
      });
      timeline.to({}, { duration: FRAME_MS / 1000 });
    }

    timeline.call(() => {
      victim.setFace('spiral');
      impactStars(fx.particles, { x, y: headY, power: 0.9 });
      audio.play('star_twinkle');
    });
    impactBeat(timeline, head);

    /* --- Zusammensacken: kein Umkippen, sondern in sich zusammenfallen --- */
    timeline.to(body.scale, { y: 0.45, x: 1.22, duration: 0.42, ease: 'power3.in' });
    timeline.to(body, { y: 18, duration: 0.42, ease: 'power3.in' }, '<');
    timeline.to(head, { rotation: 0.55, duration: 0.42, ease: 'power2.in' }, '<');

    timeline.call(() => {
      audio.play('hit_stop_thud', 0, -3);
      fx.particles.emit('dust', x, y, 6, { speed: 130, gravity: -40, spread: Math.PI });
      camera.shakeScreen(140, 5);
    });
    // Nachfedern, damit der Körper nicht wie eingefroren liegt.
    timeline.to(body.scale, { y: 0.5, x: 1.16, duration: 0.2, ease: 'elastic.out(1, 0.5)' });

    return finishDeath(ctx, timeline, { x, y, delayMs: 140 });
  },
};
