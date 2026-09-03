/**
 * `body_freeze_shatter` — Das Männchen erstarrt in einem Eisblock, kippt steif um und
 * zerspringt beim Aufprall in Scherben (GDD §4.1).
 *
 * Wichtig ist die Reihenfolge: Erst das Erstarren (schnell, mit hörbarem Knacken), dann
 * eine volle Sekunde Stillstand, dann das Kippen. Der Stillstand macht das Zerspringen
 * überhaupt erst zur Pointe — ohne ihn ist es nur eine Kette von Effekten.
 */

import gsap from 'gsap';
import { MOTION } from '@/config/theme';
import { finishDeath, impactBeat } from '../../fx/deathFinish';
import type { DeathContext, DeathSequence } from '../DeathSequence';

/** GDD nennt 6–8 Scherben. */
const SHARD_COUNT = 8;

export const bodyFreezeShatter: DeathSequence = {
  id: 'body_freeze_shatter',
  zone: 'body',
  weight: 9,
  needsSecondShot: false,

  build(ctx: DeathContext): gsap.core.Timeline {
    const { victim, camera, fx, audio } = ctx;
    const { body } = victim.rig;
    const timeline = gsap.timeline();

    const x = victim.brain.x;
    const y = victim.brain.y;
    const direction = victim.brain.facing;

    victim.setDriven(true);

    /* --- Treffer --- */
    timeline.call(() => {
      victim.setState('dead');
      victim.brain.stop();
      victim.setFace('scared');
      audio.play('hit_stop_thud');
      camera.shakeScreen(130, 6);
    });
    impactBeat(timeline, body, { squash: false });

    /* --- Das Eis wächst von unten über ihn --- */
    const ice = victim.addOverlay(victim.textureFor('fx/ice'), { anchorY: 1, y: 6 });
    ice.alpha = 0;
    ice.scale.set(1, 0.1);

    timeline.call(() => audio.play('ice_crack'));
    // Halbtransparent: Man muss den Erfrorenen im Block noch sehen, sonst ist es nur ein Klotz.
    timeline.to(ice, { alpha: 0.78, duration: 0.1, ease: 'none' });
    timeline.to(ice.scale, { y: 1, duration: 0.26, ease: MOTION.easeOvershoot }, '<');
    // Kurzes Zittern, während es zufriert.
    timeline.to(body, { x: 3, duration: 0.04, repeat: 5, yoyo: true, ease: 'none' }, '<');
    timeline.set(body, { x: 0 });

    /* --- Stillstand. Genau hier entsteht die Pointe. --- */
    timeline.call(() => victim.setFace('x_eyes'));
    timeline.to({}, { duration: 0.85 });

    /* --- Kippen: steif, wie ein Möbelstück --- */
    timeline.call(() => audio.play('tree_fall', 0, 4));
    timeline.to(victim.view, {
      rotation: (Math.PI / 2) * direction,
      duration: 0.42,
      ease: 'back.in(1.5)',
    });

    /* --- Und zerspringen --- */
    timeline.call(() => {
      audio.play('ice_crack', 0, -4);
      audio.play('star_twinkle', 0.05, 5);
      camera.shakeScreen(220, 11);

      // Scherben fliegen in alle Richtungen, mit Schwerkraft.
      fx.particles.emit('shard', x, y - victim.height * 0.4, SHARD_COUNT, {
        speed: 320,
        gravity: 820,
        spread: Math.PI * 1.6,
        scale: 1.1,
      });
      fx.particles.emit('smoke', x, y - victim.height * 0.35, 4, {
        speed: 80,
        gravity: -50,
        scale: 1.2,
      });

      // Der Körper verschwindet mit den Scherben — es bleibt nichts liegen.
      gsap.to(victim.view, { alpha: 0, duration: 0.14, ease: 'power2.in' });
    });
    timeline.to({}, { duration: 0.5 });

    return finishDeath(ctx, timeline, { x, y, delayMs: 100 });
  },
};
