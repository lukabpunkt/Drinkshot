/**
 * Grabstein-Pop — steht am Ende jeder Todesanimation ausser Miracle (GDD §4.2).
 *
 * Kein Atlas-Asset: der Stein wird einmal als Canvas-Textur gezeichnet. Das spart einen
 * Atlas-Umlauf und hält die Form an einer Stelle änderbar.
 */

import type { Container} from 'pixi.js';
import { Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';
import { MOTION, UI_COLORS, hex } from '@/config/theme';

let cached: Texture | undefined;

function tombstoneTexture(): Texture {
  if (cached) return cached;

  const width = 96;
  const height = 120;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = hex(UI_COLORS.ink);
    ctx.fillStyle = '#C9CEDA';

    ctx.beginPath();
    ctx.moveTo(12, height - 8);
    ctx.lineTo(12, 46);
    ctx.arc(width / 2, 46, width / 2 - 12, Math.PI, 0);
    ctx.lineTo(width - 12, height - 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // "RIP" als Balken statt als Text — sprachneutral und ohne Font-Abhängigkeit.
    ctx.fillStyle = hex(UI_COLORS.ink);
    ctx.fillRect(30, 44, 36, 8);
    ctx.fillRect(30, 60, 36, 8);
    ctx.fillRect(30, 76, 22, 8);
  }

  cached = Texture.from(canvas);
  return cached;
}

/**
 * Lässt einen Grabstein mit Bounce aus dem Boden springen.
 * Gibt die Timeline zurück, damit die DeathSequence sie einhängen kann.
 */
export function popTombstone(
  layer: Container,
  x: number,
  y: number,
  scale = 1
): { sprite: Sprite; timeline: gsap.core.Timeline } {
  const sprite = new Sprite(tombstoneTexture());
  sprite.anchor.set(0.5, 1);
  sprite.position.set(x, y);
  sprite.scale.set(scale * 0.2);
  sprite.alpha = 0;
  sprite.zIndex = y;
  layer.addChild(sprite);

  const timeline = gsap.timeline();
  timeline.to(sprite, { alpha: 1, duration: 0.08 });
  timeline.to(
    sprite.scale,
    { x: scale, y: scale, duration: MOTION.base / 1000, ease: MOTION.easeOvershoot },
    0
  );
  timeline.from(sprite, { y: y + 40, duration: MOTION.base / 1000, ease: MOTION.easeDrop }, 0);

  return { sprite, timeline };
}
