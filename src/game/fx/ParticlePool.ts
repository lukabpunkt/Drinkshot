/**
 * Object-Pools für Partikel (Art Direction §8, Architektur §7.5).
 *
 * Regel: **nie `new Sprite()` im Loop.** Jeder Effekt holt sich Sprites aus dem Pool und
 * gibt sie zurück; die Gesamtzahl aktiver Partikel ist hart gedeckelt.
 */

import { Container, Sprite, Texture } from 'pixi.js';
import { PARTICLE_BUDGET, UI_COLORS } from '@/config/theme';

export type ParticleKind = 'star' | 'dust' | 'smoke' | 'dirt';

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  spin: number;
  gravity: number;
  fade: boolean;
}

/**
 * Kleine, einmalig gerasterte Texturen. Über Canvas statt über `Graphics`, damit die
 * Partikel echte Formen haben (ein getintetes `Texture.WHITE` wäre ein Quadrat) und
 * trotzdem alle in denselben Batch fallen.
 */
function makeTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 64): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) draw(context, size);
  return Texture.from(canvas);
}

function starTexture(): Texture {
  return makeTexture((ctx, size) => {
    const c = size / 2;
    const outer = size * 0.44;
    const inner = outer * 0.45;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      const x = c + Math.cos(angle) * radius;
      const y = c + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = size * 0.09;
    ctx.strokeStyle = '#1A1024';
    ctx.stroke();
  });
}

function softCircleTexture(): Texture {
  return makeTexture((ctx, size) => {
    const c = size / 2;
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.6, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
}

function solidCircleTexture(): Texture {
  return makeTexture((ctx, size) => {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
}

const MAX_BY_KIND: Record<ParticleKind, number> = {
  star: PARTICLE_BUDGET.impactStars.max,
  dust: PARTICLE_BUDGET.runDust.maxPerShotling * 8,
  smoke: PARTICLE_BUDGET.smokePuff.max,
  dirt: PARTICLE_BUDGET.dirtFountain.max,
};

const LIFE_BY_KIND: Record<ParticleKind, number> = {
  star: PARTICLE_BUDGET.impactStars.lifeMs,
  dust: PARTICLE_BUDGET.runDust.lifeMs,
  smoke: PARTICLE_BUDGET.smokePuff.lifeMs,
  dirt: PARTICLE_BUDGET.dirtFountain.lifeMs,
};

const TINT_BY_KIND: Record<ParticleKind, number> = {
  star: UI_COLORS.accent,
  dust: 0xffffff,
  smoke: 0xcfd3dd,
  dirt: UI_COLORS.arenaGrassDark,
};

const SIZE_BY_KIND: Record<ParticleKind, number> = {
  star: 26,
  dust: 14,
  smoke: 34,
  dirt: 12,
};

export class ParticlePool {
  readonly view = new Container();

  private readonly free: Sprite[] = [];
  private readonly active: Particle[] = [];
  private readonly textures: Record<ParticleKind, Texture>;
  private lowEffects = false;

  constructor(capacity = PARTICLE_BUDGET.maxActiveSprites) {
    const soft = softCircleTexture();
    this.textures = {
      star: starTexture(),
      dust: soft,
      smoke: soft,
      dirt: solidCircleTexture(),
    };

    for (let i = 0; i < capacity; i++) {
      const sprite = new Sprite(Texture.EMPTY);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.view.addChild(sprite);
      this.free.push(sprite);
    }
  }

  setLowEffects(value: boolean): void {
    this.lowEffects = value;
  }

  get activeCount(): number {
    return this.active.length;
  }

  /**
   * Stösst einen Schwall Partikel aus. `count` wird im Low-Modus halbiert und am
   * Kategorie-Budget gekappt (Art Direction §8).
   */
  emit(
    kind: ParticleKind,
    x: number,
    y: number,
    count: number,
    options: { speed?: number; gravity?: number; spread?: number; scale?: number } = {}
  ): void {
    const limit = Math.min(count, MAX_BY_KIND[kind]);
    const wanted = this.lowEffects ? Math.ceil(limit / 2) : limit;
    const speed = options.speed ?? 220;
    const gravity = options.gravity ?? 0;
    const spread = options.spread ?? Math.PI * 2;
    const scale = options.scale ?? 1;

    for (let i = 0; i < wanted; i++) {
      const sprite = this.free.pop();
      if (!sprite) return; // Pool leer — lieber weniger Partikel als eine Allokation.

      const angle = -Math.PI / 2 + (i / wanted - 0.5) * spread;
      const velocity = speed * (0.7 + (i % 3) * 0.2);

      sprite.visible = true;
      sprite.texture = this.textures[kind];
      sprite.position.set(x, y);
      sprite.tint = TINT_BY_KIND[kind];
      sprite.width = SIZE_BY_KIND[kind] * scale;
      sprite.height = SIZE_BY_KIND[kind] * scale;
      sprite.alpha = 1;
      sprite.rotation = 0;

      this.active.push({
        sprite,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: LIFE_BY_KIND[kind],
        maxLife: LIFE_BY_KIND[kind],
        spin: (i % 2 === 0 ? 1 : -1) * 4,
        gravity,
        fade: true,
      });
    }
  }

  /** Frame-Update — allokiert nichts, räumt von hinten nach vorn ab. */
  update(dtMs: number): void {
    const dt = dtMs / 1000;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const particle = this.active[i]!;
      particle.life -= dtMs;

      if (particle.life <= 0) {
        particle.sprite.visible = false;
        this.free.push(particle.sprite);
        // Reihenfolge egal: das letzte Element an die frei gewordene Stelle ziehen.
        this.active[i] = this.active[this.active.length - 1]!;
        this.active.pop();
        continue;
      }

      particle.vy += particle.gravity * dt;
      particle.sprite.x += particle.vx * dt;
      particle.sprite.y += particle.vy * dt;
      particle.sprite.rotation += particle.spin * dt;
      if (particle.fade) particle.sprite.alpha = particle.life / particle.maxLife;
    }
  }

  /** Alle Partikel sofort einsammeln (Rundenwechsel). */
  clear(): void {
    for (const particle of this.active) {
      particle.sprite.visible = false;
      this.free.push(particle.sprite);
    }
    this.active.length = 0;
  }

  destroy(): void {
    this.clear();
    for (const texture of new Set(Object.values(this.textures))) texture.destroy(true);
    this.view.destroy({ children: true });
  }
}
