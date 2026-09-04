/**
 * Der Charakter (Art Direction §5).
 *
 * Ein gerigger Container aus Einzel-Sprites: Schatten, zwei Beine, zwei Fuesse, Torso mit
 * Symbol, zwei Arme, Kopf mit Gesicht und Hut. Koerperteile sind weiss gezeichnet und
 * werden per `tint` eingefaerbt; Gesicht, Hut, Fuesse und Symbol bleiben ungetintet.
 *
 * Der Walk-Cycle ist **prozedural** (ADR-4): Bein-Pendel, Torso-Squash und Arm-Schwung
 * laufen ueber die zurueckgelegte Strecke, nicht ueber die Zeit — dadurch passt die
 * Schrittfrequenz automatisch zum Tempo.
 */

import { Container, Sprite, type Spritesheet, type Texture } from 'pixi.js';
import {
  ARENA,
  colorById,
  HAT_CHANCE,
  shotlingHeightFor,
  type ColorId,
  type FaceId,
  type HatId,
} from '@/config/theme';
import type { SeededRng } from '@/core/rng';
import type { ShotlingBrain, ShotlingState } from './ShotlingBrain';

/**
 * Rig-Layout in Textur-Pixeln (@1x), Ursprung zwischen den Fuessen, y negativ = oben.
 * Die Gesamthoehe von 270 px wird ueber `RIG_SCALE` auf `ARENA.shotlingHeight` gebracht.
 */
const RIG = {
  height: 276,
  shadow: { x: 0, y: 0, anchorY: 0.5 },
  foot: { x: 20, y: 0, anchorY: 1 },
  leg: { x: 20, y: -60, anchorY: 0.08 },
  torso: { x: 0, y: -56, anchorY: 1 },
  symbol: { x: 0, y: -110, anchorY: 0.5 },
  arm: { x: 44, y: -146, anchorY: 0.12 },
  head: { x: 0, y: -212, anchorY: 0.5 },
  face: { x: 0, y: -210, anchorY: 0.5 },
  /** Der Hut sitzt 8 Einheiten unter der Kopfoberkante, sonst schwebt er. */
  hat: { x: 0, y: -268, anchorY: 1 },
} as const;

/** Rig-Massstab fuer eine gegebene Spielhoehe in Welteinheiten. */
export function rigScaleFor(height: number): number {
  return height / RIG.height;
}

/** Wie weit die Beine ausschlagen (Grad). */
const LEG_SWING = 26;
const ARM_SWING = 18;
/** Ruhewinkel der Arme in Radiant. */
const ARM_REST = 0.2;
/** Welteinheiten pro voller Schrittfolge — bestimmt die Schrittfrequenz. */
const STRIDE = 62;
const SHADOW_ALPHA = 0.35;

/**
 * Die Teile, die eine Todesanimation bewegen darf.
 *
 * Bewusst als eigenes Interface statt `public`-Felder: Sequenzen sollen animieren, aber
 * nicht am Zustand des Shotlings schrauben. Was hier nicht steht, gehört dem Shotling.
 */
export interface ShotlingRig {
  /** Alles ausser dem Schatten — kippt und taumelt als Ganzes. */
  readonly body: Container;
  /** Kopf mit Gesicht und Hut; dreht sich unabhängig vom Körper. */
  readonly head: Container;
  readonly torso: Sprite;
  readonly armL: Sprite;
  readonly armR: Sprite;
  readonly legL: Sprite;
  readonly legR: Sprite;
  readonly footL: Sprite;
  readonly footR: Sprite;
  readonly face: Sprite;
  readonly hat: Sprite;
  readonly shadow: Sprite;
}

export interface ShotlingOptions {
  sheet: Spritesheet;
  colorId: ColorId;
  brain: ShotlingBrain;
  rng: SeededRng;
  /** Ohne Angabe wird gewuerfelt: ~60 % tragen einen Hut. */
  hatId?: HatId;
  lowEffects?: boolean;
  /** Spielhoehe in Welteinheiten; ohne Angabe die Hoehe fuer 8 Spieler. */
  height?: number;
}

