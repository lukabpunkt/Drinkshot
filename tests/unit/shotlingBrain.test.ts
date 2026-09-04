/**
 * Bewegungs-Tests (Roadmap M2.9, Audit A2).
 *
 * Zwei Zusagen muessen ueber lange Laeufe halten:
 * die Laufzone wird nie verlassen, und zwei Shotlings kommen sich nie naeher als erlaubt.
 */

import { describe, expect, it } from 'vitest';
import { createSeededRng } from '@/core/rng';
import {
  resolveOverlaps,
  SEPARATION_DISTANCE,
  ShotlingBrain,
  type BrainOptions,
} from '@/game/ShotlingBrain';

const CENTER = 500;
const RADIUS = 350;
const STEP_MS = 16.7;

function makeBrain(seed: number, extra: Partial<BrainOptions> = {}): ShotlingBrain {
  return new ShotlingBrain({
    centerX: CENTER,
    centerY: CENTER,
    radius: RADIUS,
    rng: createSeededRng(seed),
    ...extra,
  });
}

function makeGroup(count: number, seed = 42, separation?: number): ShotlingBrain[] {
  const rng = createSeededRng(seed);
  return Array.from({ length: count }, (_, index) => {
    const options: BrainOptions = {
      centerX: CENTER,
      centerY: CENTER,
      radius: RADIUS,
      rng,
      slot: { index, count },
    };
    if (separation !== undefined) options.separation = separation;
    return new ShotlingBrain(options);
  });
}

/** Ein Frame für die ganze Gruppe — genau wie im ArenaScreen. */
function step(brains: ShotlingBrain[], dtMs = STEP_MS): void {
  for (const brain of brains) brain.update(dtMs, brains);
  resolveOverlaps(brains);
}

function minPairDistance(brains: readonly ShotlingBrain[]): number {
  let min = Infinity;
  for (let i = 0; i < brains.length; i++) {
    for (let j = i + 1; j < brains.length; j++) {
      min = Math.min(min, Math.hypot(brains[i]!.x - brains[j]!.x, brains[i]!.y - brains[j]!.y));
    }
  }
  return min;
}

describe('ShotlingBrain — Laufzone', () => {
  it('bleibt über 1 000 Schritte in der Zone (Einzelgänger)', () => {
    const brain = makeBrain(1);
    let maxDistance = 0;
    for (let i = 0; i < 1000; i++) {
      brain.update(STEP_MS);
      maxDistance = Math.max(maxDistance, brain.distanceFromCenter());
    }
    expect(maxDistance).toBeLessThanOrEqual(RADIUS + 1e-6);
  });

  it('bleibt über 1 000 Schritte in der Zone (8 Männchen mit Separation)', () => {
    const brains = makeGroup(8);
    let maxDistance = 0;
    for (let i = 0; i < 1000; i++) {
      step(brains);
      for (const brain of brains) {
        maxDistance = Math.max(maxDistance, brain.distanceFromCenter());
      }
    }
    expect(maxDistance).toBeLessThanOrEqual(RADIUS + 1e-6);
  });

  it('startet bereits innerhalb der Zone', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(makeBrain(seed).distanceFromCenter()).toBeLessThanOrEqual(RADIUS);
    }
  });

  it('hält auch bei sechsfacher Geschwindigkeit und großen Zeitschritten', () => {
    const brains = makeGroup(8);
    for (const brain of brains) brain.speedMultiplier = 6;
    for (let i = 0; i < 500; i++) {
      step(brains, 100); // absichtlich grobe Frames
      for (const brain of brains) {
        expect(brain.distanceFromCenter()).toBeLessThanOrEqual(RADIUS + 1e-6);
      }
    }
  });

  it('holt eine von außen gesetzte Position zurück', () => {
    const brain = makeBrain(3);
    brain.x = CENTER + RADIUS * 3;
    brain.y = CENTER;
    expect(brain.clampToZone()).toBe(true);
    expect(brain.distanceFromCenter()).toBeCloseTo(RADIUS, 6);
    // Innerhalb der Zone wird nichts verändert.
    expect(brain.clampToZone()).toBe(false);
  });
});

describe('ShotlingBrain — Separation', () => {
  it('hält den Mindestabstand über 1 000 Schritte', () => {
    const brains = makeGroup(8);
    // Erst einmal auflösen, dann messen — der Startzustand kommt aus dem Ring.
    resolveOverlaps(brains);
    let worst = Infinity;
    for (let i = 0; i < 1000; i++) {
      step(brains);
      worst = Math.min(worst, minPairDistance(brains));
    }
    // Der Rand kann ein Paar minimal zusammenschieben; 2 % Toleranz.
    expect(worst).toBeGreaterThan(SEPARATION_DISTANCE * 0.98);
  });

  it('zieht exakt übereinanderliegende Männchen auseinander', () => {
    const brains = makeGroup(2);
    brains[0]!.x = CENTER;
    brains[0]!.y = CENTER;
    brains[1]!.x = CENTER;
    brains[1]!.y = CENTER;
    resolveOverlaps(brains);
    expect(minPairDistance(brains)).toBeCloseTo(SEPARATION_DISTANCE, 5);
  });

  it('respektiert einen eigenen Mindestabstand', () => {
    const brains = makeGroup(4, 7, 200);
    for (let i = 0; i < 300; i++) step(brains);
    expect(minPairDistance(brains)).toBeGreaterThan(200 * 0.98);
  });

  it('ignoriert tote Männchen', () => {
    const brains = makeGroup(2);
    brains[1]!.state = 'dead';
    brains[0]!.x = CENTER;
    brains[0]!.y = CENTER;
    brains[1]!.x = CENTER;
    brains[1]!.y = CENTER;
    resolveOverlaps(brains);
    expect(brains[1]!.x).toBe(CENTER);
    expect(brains[1]!.y).toBe(CENTER);
  });
});

