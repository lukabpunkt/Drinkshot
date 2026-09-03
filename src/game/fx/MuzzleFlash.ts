/**
 * Mündungsfeuer und Einschlag (GDD §4.2, Roadmap M3.5).
 *
 * Der Vollbild-Weissblitz liegt im Scope (`Scope.flash`); hier sitzt der Teil, der **in
 * der Welt** passiert: Sternchen um den Kopf, Rauchpuff, Erdfontäne beim Fehlschuss.
 */

import type { ParticlePool } from './ParticlePool';

export interface ImpactOptions {
  /** Weltkoordinaten des Treffers. */
  x: number;
  y: number;
  /** Skaliert die Wucht — Kopfschuss stärker als Streifschuss. */
  power?: number;
}

/** Sternchen kreisen um den Treffer, dazu ein Rauchpuff. */
export function impactStars(pool: ParticlePool, options: ImpactOptions): void {
  const power = options.power ?? 1;
  pool.emit('star', options.x, options.y, 8, { speed: 260 * power, gravity: 320, scale: power });
  pool.emit('smoke', options.x, options.y, 4, { speed: 90 * power, gravity: -40, scale: 1.2 });
}

/** Erdfontäne — der Fehlschuss neben dem Männchen (GDD §4.1 `miss_then_hit`). */
export function dirtFountain(pool: ParticlePool, options: ImpactOptions): void {
  pool.emit('dirt', options.x, options.y, 14, {
    speed: 340,
    gravity: 900,
    spread: Math.PI * 0.7,
  });
  pool.emit('smoke', options.x, options.y, 3, { speed: 60, gravity: -30, scale: 0.9 });
}

/** Staubwölkchen unter den Füssen beim Losrennen. */
export function runDust(pool: ParticlePool, x: number, y: number): void {
  pool.emit('dust', x, y, 2, { speed: 70, gravity: -20, spread: Math.PI * 0.5, scale: 0.8 });
}