export class Shotling {
  readonly view = new Container();
  readonly brain: ShotlingBrain;
  readonly colorId: ColorId;

  private readonly sheet: Spritesheet;
  private readonly rng: SeededRng;

  private readonly body = new Container();
  private readonly shadow: Sprite;
  private readonly legL: Sprite;
  private readonly legR: Sprite;
  private readonly footL: Sprite;
  private readonly footR: Sprite;
  private readonly torso: Sprite;
  private readonly symbol: Sprite;
  private readonly armL: Sprite;
  private readonly armR: Sprite;
  private readonly head: Container;
  private readonly headShape: Sprite;
  private readonly face: Sprite;
  private readonly hat: Sprite;

  /**
   * Punkt, auf den das Fadenkreuz zielt: die Körpermitte, nicht der Bodenpunkt.
   * `brain.x/y` ist die Position der Füsse — würde das Reticle dorthin fahren, zielte es
   * konsequent auf den Rasen unter dem Männchen.
   */
  readonly aimPoint: { readonly x: number; readonly y: number };
  private readonly aimOffsetY: number;
  /** Ruhe-Skalierung des Rigs — `reset()` stellt sie wieder her. */
  private readonly baseScale: number;

  /** Overlays (Skelett, Eis) — werden bei `reset()` wieder abgeräumt. */
  private readonly overlays: Sprite[] = [];
  /**
   * Solange `true`, hält sich `update()` komplett heraus: keine Positions-Übernahme vom
   * Brain, kein Walk-Cycle. Eine Sequenz, die das Männchen durch die Arena fliegen lässt,
   * würde sonst jeden Frame vom Brain zurückgezogen.
   */
  private driven = false;
  private detachedHat: Container | undefined;

  private faceId: FaceId = 'neutral';
  private hatId: HatId;
  private blinkIn: number;
  private blinkRemaining = 0;
  private state: ShotlingState = 'walk';

  /** Liegt das Männchen schon? Double Tap fragt das, bevor es Zuschauer aufstellt. */
  get isDead(): boolean {
    return this.state === 'dead';
  }
  private lowEffects: boolean;

  constructor(options: ShotlingOptions) {
    this.sheet = options.sheet;
    this.rng = options.rng;
    this.brain = options.brain;
    this.colorId = options.colorId;
    this.lowEffects = options.lowEffects ?? false;

    const color = colorById(options.colorId);
    const tint = color.hex;

    this.shadow = this.makeSprite('shadow', RIG.shadow.x, RIG.shadow.y, RIG.shadow.anchorY);
    this.shadow.alpha = SHADOW_ALPHA;
    this.shadow.tint = 0x000000;

    this.legL = this.makeSprite('leg', -RIG.leg.x, RIG.leg.y, RIG.leg.anchorY, tint);
    this.legR = this.makeSprite('leg', RIG.leg.x, RIG.leg.y, RIG.leg.anchorY, tint);
    this.footL = this.makeSprite('foot', -RIG.foot.x, RIG.foot.y, RIG.foot.anchorY);
    this.footR = this.makeSprite('foot', RIG.foot.x, RIG.foot.y, RIG.foot.anchorY);

    this.torso = this.makeSprite('torso', RIG.torso.x, RIG.torso.y, RIG.torso.anchorY, tint);
    this.symbol = this.makeSprite(
      `symbols/${color.symbol}`,
      RIG.symbol.x,
      RIG.symbol.y,
      RIG.symbol.anchorY
    );

    this.armL = this.makeSprite('arm', -RIG.arm.x, RIG.arm.y, RIG.arm.anchorY, tint);
    this.armR = this.makeSprite('arm', RIG.arm.x, RIG.arm.y, RIG.arm.anchorY, tint);
    // Ruhepose: leicht abgespreizt, damit die Arme aus der Koerper-Silhouette herausragen.
    this.armL.rotation = ARM_REST;
    this.armR.rotation = -ARM_REST;

    this.headShape = this.makeSprite('head', 0, 0, 0.5, tint);
    this.face = this.makeSprite('faces/neutral', 0, RIG.face.y - RIG.head.y, RIG.face.anchorY);

    this.hatId = options.hatId ?? this.rollHat();
    this.hat = this.makeSprite(this.hatFrame(), 0, RIG.hat.y - RIG.head.y, RIG.hat.anchorY);
    this.hat.visible = this.hatId !== 'none';

    this.head = new Container();
    this.head.position.set(RIG.head.x, RIG.head.y);
    this.head.addChild(this.headShape, this.face, this.hat);

    // Zeichenreihenfolge = Tiefenstaffelung (Art Direction §5.1).
    this.body.addChild(
      this.footL,
      this.footR,
      this.legL,
      this.legR,
      this.torso,
      this.symbol,
      this.armL,
      this.armR,
      this.head
    );

    this.view.addChild(this.shadow, this.body);
    this.baseScale = rigScaleFor(options.height ?? shotlingHeightFor(8));
    this.view.scale.set(this.baseScale);

    const height = options.height ?? shotlingHeightFor(8);
    this.aimOffsetY = height * 0.58;
    // Live-Getter statt Momentaufnahme: das Ziel läuft weiter, während das Reticle fährt.
    const brain = this.brain;
    const offsetY = this.aimOffsetY;
    this.aimPoint = {
      get x(): number {
        return brain.x;
      },
      get y(): number {
        return brain.y - offsetY;
      },
    };

    this.blinkIn = this.rng.intBetween(ARENA.blinkIntervalMs[0], ARENA.blinkIntervalMs[1]);
    this.syncPosition();
  }

