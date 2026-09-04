/**
 * Die Aufstellung vor dem Warnschuss (GDD §3.5).
 *
 * Geprüft wird Geometrie, nicht Aussehen: Passt die Reihe in die Laufzone, überdecken
 * sich die Männchen nicht, und landet der Warnschuss auf freiem Boden statt in einem Fass?
 * Genau das lässt sich rechnen — und genau das war beim Entwurf die offene Frage.
 */

import { describe, expect, it } from 'vitest';
import { INTRO } from '@/config/choreo';
import { ARENA, shotlingHeightFor } from '@/config/theme';
import { lineupPositions, warningShotPoint } from '@/game/introLineup';

/** Dieselben Maße wie in der Arena. */
const CENTER = ARENA.worldSize / 2;
const GROUND_RADIUS = ARENA.circleDiameter / 2;
const WALK_RADIUS = GROUND_RADIUS * ARENA.walkRadiusFactor;
/** Requisiten liegen auf diesem Ring — dort darf nichts einschlagen. */
const PROP_RING_INNER = GROUND_RADIUS * 0.86;
/** Der helle Boden endet hier. */
const BRIGHT_GROUND = GROUND_RADIUS * 0.92;

const COUNTS = [2, 3, 4, 5, 6, 7, 8];

function setUp(count: number) {
  const height = shotlingHeightFor(count);
  const positions = lineupPositions({
    count,
    height,
    centerX: CENTER,
    centerY: CENTER,
    walkRadius: WALK_RADIUS,
  });
  return { height, positions };
}

function distanceFromCenter(point: { x: number; y: number }): number {
  return Math.hypot(point.x - CENTER, point.y - CENTER);
}

describe('lineupPositions', () => {
  it('stellt für jede Spielerzahl genau so viele Männchen auf', () => {
    for (const count of COUNTS) {
      expect(setUp(count).positions).toHaveLength(count);
    }
  });

  it('hält alle innerhalb der Laufzone', () => {
    /*
     * Nicht bis an den Rand: Ab 90 % lenkt der Brain vom Rand weg, und beim Auftauen
     * risse `clampToZone()` die Äußeren sichtbar zurück.
     */
    const limit = WALK_RADIUS * 0.9;
    for (const count of COUNTS) {
      for (const point of setUp(count).positions) {
        expect(distanceFromCenter(point)).toBeLessThanOrEqual(limit);
      }
    }
  });

  it('nutzt eine Reihe bis sechs Spieler und zwei ab sieben', () => {
    for (const count of [2, 3, 4, 5, 6]) {
      const rows = new Set(setUp(count).positions.map((point) => point.row));
      expect([...rows]).toEqual([0]);
    }
    for (const count of [7, 8]) {
      const rows = new Set(setUp(count).positions.map((point) => point.row));
      expect([...rows].sort()).toEqual([0, 1]);
    }
  });

  it('hält innerhalb einer Reihe den vollen Abstand ein', () => {
    for (const count of COUNTS) {
      const { height, positions } = setUp(count);
      const spacing = height * INTRO.rowSpacingFactor;

      for (const row of [0, 1]) {
        const inRow = positions.filter((point) => point.row === row);
        for (let i = 1; i < inRow.length; i++) {
          expect(inRow[i]!.x - inRow[i - 1]!.x).toBeCloseTo(spacing, 5);
        }
      }
    }
  });

  it('stellt die hintere Reihe in die Lücken der vorderen', () => {
    for (const count of [7, 8]) {
      const { height, positions } = setUp(count);
      const front = positions.filter((point) => point.row === 0);
      const back = positions.filter((point) => point.row === 1);

      // Keine hintere Spalte deckt sich mit einer vorderen — sonst verschwindet jemand.
      const minGap = height * INTRO.rowSpacingFactor * 0.4;
      for (const b of back) {
        for (const f of front) {
          expect(Math.abs(b.x - f.x)).toBeGreaterThan(minGap);
        }
      }
    }
  });

  it('lässt bei zwei Reihen die hinteren Köpfe über den vorderen stehen', () => {
    /*
     * Der Kopf sitzt 0,768 der Höhe über den Füßen und ist 0,406 der Höhe hoch (aus der
     * Rig-Geometrie). Deckte die vordere Reihe die hinteren Köpfe ab, wäre die halbe
     * Aufstellung unsichtbar.
     */
    for (const count of [7, 8]) {
      const { height, positions } = setUp(count);
      const headCenter = height * 0.768;
      const headHeight = height * 0.406;

      const front = positions.find((point) => point.row === 0)!;
      const back = positions.find((point) => point.row === 1)!;

      const backHeadBottom = back.y - headCenter + headHeight / 2;
      const frontHeadTop = front.y - headCenter - headHeight / 2;
      expect(backHeadBottom).toBeLessThan(frontHeadTop);
    }
  });

  it('ist bei gleicher Eingabe identisch — kein Zufall im Spiel', () => {
    for (const count of COUNTS) {
      expect(setUp(count).positions).toEqual(setUp(count).positions);
    }
  });

  it('gibt bei null Spielern eine leere Aufstellung', () => {
    expect(
      lineupPositions({ count: 0, height: 200, centerX: 500, centerY: 500, walkRadius: 351 })
    ).toEqual([]);
  });
});

describe('warningShotPoint', () => {
  it('schlägt vor den Füßen des Äußersten ein', () => {
    for (const count of COUNTS) {
      const { height, positions } = setUp(count);
      const shot = warningShotPoint(positions, height);

      const front = positions.filter((point) => point.row === 0);
      const outermost = front.reduce((far, point) =>
        Math.abs(point.x - CENTER) > Math.abs(far.x - CENTER) ? point : far
      );

      expect(shot.x).toBeCloseTo(outermost.x, 5);
      // Vor ihm, also näher an der Kamera.
      expect(shot.y).toBeGreaterThan(outermost.y);
    }
  });

  it('landet nie im Requisiten-Ring', () => {
    /*
     * Das war der Grund gegen „seitlich neben die Reihe": Bei sechs Spielern läge der
     * Einschlag dort auf Radius 393 — mitten zwischen den Fässern.
     */
    for (const count of COUNTS) {
      const { height, positions } = setUp(count);
      const distance = distanceFromCenter(warningShotPoint(positions, height));

      expect(distance).toBeLessThan(PROP_RING_INNER);
      expect(distance).toBeLessThan(BRIGHT_GROUND);
    }
  });

  it('bleibt bei leerer Aufstellung harmlos', () => {
    expect(warningShotPoint([], 200)).toEqual({ x: 0, y: 0 });
  });
});
