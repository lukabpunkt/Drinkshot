/**
 * Requisiten, die auf dem **Boden** liegen und nicht am Männchen hängen.
 *
 * Das Erdloch aus `leg_spin` und `butt_rocket` gehört dorthin, wo eingeschlagen wurde —
 * nicht an den Körper. Als Rig-Overlay dreht und verschiebt es sich mit ihm mit und landet
 * dann über dem Kopf statt unter den Füssen.
 */

import { Sprite, type Container, type Texture } from 'pixi.js';
import gsap from 'gsap';
import { MOTION } from '@/config/theme';
import { DEATH_PROP_LABEL } from './Tombstone';

export interface GroundPropOptions {
  x: number;
  y: number;
  scale?: number;
  /** Ohne Angabe erscheint die Requisite sofort. */
  popMs?: number;
}

export function spawnGroundProp(
  layer: Container,
  texture: Texture,
  options: GroundPropOptions
): Sprite {
  const sprite = new Sprite(texture);
  sprite.label = DEATH_PROP_LABEL;
  sprite.anchor.set(0.5, 0.5);
  sprite.position.set(options.x, options.y);
  sprite.scale.set(options.scale ?? 1);
  // Knapp unter dem Männchen einsortieren, damit es im Loch steckt und nicht darauf.
  sprite.zIndex = options.y - 1;
  layer.addChild(sprite);

  if (options.popMs) {
    sprite.alpha = 0;
    sprite.scale.set((options.scale ?? 1) * 0.3);
    gsap.to(sprite, { alpha: 1, duration: options.popMs / 2000, ease: 'none' });
    gsap.to(sprite.scale, {
      x: options.scale ?? 1,
      y: options.scale ?? 1,
      duration: options.popMs / 1000,
      ease: MOTION.easeOvershoot,
    });
  }

  return sprite;
}
