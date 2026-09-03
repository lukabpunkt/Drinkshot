/**
 * Bewegungs-KI der Shotlings (GDD §5.1).
 *
 * Bewusst **ohne PIXI-Import**: reine Zahlen, damit die Steuerung unit-testbar bleibt
 * (Audit A2: "bleibt in der Laufzone", "Separation haelt Mindestabstand").
 *
 * Performance (Architektur §7.11): `update()` allokiert nichts. Alle Zwischenwerte
 * liegen als Felder auf der Instanz oder als Modul-Konstanten.
 */

import type { SeededRng } from '@/core/rng';

export type ShotlingState = 'idle' | 'walk' | 'panic' | 'aimed' | 'dead';

export interface BrainOptions {
  /** Mittelpunkt der Laufzone in Weltkoordinaten. */
  centerX: number;
  centerY: number;
  /** Radius, den kein Shotling verlassen darf. */
  radius: number;
  rng: SeededRng;
  /** Mindestabstand zu anderen Shotlings; ohne Angabe `SEPARATION_DISTANCE`. */
  separation?: number;
  /** Startposition; ohne Angabe wird zufaellig in der Zone gewuerfelt. */
  x?: number;
  y?: number;
  /**
   * Startaufstellung: gleichmaessig auf einem Ring statt zufaellig. Verhindert, dass
   * die Runde mit einem Knaeuel in der Mitte beginnt.
   */
  slot?: { index: number; count: number };
}

/** Basisgeschwindigkeit in Welteinheiten pro Sekunde. */
const BASE_SPEED = 105;
/** Wie schnell die Richtung dem Ziel folgt (1/s). */
const TURN_RATE = 4.2;
/**
 * Standard-Mindestabstand in Welteinheiten. Die Arena rechnet ihn aus der tatsaechlichen
 * Shotling-Hoehe aus (`separationFor`), damit der Abstand bei zwei grossen Maennchen
 * genauso stimmt wie bei acht kleinen.
 */
export const SEPARATION_DISTANCE = 130;
/** Staerke der Abstossung. */
const SEPARATION_FORCE = 190;
/** Wie nah am Ziel gilt es als erreicht. */
const ARRIVE_DISTANCE = 40;
/** Neues Ziel spaetestens nach dieser Zeit. */
const RETARGET_MS = [1400, 3200] as const;
/** Anteil des Radius, in dem Ziele gewuerfelt werden — haelt sie vom Rand weg. */
const TARGET_RADIUS_FACTOR = 0.86;

export class ShotlingBrain {
  x: number;
  y: number;
  /** Richtung, in die das Maennchen schaut: -1 links, +1 rechts. */
  facing: 1 | -1 = 1;
  /** Zurueckgelegte Strecke — treibt den Walk-Cycle, damit er nicht von der Zeit abhaengt. */
  distanceWalked = 0;
  state: ShotlingState = 'walk';
  /** Wird von der Show gesetzt: Scan 1.0, Panik 1.6, Lock 0.4 (GDD §5.1). */
  speedMultiplier = 1;

  private readonly centerX: number;
  private readonly centerY: number;
  private readonly radius: number;
  private readonly rng: SeededRng;
  private readonly separation: number;

  private targetX = 0;
  private targetY = 0;
  private retargetIn = 0;

  private velocityX = 0;
  private velocityY = 0;

  /** Kurzer Geschwindigkeitsschub, z. B. nach einem Reticle-Wechsel (M3). */
  private burstMs = 0;
  private burstFactor = 1;