describe('ShotlingBrain — Verhalten', () => {
  it('bewegt sich überhaupt', () => {
    const brain = makeBrain(5);
    const startX = brain.x;
    const startY = brain.y;
    for (let i = 0; i < 120; i++) brain.update(STEP_MS);
    expect(Math.hypot(brain.x - startX, brain.y - startY)).toBeGreaterThan(40);
    expect(brain.distanceWalked).toBeGreaterThan(40);
  });

  it('ist bei gleichem Seed deterministisch', () => {
    const a = makeBrain(99);
    const b = makeBrain(99);
    for (let i = 0; i < 500; i++) {
      a.update(STEP_MS);
      b.update(STEP_MS);
    }
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
  });

  it('läuft mit höherem Multiplikator schneller', () => {
    const slow = makeBrain(11);
    const fast = makeBrain(11);
    fast.speedMultiplier = 1.6;
    for (let i = 0; i < 200; i++) {
      slow.update(STEP_MS);
      fast.update(STEP_MS);
    }
    expect(fast.distanceWalked).toBeGreaterThan(slow.distanceWalked * 1.3);
  });

  it('burst beschleunigt kurzzeitig und läuft dann aus', () => {
    const brain = makeBrain(13);
    brain.burst(300, 2.2);
    let burstDistance = 0;
    for (let i = 0; i < 18; i++) {
      const before = brain.distanceWalked;
      brain.update(STEP_MS);
      burstDistance += brain.distanceWalked - before;
    }
    const normal = makeBrain(13);
    let normalDistance = 0;
    for (let i = 0; i < 18; i++) {
      const before = normal.distanceWalked;
      normal.update(STEP_MS);
      normalDistance += normal.distanceWalked - before;
    }
    expect(burstDistance).toBeGreaterThan(normalDistance);
  });

  it('tote Männchen bewegen sich nicht mehr', () => {
    const brain = makeBrain(17);
    for (let i = 0; i < 60; i++) brain.update(STEP_MS);
    brain.state = 'dead';
    const x = brain.x;
    const y = brain.y;
    for (let i = 0; i < 120; i++) brain.update(STEP_MS);
    expect(brain.x).toBe(x);
    expect(brain.y).toBe(y);
  });

  it('dreht die Blickrichtung mit der Bewegung', () => {
    const brain = makeBrain(23, { x: CENTER, y: CENTER });
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      brain.update(STEP_MS);
      seen.add(brain.facing);
    }
    expect(seen.size).toBe(2);
  });

  it('stop() nullt die Geschwindigkeit', () => {
    const brain = makeBrain(29);
    for (let i = 0; i < 60; i++) brain.update(STEP_MS);
    expect(brain.speed).toBeGreaterThan(0);
    brain.stop();
    expect(brain.speed).toBe(0);
  });

  it('verteilt die Startplätze über die Zone', () => {
    const brains = makeGroup(8);
    // Kein Startplatz darf mit einem anderen zusammenfallen.
    expect(minPairDistance(brains)).toBeGreaterThan(50);
  });
});

describe('ShotlingBrain — eingefroren (Intro-Aufstellung)', () => {
  it('bewegt sich nicht, solange `frozen` gesetzt ist', () => {
    const brain = makeBrain(11);
    brain.frozen = true;
    const startX = brain.x;
    const startY = brain.y;

    for (let i = 0; i < 300; i++) brain.update(STEP_MS);

    expect(brain.x).toBe(startX);
    expect(brain.y).toBe(startY);
    expect(brain.distanceWalked).toBe(0);
  });

  it('laeuft nach dem Auftauen wieder los', () => {
    const brain = makeBrain(12);
    brain.frozen = true;
    for (let i = 0; i < 60; i++) brain.update(STEP_MS);
    const frozenX = brain.x;

    brain.frozen = false;
    for (let i = 0; i < 120; i++) brain.update(STEP_MS);

    expect(Math.abs(brain.x - frozenX)).toBeGreaterThan(0);
    expect(brain.distanceWalked).toBeGreaterThan(20);
  });

  it('wird von `resolveOverlaps` nicht verschoben', () => {
    /*
     * Der eigentliche Grund für das Flag: Die Reihe steht enger als der Mindestabstand,
     * und ohne diese Ausnahme drückte `resolveOverlaps` sie jeden Frame auseinander.
     */
    const a = makeBrain(1);
    const b = makeBrain(2);
    a.frozen = true;
    b.frozen = true;
    a.x = 500;
    a.y = 500;
    b.x = 540; // deutlich enger als SEPARATION_DISTANCE
    b.y = 500;

    for (let i = 0; i < 10; i++) resolveOverlaps([a, b]);

    expect(a.x).toBe(500);
    expect(b.x).toBe(540);
  });

  it('schiebt aber weiterhin die auseinander, die nicht eingefroren sind', () => {
    const a = makeBrain(3);
    const b = makeBrain(4);
    a.x = 500;
    a.y = 500;
    b.x = 510;
    b.y = 500;

    for (let i = 0; i < 10; i++) resolveOverlaps([a, b]);

    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(100);
  });
});