  private texture(frame: string): Texture {
    const texture = this.sheet.textures[frame];
    if (!texture) throw new Error(`Frame "${frame}" fehlt im Shotling-Atlas.`);
    return texture;
  }

  private makeSprite(frame: string, x: number, y: number, anchorY: number, tint?: number): Sprite {
    const sprite = new Sprite(this.texture(frame));
    sprite.anchor.set(0.5, anchorY);
    sprite.position.set(x, y);
    if (tint !== undefined) sprite.tint = tint;
    return sprite;
  }

  private rollHat(): HatId {
    if (!this.rng.chance(HAT_CHANCE)) return 'none';
    return this.rng.pick(['cap', 'party', 'tophat', 'helmet', 'crown', 'beanie'] as const);
  }

  private hatFrame(): string {
    return `hats/${this.hatId === 'none' ? 'cap' : this.hatId}`;
  }

  /* ------------------------------------------------------------------ */
  /* Öffentliche Steuerung                                               */
  /* ------------------------------------------------------------------ */

  setFace(face: FaceId): void {
    if (this.faceId === face) return;
    this.faceId = face;
    this.face.texture = this.texture(`faces/${face}`);
  }

  getFace(): FaceId {
    return this.faceId;
  }

  setHat(hat: HatId): void {
    this.hatId = hat;
    this.hat.visible = hat !== 'none';
    if (hat !== 'none') this.hat.texture = this.texture(`hats/${hat}`);
  }

  getHat(): HatId {
    return this.hatId;
  }

  setState(state: ShotlingState): void {
    if (this.state === state) return;
    this.state = state;
    this.brain.state = state;

    switch (state) {
      case 'aimed':
        this.setFace('scared');
        break;
      case 'panic':
        this.setFace('panic');
        break;
      case 'dead':
        this.setFace('x_eyes');
        this.brain.stop();
        break;
      default:
        this.setFace('neutral');
    }
  }

  getState(): ShotlingState {
    return this.state;
  }

  /** Dreht den Kopf leicht zur Kamera — "ich sehe, dass du mich siehst". */
  lookAt(cameraX: number, cameraY: number): void {
    const dx = cameraX - this.brain.x;
    const dy = cameraY - this.brain.y;
    const angle = Math.atan2(dy, dx);
    this.head.rotation = Math.max(-0.22, Math.min(0.22, Math.cos(angle) * 0.22));
  }

  resetHead(): void {
    this.head.rotation = 0;
  }