  constructor(options: BrainOptions) {
    this.centerX = options.centerX;
    this.centerY = options.centerY;
    this.radius = options.radius;
    this.rng = options.rng;
    this.separation = options.separation ?? SEPARATION_DISTANCE;

    if (options.x !== undefined && options.y !== undefined) {
      this.x = options.x;
      this.y = options.y;
    } else if (options.slot) {
      const { index, count } = options.slot;
      const angle = (index / Math.max(1, count)) * Math.PI * 2 + this.rng.range(-0.15, 0.15);
      const distance = this.radius * this.rng.range(0.45, 0.8);
      this.x = this.centerX + Math.cos(angle) * distance;
      this.y = this.centerY + Math.sin(angle) * distance;
    } else {
      // Gleichverteilt in der Kreisflaeche (sqrt, sonst haeuft es sich in der Mitte).
      const angle = this.rng.next() * Math.PI * 2;
      const distance = Math.sqrt(this.rng.next()) * this.radius * TARGET_RADIUS_FACTOR;
      this.x = this.centerX + Math.cos(angle) * distance;
      this.y = this.centerY + Math.sin(angle) * distance;
    }

    this.pickTarget();
  }

  /** Neues Wander-Ziel innerhalb der Laufzone. */
  pickTarget(): void {
    const angle = this.rng.next() * Math.PI * 2;
    const distance = Math.sqrt(this.rng.next()) * this.radius * TARGET_RADIUS_FACTOR;
    this.targetX = this.centerX + Math.cos(angle) * distance;
    this.targetY = this.centerY + Math.sin(angle) * distance;
    this.retargetIn = this.rng.intBetween(RETARGET_MS[0], RETARGET_MS[1]);
  }

  /** Kurzer Sprint — in M3 der "rennt weg"-Moment nach dem Reticle-Wechsel. */
  burst(durationMs: number, factor = 2.2): void {
    this.burstMs = durationMs;
    this.burstFactor = factor;
    this.pickTarget();
  }

  /**
   * Ein Simulationsschritt.
   *
   * @param dtMs      vergangene Zeit in Millisekunden
   * @param neighbours andere Gehirne fuer die Separation (darf die eigene Instanz enthalten)
   */
  update(dtMs: number, neighbours: readonly ShotlingBrain[] = EMPTY): void {
    if (this.state === 'dead') return;

    const dt = dtMs / 1000;

    if (this.burstMs > 0) {
      this.burstMs -= dtMs;
      if (this.burstMs <= 0) this.burstFactor = 1;
    }

    this.retargetIn -= dtMs;
    if (this.retargetIn <= 0) this.pickTarget();

    /* --- Anziehung zum Ziel --- */
    let desiredX = this.targetX - this.x;
    let desiredY = this.targetY - this.y;
    const targetDistance = Math.hypot(desiredX, desiredY);
    if (targetDistance < ARRIVE_DISTANCE) {
      this.pickTarget();
      desiredX = this.targetX - this.x;
      desiredY = this.targetY - this.y;
    }
    const length = Math.hypot(desiredX, desiredY) || 1;
    desiredX /= length;
    desiredY /= length;

    /* --- Separation: schiebt Ueberlappungen auseinander --- */
    for (let i = 0; i < neighbours.length; i++) {
      const other = neighbours[i]!;
      if (other === this || other.state === 'dead') continue;
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= this.separation || distance === 0) continue;
      // Je naeher, desto staerker — bei Beruehrung volle Kraft.
      const push = (1 - distance / this.separation) * (SEPARATION_FORCE / BASE_SPEED);
      desiredX += (dx / distance) * push;
      desiredY += (dy / distance) * push;
    }

    /* --- Rand: nach innen umlenken, statt hart zu klemmen --- */
    const offsetX = this.x - this.centerX;
    const offsetY = this.y - this.centerY;
    const fromCenter = Math.hypot(offsetX, offsetY);
    const softEdge = this.radius * 0.9;
    if (fromCenter > softEdge) {
      const strength = (fromCenter - softEdge) / (this.radius - softEdge);
      desiredX -= (offsetX / fromCenter) * strength * 2.5;
      desiredY -= (offsetY / fromCenter) * strength * 2.5;
      if (fromCenter > softEdge * 1.02) this.pickTarget();
    }

