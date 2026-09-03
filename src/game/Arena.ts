/**
 * Die Arena (Art Direction §7).
 *
 * Kreisfläche mit dunklerem Aussenring, verstreute Grasbüschel und bis zu 4 Requisiten
 * entlang des Rings — nie in der Laufzone. Ausserhalb des Kreises wird **nichts** gezeichnet;
 * die Scope-Vignette deckt das ohnehin ab (Performance).
 *
 * Boden und Deko landen in einem gecachten Container (`cacheAsTexture`), damit sie pro Frame
 * nur eine Textur kosten statt ein paar Dutzend Draw-Calls (Architektur §7.3).
 */

import { Container, Graphics, Sprite, type Spritesheet } from 'pixi.js';
import { ARENA, UI_COLORS } from '@/config/theme';
import type { SeededRng } from '@/core/rng';

/** Requisiten stehen auf dem Ring, die Laufzone bleibt frei (GDD §5.2). */
const PROP_FRAMES = ['barrel', 'straw', 'target', 'cactus', 'crate', 'sign_danger', 'sign_bar'] as const;
const GRASS_FRAMES = ['grass1', 'grass2', 'grass3'] as const;

const GRASS_COUNT = 14;
/**
 * Props sitzen zwischen diesen Anteilen des Arena-Radius: ausserhalb der Laufzone
 * (sonst laufen die Männchen darüber) und innerhalb des Bodenkreises (draussen wird
 * bewusst nichts gezeichnet).
 */
const PROP_RING = [0.86, 0.93] as const;
/** Requisiten werden in Weltweite so gross gezeichnet. */
const PROP_SCALE = 0.55;
const GRASS_SCALE = 0.75;

export interface ArenaOptions {
  sheet: Spritesheet;
  rng: SeededRng;
}

export class Arena {
  readonly view = new Container();
  /** Hier laufen die Shotlings — sortiert nach y, damit sich Tiefe ergibt. */
  readonly actorLayer = new Container();

  /** Mittelpunkt und Radius der Laufzone in Weltkoordinaten. */
  readonly centerX = ARENA.worldSize / 2;
  readonly centerY = ARENA.worldSize / 2;
  readonly walkRadius: number;

  private readonly ground = new Container();

  constructor(options: ArenaOptions) {
    const { sheet, rng } = options;
    const radius = ARENA.circleDiameter / 2;
    // Die Laufzone endet vor dem Requisiten-Ring — Props sind Deko, keine Hindernisse.
    this.walkRadius = radius * ARENA.walkRadiusFactor;

    /* --- Boden: zwei Kreise, ein Graphics-Objekt --- */
    const floor = new Graphics();
    floor
      .circle(this.centerX, this.centerY, radius)
      .fill(UI_COLORS.arenaGrassDark)
      .circle(this.centerX, this.centerY, radius * 0.92)
      .fill(UI_COLORS.arenaGrass);
    this.ground.addChild(floor);

    /* --- Grasbüschel, zufällig aber deterministisch verteilt --- */
    for (let i = 0; i < GRASS_COUNT; i++) {
      const frame = rng.pick(GRASS_FRAMES);
      const angle = rng.next() * Math.PI * 2;
      const distance = Math.sqrt(rng.next()) * radius * 0.9;
      const grass = new Sprite(sheet.textures[frame]);
      grass.anchor.set(0.5, 1);
      grass.scale.set(GRASS_SCALE * rng.range(0.8, 1.2));
      grass.position.set(
        this.centerX + Math.cos(angle) * distance,
        this.centerY + Math.sin(angle) * distance
      );
      this.ground.addChild(grass);
    }

    /* --- Requisiten: höchstens 4, gleichmässig verteilt --- */
    const props = rng.shuffle(PROP_FRAMES).slice(0, ARENA.maxProps);
    const startAngle = rng.next() * Math.PI * 2;
    props.forEach((frame, index) => {
      const angle = startAngle + (index / props.length) * Math.PI * 2 + rng.range(-0.25, 0.25);
      const distance = radius * rng.range(PROP_RING[0], PROP_RING[1]);
      const prop = new Sprite(sheet.textures[frame]);
      prop.anchor.set(0.5, 1);
      prop.scale.set(PROP_SCALE);
      prop.position.set(
        this.centerX + Math.cos(angle) * distance,
        this.centerY + Math.sin(angle) * distance
      );
      this.ground.addChild(prop);
    });

    // Der Boden ändert sich nie — einmal rastern und danach als eine Textur zeichnen.
    this.ground.cacheAsTexture(true);

    this.actorLayer.sortableChildren = true;
    this.view.addChild(this.ground, this.actorLayer);
  }

  /** Erneuert den Boden-Cache, z. B. nach einem Auflösungswechsel. */
  refreshCache(): void {
    this.ground.cacheAsTexture(false);
    this.ground.cacheAsTexture(true);
  }

  destroy(): void {
    this.ground.cacheAsTexture(false);
    this.view.destroy({ children: true });
  }
}
