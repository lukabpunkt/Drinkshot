/**
 * Sprechblasen über den Männchen (GDD §4.2).
 *
 * Text im Canvas läuft laut Architektur §7.6 über `BitmapText`. Die Blase wird deshalb
 * **einmal je Text** gerastert und danach als Sprite bewegt — kein Text-Rebuild pro Frame.
 *
 * TODO(M4): Die Sprüche ("Aua!", "Puh!", "Warum ich?!") kommen aus i18n, sobald die
 * Todesanimationen sie brauchen.
 */

import type { Container} from 'pixi.js';
import { Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';
import { FONTS, MOTION, UI_COLORS, hex } from '@/config/theme';

const PADDING = 18;
const FONT_SIZE = 34;

function bubbleTexture(text: string): Texture {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return Texture.EMPTY;

  ctx.font = `${FONT_SIZE}px ${FONTS.display}`;
  const metrics = ctx.measureText(text);
  const width = Math.ceil(metrics.width) + PADDING * 2;
  const height = FONT_SIZE + PADDING * 2;
  const tail = 16;

  canvas.width = width;
  canvas.height = height + tail;

  // Nach dem Resize ist der Kontext zurückgesetzt.
  ctx.font = `${FONT_SIZE}px ${FONTS.display}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = hex(UI_COLORS.ink);
  ctx.fillStyle = hex(UI_COLORS.paper);

  const radius = 18;
  ctx.beginPath();
  ctx.moveTo(radius, 4);
  ctx.lineTo(width - radius, 4);
  ctx.quadraticCurveTo(width - 4, 4, width - 4, radius);
  ctx.lineTo(width - 4, height - radius);
  ctx.quadraticCurveTo(width - 4, height, width - radius, height);
  ctx.lineTo(width / 2 + 12, height);
  ctx.lineTo(width / 2, height + tail - 4);
  ctx.lineTo(width / 2 - 12, height);
  ctx.lineTo(radius, height);
  ctx.quadraticCurveTo(4, height, 4, height - radius);
  ctx.lineTo(4, radius);
  ctx.quadraticCurveTo(4, 4, radius, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = hex(UI_COLORS.ink);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 2);

  return Texture.from(canvas);
}

export interface SpeechBubbleHandle {
  sprite: Sprite;
  timeline: gsap.core.Timeline;
}

/** Blase mit Overshoot einblenden, halten, dann verschwinden lassen. */
export function popSpeechBubble(
  layer: Container,
  text: string,
  x: number,
  y: number,
  holdMs = 900
): SpeechBubbleHandle {
  const sprite = new Sprite(bubbleTexture(text));
  sprite.anchor.set(0.5, 1);
  sprite.position.set(x, y);
  sprite.scale.set(0.2);
  sprite.zIndex = y + 1000; // immer über den Männchen
  layer.addChild(sprite);

  const timeline = gsap.timeline({
    onComplete: () => {
      sprite.texture.destroy(true);
      sprite.destroy();
    },
  });
  timeline.to(sprite.scale, {
    x: 1,
    y: 1,
    duration: MOTION.fast / 1000,
    ease: MOTION.easeOvershoot,
  });
  timeline.to(sprite, { alpha: 0, duration: 0.18, ease: 'power2.in' }, `+=${holdMs / 1000}`);

  return { sprite, timeline };
}
