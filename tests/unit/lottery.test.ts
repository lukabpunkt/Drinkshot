/**
 * Fairness-Tests der Ziehung (GDD §3.4, §10.5, Audit A0).
 * Pflicht: 100 000 Ziehungen, Abweichung < 1 % gegenueber p_i = b_i / B.
 */

import { describe, expect, it } from 'vitest';
import { computeOdds, pickVictim, pickVictims, totalSips, type Bet } from '@/core/lottery';

const DRAWS = 100_000;
/** Erlaubte absolute Abweichung von der Erwartung. */
const TOLERANCE = 0.01;

function bets(...sips: number[]): Bet[] {
  return sips.map((value, index) => ({ playerId: `p${index + 1}`, sips: value }));
}

function simulate(list: Bet[], draws = DRAWS): Map<string, number> {
  const counts = new Map<string, number>();
  for (const bet of list) counts.set(bet.playerId, 0);
  for (let i = 0; i < draws; i++) {
    const victim = pickVictim(list);
    counts.set(victim, counts.get(victim)! + 1);
  }
  return counts;
}

function expectFair(list: Bet[], draws = DRAWS): void {
  const counts = simulate(list, draws);
  const total = totalSips(list);
  for (const bet of list) {
    const observed = counts.get(bet.playerId)! / draws;
    const expected = bet.sips / total;
    expect(
      Math.abs(observed - expected),
      `${bet.playerId}: erwartet ${expected.toFixed(4)}, gemessen ${observed.toFixed(4)}`
    ).toBeLessThan(TOLERANCE);
  }
}

describe('computeOdds', () => {
  it('rechnet p_i = b_i / B (GDD-Beispiel 1/2/3/5)', () => {
    const odds = computeOdds(bets(1, 2, 3, 5));
    expect(odds['p1']).toBeCloseTo(1 / 11, 10);
    expect(odds['p2']).toBeCloseTo(2 / 11, 10);
    expect(odds['p3']).toBeCloseTo(3 / 11, 10);
    expect(odds['p4']).toBeCloseTo(5 / 11, 10);
  });

  it('summiert sich zu 1', () => {
    const odds = computeOdds(bets(4, 7, 1, 9, 2, 2, 10, 3));
    const sum = Object.values(odds).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 12);
  });

  it('weist ungueltige Einsaetze zurueck', () => {
    expect(() => computeOdds([])).toThrow(RangeError);
    expect(() => computeOdds(bets(0, 3))).toThrow(RangeError);
    expect(() => computeOdds(bets(11, 3))).toThrow(RangeError);
    expect(() => computeOdds(bets(1.5, 3))).toThrow(RangeError);
    expect(() =>
      computeOdds([
        { playerId: 'dup', sips: 2 },
        { playerId: 'dup', sips: 3 },
      ])
    ).toThrow(RangeError);
  });
});

describe(`pickVictim — ${DRAWS.toLocaleString('de-DE')} Ziehungen, Abweichung < ${TOLERANCE * 100} %`, () => {
  it('GDD-Beispiel: Einsaetze 1, 2, 3, 5', () => {
    expectFair(bets(1, 2, 3, 5));
  });

  it('Edge-Case: 2 Spieler', () => {
    expectFair(bets(3, 7));
  });

  it('Edge-Case: alle gleich (8 Spieler à 5)', () => {
    expectFair(bets(5, 5, 5, 5, 5, 5, 5, 5));
  });

  it('Edge-Case: ein Spieler 10, alle anderen 1', () => {
    expectFair(bets(10, 1, 1, 1, 1, 1, 1, 1));
  });

  it('Edge-Case: ein einzelner Spieler wird immer gezogen', () => {
    expect(pickVictim(bets(4))).toBe('p1');
  });
});

describe('pickVictim — Roulette-Wheel-Grenzen', () => {
  const list = bets(1, 2, 3, 5); // Segmente: [0,1) [1,3) [3,6) [6,11)

  it('trifft bei r = 0 den ersten Spieler', () => {
    expect(pickVictim(list, () => 0)).toBe('p1');
  });

  it('trifft die Segmentgrenzen exakt', () => {
    expect(pickVictim(list, () => 1 / 11)).toBe('p2');
    expect(pickVictim(list, () => 3 / 11)).toBe('p3');
    expect(pickVictim(list, () => 6 / 11)).toBe('p4');
  });

  it('faellt bei Float-Rounding auf den letzten Spieler zurueck', () => {
    expect(pickVictim(list, () => 1)).toBe('p4');
  });

  it('liefert nur Spieler aus der Liste', () => {
    const ids = new Set(list.map((b) => b.playerId));
    for (let i = 0; i < 2000; i++) {
      expect(ids.has(pickVictim(list))).toBe(true);
    }
  });
});

describe('pickVictims — Modus "Double Tap" (ohne Zuruecklegen)', () => {
  it('zieht zwei verschiedene Opfer', () => {
    for (let i = 0; i < 500; i++) {
      const victims = pickVictims(bets(1, 2, 3, 5), 2);
      expect(victims).toHaveLength(2);
      expect(new Set(victims).size).toBe(2);
    }
  });

  it('zieht hoechstens so viele Opfer wie Spieler da sind', () => {
    expect(pickVictims(bets(3, 4), 5)).toHaveLength(2);
  });

  it('bleibt auch beim zweiten Zug gewichtet', () => {
    const list = bets(10, 1, 1, 1);
    let firstIsHeavy = 0;
    const rounds = 20_000;
    for (let i = 0; i < rounds; i++) {
      if (pickVictims(list, 2)[0] === 'p1') firstIsHeavy++;
    }
    expect(Math.abs(firstIsHeavy / rounds - 10 / 13)).toBeLessThan(TOLERANCE);
  });
});