    /* --- Geschwindigkeit weich nachziehen --- */
    const speed = BASE_SPEED * this.speedMultiplier * this.burstFactor;
    const desiredLength = Math.hypot(desiredX, desiredY) || 1;
    const targetVelocityX = (desiredX / desiredLength) * speed;
    const targetVelocityY = (desiredY / desiredLength) * speed;
    const blend = Math.min(1, TURN_RATE * dt);
    this.velocityX += (targetVelocityX - this.velocityX) * blend;
    this.velocityY += (targetVelocityY - this.velocityY) * blend;

    this.x += this.velocityX * dt;
    this.y += this.velocityY * dt;

    /* --- Harte Grenze: die Laufzone ist unverhandelbar --- */
    if (this.clampToZone()) {
      this.velocityX *= -0.2;
      this.velocityY *= -0.2;
    }

    const moved = Math.hypot(this.velocityX, this.velocityY) * dt;
    this.distanceWalked += moved;
    if (Math.abs(this.velocityX) > 6) this.facing = this.velocityX > 0 ? 1 : -1;
  }

  /** Der fuer dieses Maennchen geltende Mindestabstand. */
  get minDistance(): number {
    return this.separation;
  }

  /** Aktuelles Tempo in Welteinheiten pro Sekunde — der Walk-Cycle skaliert damit. */
  get speed(): number {
    return Math.hypot(this.velocityX, this.velocityY);
  }

  /**
   * Zieht die Position in die Laufzone zurueck. Gibt `true` zurueck, wenn korrigiert wurde.
   * Die Laufzone ist unverhandelbar — kein Shotling darf je ausserhalb stehen.
   */
  clampToZone(): boolean {
    const offsetX = this.x - this.centerX;
    const offsetY = this.y - this.centerY;
    const distance = Math.hypot(offsetX, offsetY);
    if (distance <= this.radius) return false;
    const scale = this.radius / distance;
    this.x = this.centerX + offsetX * scale;
    this.y = this.centerY + offsetY * scale;
    return true;
  }

  /** Abstand zum Zonen-Mittelpunkt (Testhilfe). */
  distanceFromCenter(): number {
    return Math.hypot(this.x - this.centerX, this.y - this.centerY);
  }

  stop(): void {
    this.velocityX = 0;
    this.velocityY = 0;
  }
}

const EMPTY: readonly ShotlingBrain[] = [];

/**
 * Loest verbliebene Ueberlappungen nach dem Integrationsschritt auf.
 *
 * Die weiche Separation in `update()` sorgt fuer natuerliches Ausweichen, kann in einem
 * Knaeuel aber ausgeglichen werden — die Kraefte von allen Seiten heben sich auf. Dieser
 * zweite Durchgang schiebt jedes Paar direkt auseinander und garantiert damit den
 * Mindestabstand (Audit A2).
 *
 * Allokationsfrei: nur Zahlen, keine Zwischen-Arrays.
 */
export function resolveOverlaps(brains: readonly ShotlingBrain[], minDistance?: number): void {
  // Mehrere Durchgaenge: schiebt man A von B weg, kann A in C rutschen. Bei hoechstens
  // acht Maennchen konvergiert das nach wenigen Iterationen und kostet nichts.
  for (let pass = 0; pass < RELAX_PASSES; pass++) {
    let moved = false;

    for (let i = 0; i < brains.length; i++) {
      const a = brains[i]!;
      if (a.state === 'dead') continue;

      for (let j = i + 1; j < brains.length; j++) {
        const b = brains[j]!;
        if (b.state === 'dead') continue;

        const limit = minDistance ?? Math.max(a.minDistance, b.minDistance);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= limit) continue;

        // Richtung: bei exakter Deckung eine feste Achse, damit es deterministisch bleibt.
        const unitX = distance === 0 ? 1 : dx / distance;
        const unitY = distance === 0 ? 0 : dy / distance;
        const push = (limit - distance) / 2;

        a.x -= unitX * push;
        a.y -= unitY * push;
        b.x += unitX * push;
        b.y += unitY * push;

        a.clampToZone();
        b.clampToZone();
        moved = true;
      }
    }

    if (!moved) return;
  }
}

/** Iterationen der Positionskorrektur je Frame. */
const RELAX_PASSES = 4;