  setLowEffects(low: boolean): void {
    this.lowEffects = low;
    this.shadow.visible = !low;
  }

  /**
   * Setzt das Rig auf die Ausgangspose zurück.
   *
   * Audit A4 prüft genau das: Nach einer Sequenz plus `reset()` muss der Shotling wieder
   * `idle` sein — sonst schleppt die nächste Runde einen halb umgekippten Körper mit.
   * Deshalb wird hier jedes Teil angefasst, nicht nur die, die `basic_fall` bewegt.
   */
  reset(): void {
    this.driven = false;

    for (const overlay of this.overlays) overlay.destroy();
    this.overlays.length = 0;

    // Einen weggeflogenen Hut zurück an den Kopf holen.
    if (this.detachedHat) {
      this.head.addChild(this.hat);
      this.detachedHat = undefined;
    }
    this.hat.position.set(0, RIG.hat.y - RIG.head.y);
    this.hat.rotation = 0;
    this.hat.alpha = 1;
    this.hat.scale.set(1);
    this.hat.visible = this.hatId !== 'none';

    this.view.position.set(this.brain.x, this.brain.y);
    this.view.rotation = 0;
    this.view.alpha = 1;
    /*
     * Die Skalierung gehört zwingend dazu: `body_deflate` schrumpft das ganze Rig,
     * `body_freeze_shatter` lässt es verschwinden. Ohne diese Zeile bliebe das Männchen
     * für den Rest der Session platt — und zwar lautlos.
     */
    this.view.scale.set(this.baseScale);

    this.body.position.set(0, 0);
    this.body.rotation = 0;
    this.body.scale.set(1);
    this.body.alpha = 1;

    this.torso.scale.set(1);
    this.torso.rotation = 0;
    this.torso.alpha = 1;

    this.head.rotation = 0;
    this.head.scale.set(1);
    this.head.alpha = 1;
    this.head.position.set(RIG.head.x, RIG.head.y);

    this.armL.rotation = ARM_REST;
    this.armR.rotation = -ARM_REST;
    this.legL.rotation = 0;
    this.legR.rotation = 0;
    this.footL.position.set(-RIG.foot.x, RIG.foot.y);
    this.footR.position.set(RIG.foot.x, RIG.foot.y);

    this.shadow.alpha = SHADOW_ALPHA;
    this.shadow.scale.set(1);
    this.shadow.visible = !this.lowEffects;

    this.state = 'idle';
    this.brain.state = 'walk';
    this.setFace('neutral');
  }

  /**
   * Textur aus dem Shotling-Atlas — Sequenzen holen sich darüber Skelett, Eis und
   * Scherben, ohne den Spritesheet selbst herumreichen zu müssen.
   */
  textureFor(frame: string): Texture {
    return this.texture(frame);
  }

  /** Zugriff für Todesanimationen (Architektur §6). */
  get rig(): ShotlingRig {
    return {
      body: this.body,
      head: this.head,
      torso: this.torso,
      armL: this.armL,
      armR: this.armR,
      legL: this.legL,
      legR: this.legR,
      footL: this.footL,
      footR: this.footR,
      face: this.face,
      hat: this.hat,
      shadow: this.shadow,
    };
  }

  /** Übergibt die Kontrolle an eine Sequenz (siehe `driven`). */
  setDriven(driven: boolean): void {
    this.driven = driven;
  }

  isDriven(): boolean {
    return this.driven;
  }

  /** Grösse des Rigs in Welteinheiten — Sequenzen rechnen Flughöhen daraus. */
  get height(): number {
    return RIG.height * this.view.scale.y;
  }

  /**
   * Hängt den Hut an einen anderen Container um, damit er unabhängig vom Kopf fliegen
   * kann. Die Weltposition bleibt erhalten. Gibt `null` zurück, wenn kein Hut da ist.
   */
  detachHat(target: Container): Sprite | null {
    if (this.hatId === 'none' || !this.hat.visible) return null;
    const global = this.hat.getGlobalPosition();
    this.detachedHat = target;
    target.addChild(this.hat);
    this.hat.position.copyFrom(target.toLocal(global));
    this.hat.scale.set(this.view.scale.x, this.view.scale.y);
    return this.hat;
  }

