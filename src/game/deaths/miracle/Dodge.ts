/**
 * `miracle_dodge` — Das Männchen bückt sich im ungünstigsten Moment, um einen Schnürsenkel
 * zu binden. Die Kugel fliegt darüber hinweg. Alle überleben, **niemand trinkt** (GDD §4.1).
 *
 * Der seltenste Ausgang des Spiels: einmal in vierzig Runden. Genau deshalb muss er sich
 * anders anfühlen als alle anderen — kein Grabstein, kein Nachbeben auf einen Toten,
 * sondern Erleichterung und Jubel. Das ist der Moment, den man am nächsten Tag erzählt.
 */

import gsap from 'gsap';
import { MOTION, UI_COLORS } from '@/config/theme';
import { t } from '@/core/i18n';
import { createCanvasTexture } from '../../fx/canvasTexture';
import { popSpeechBubble } from '../../fx/SpeechBubble';
import { finishDeath } from '../../fx/deathFinish';
import { spawnGroundProp } from '../../fx/GroundProp';
import type { DeathContext, DeathSequence } from '../DeathSequence';

/** Der Leuchtspur-Streifen der vorbeifliegenden Kugel. */
let tracerTexture: ReturnType<typeof createCanvasTexture> | undefined;

function getTracerTexture(): ReturnType<typeof createCanvasTexture> {
  tracerTexture ??= createCanvasTexture({
    width: 256,
    height: 16,
    draw: (ctx, width, height) => {
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, 'rgba(255,255,255,0)');
      gradient.addColorStop(0.65, 'rgba(255,248,231,0.95)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, height / 2 - 3, width, 6);
    },
  });
  return tracerTexture;
}

export const miracleDodge: DeathSequence = {
  id: 'miracle_dodge',
  zone: 'miracle',
  /*
   * Das Gewicht spielt hier keine Rolle: Die Seltenheit steuert `MIRACLE_CHANCE`
   * (1 von 40 Runden, GDD §4.1) direkt in `pickDeath`, nicht die gewichtete Auswahl.
   */
  weight: 1,
  needsSecondShot: false,

  build(ctx: DeathContext): gsap.core.Timeline {
    const { victim, camera, fx, audio, others } = ctx;
    const { body, head, armL, armR, footL } = victim.rig;
    const timeline = gsap.timeline();

    const x = victim.brain.x;
    const y = victim.brain.y;
    const headY = y - victim.height * 0.78;

    victim.setDriven(true);
    victim.brain.stop();

    /* --- Anticipation: er entdeckt den offenen Schnürsenkel --- */
    timeline.call(() => {
      victim.setFace('neutral');
      audio.play('ui_tap', 0, -4);
    });
    timeline.to(head, { rotation: 0.5, duration: 0.16, ease: MOTION.easeOvershoot });
    timeline.to(footL, { y: footL.y - 8, duration: 0.16, ease: 'power2.out' }, '<');

    /* --- Und bückt sich. Genau jetzt. --- */
    timeline.to(body, {
      y: victim.height * 0.3,
      rotation: 0.24,
      duration: 0.22,
      ease: 'power2.in',
    });
    timeline.to(body.scale, { y: 0.72, x: 1.12, duration: 0.22, ease: 'power2.in' }, '<');
    timeline.to(armL, { rotation: -2.1, duration: 0.22, ease: 'power2.in' }, '<');
    timeline.to(armR, { rotation: 2.1, duration: 0.22, ease: 'power2.in' }, '<');

    /* --- Die Kugel fliegt genau dort durch, wo eben noch der Kopf war --- */
    timeline.call(() => {
      const tracer = spawnGroundProp(fx.overlay, getTracerTexture(), {
        x: x - victim.height * 1.6,
        y: headY,
        scale: victim.view.scale.x * 1.4,
      });
      tracer.zIndex = 200_000;
      audio.play('gunshot', 0, 4);
      gsap.to(tracer, {
        x: x + victim.height * 2.4,
        duration: 0.18,
        ease: 'none',
        onComplete: () => tracer.destroy(),
      });
      camera.shakeScreen(140, 6);
    });
    timeline.to({}, { duration: 0.22 });

    /* --- Er richtet sich auf und begreift langsam --- */
    timeline.call(() => victim.setFace('neutral'));
    timeline.to(body, { y: 0, rotation: 0, duration: 0.26, ease: MOTION.easeOvershoot });
    timeline.to(body.scale, { y: 1, x: 1, duration: 0.26, ease: MOTION.easeOvershoot }, '<');
    timeline.to(armL, { rotation: 0.2, duration: 0.26, ease: MOTION.easeOvershoot }, '<');
    timeline.to(armR, { rotation: -0.2, duration: 0.26, ease: MOTION.easeOvershoot }, '<');
    timeline.to(footL, { y: footL.y, duration: 0.2, ease: 'power2.out' }, '<');

    // Er schaut sich um. Erst rechts, dann links, dann zur Kamera.
    timeline.to(head, { rotation: -0.4, duration: 0.18, ease: 'power2.inOut' });
    timeline.to(head, { rotation: 0.4, duration: 0.22, ease: 'power2.inOut' });
    timeline.to(head, { rotation: 0, duration: 0.18, ease: 'power2.inOut' });

    /* --- Und dann der Jubel --- */
    timeline.call(() => {
      victim.setFace('happy');
      audio.play('miracle_choir');
      const bubble = popSpeechBubble(fx.overlay, t('deaths.phew'), x, y - victim.height, 1200);
      bubble.sprite.zIndex = y + 5000;
      // Goldene Sterne statt Staub — hier stirbt niemand.
      fx.particles.emit('star', x, headY, 8, { speed: 220, gravity: 260, scale: 1.1 });
    });

    // Freudensprünge, mit Überschwung.
    for (let i = 0; i < 2; i++) {
      timeline.to(victim.view, { y: y - 52, duration: 0.18, ease: 'power2.out' });
      timeline.to(victim.view, { y, duration: 0.2, ease: 'power2.in' });
      timeline.to(body.scale, { x: 1.12, y: 0.88, duration: 0.06, ease: 'power2.out' });
      timeline.to(body.scale, { x: 1, y: 1, duration: 0.14, ease: MOTION.easeElastic });
    }
    timeline.to(armL, { rotation: -2.4, duration: 0.16, repeat: 3, yoyo: true, ease: 'sine.inOut' }, '<0.2');
    timeline.to(armR, { rotation: 2.4, duration: 0.16, repeat: 3, yoyo: true, ease: 'sine.inOut' }, '<');

    /* --- Die anderen feiern mit --- */
    timeline.call(() => {
      for (const other of others) {
        if (other.getState() === 'dead') continue;
        other.setFace('happy');
      }
      audio.play('crowd_laugh');
    });

    /*
     * Kein Grabstein. Der gemeinsame Abschluss läuft trotzdem — für das Nachbeben und
     * damit die anderen stehen bleiben und hinsehen. Nur das Grab entfällt.
     */
    void UI_COLORS;
    return finishDeath(ctx, timeline, { x, y, tombstone: false, delayMs: 120 });
  },
};