  /**
   * Legt ein Sprite deckungsgleich über den Körper — Skelett-Silhouette, Eisblock.
   * Wird bei `reset()` mitentfernt.
   */
  addOverlay(texture: Texture, options: { anchorY?: number; y?: number } = {}): Sprite {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, options.anchorY ?? 1);
    sprite.position.set(0, options.y ?? 0);
    this.body.addChild(sprite);
    this.overlays.push(sprite);
    return sprite;
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }

  /* ------------------------------------------------------------------ */
  /* Frame-Update — hier wird nichts allokiert (Architektur §7.11)        */
  /* ------------------------------------------------------------------ */

  update(dtMs: number): void {
    // Während eine Sequenz das Rig steuert, hält sich die Automatik komplett heraus.
    if (this.driven) return;
    this.syncPosition();
    this.updateBlink(dtMs);
    this.updateWalkCycle();
  }

  private syncPosition(): void {
    this.view.position.set(this.brain.x, this.brain.y);
    // Nur den Koerper spiegeln, nicht den Schatten — sonst springt der Blob.
    this.body.scale.x = this.brain.facing;
    // Tiefenstaffelung: wer weiter unten steht, wird spaeter gezeichnet.
    this.view.zIndex = this.brain.y;
  }

  private updateBlink(dtMs: number): void {
    if (this.state === 'dead') return;

    if (this.blinkRemaining > 0) {
      this.blinkRemaining -= dtMs;
      if (this.blinkRemaining <= 0) {
        this.face.texture = this.texture(`faces/${this.faceId}`);
      }
      return;
    }

    this.blinkIn -= dtMs;
    if (this.blinkIn > 0) return;

    this.blinkIn = this.rng.intBetween(ARENA.blinkIntervalMs[0], ARENA.blinkIntervalMs[1]);
    // Blinzeln tauscht nur die Textur, nicht den gemerkten Gesichtszustand.
    if (this.faceId === 'neutral' || this.faceId === 'happy') {
      this.face.texture = this.texture('faces/blink');
      this.blinkRemaining = ARENA.blinkDurationMs;
    }
  }

  private updateWalkCycle(): void {
    if (this.state === 'dead') {
      this.legL.rotation = 0;
      this.legR.rotation = 0;
      return;
    }

    const speed = this.brain.speed;
    // Bei Stillstand fahren die Ausschlaege auf null, statt hart zu stoppen.
    const intensity = Math.min(1, speed / 90);
    const phase = (this.brain.distanceWalked / STRIDE) * Math.PI * 2;

    const swing = Math.sin(phase) * intensity;
    const legRadians = (LEG_SWING * Math.PI) / 180;
    this.legL.rotation = swing * legRadians;
    this.legR.rotation = -swing * legRadians;
    this.footL.position.y = RIG.foot.y - Math.max(0, swing) * 9 * intensity;
    this.footR.position.y = RIG.foot.y - Math.max(0, -swing) * 9 * intensity;
    this.footL.position.x = -RIG.foot.x + swing * 12 * intensity;
    this.footR.position.x = RIG.foot.x - swing * 12 * intensity;

    const armRadians = (ARM_SWING * Math.PI) / 180;
    this.armL.rotation = ARM_REST - swing * armRadians;
    this.armR.rotation = -ARM_REST + swing * armRadians;

    // Squash & Stretch: zweimal pro Schrittfolge, weil beide Fuesse aufsetzen.
    const bounce = Math.abs(Math.cos(phase)) * intensity;
    this.torso.scale.y = 1 + bounce * 0.06 - 0.03 * intensity;
    this.torso.scale.x = 1 - bounce * 0.05 + 0.025 * intensity;
    this.head.position.y = RIG.head.y - bounce * 4 * intensity;

    if (!this.lowEffects) {
      this.shadow.scale.set(1 - bounce * 0.06, 1 - bounce * 0.06);
    }
  }
}

export { RIG };
