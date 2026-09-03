/**
 * RNG-Tests (Architektur §1).
 * Enthaelt auch den automatisierten A0-Check "kein Math.random in src/core/".
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSeed, createSeededRng, secureRandomFloat, secureRandomInt } from '@/core/rng';

describe('secureRandomFloat', () => {
  it('liegt immer in [0, 1)', () => {
    for (let i = 0; i < 50_000; i++) {
      const value = secureRandomFloat();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('ist ueber 10 Buckets annaehernd gleichverteilt', () => {
    const buckets = new Array<number>(10).fill(0);
    const draws = 100_000;
    for (let i = 0; i < draws; i++) {
      buckets[Math.floor(secureRandomFloat() * 10)]! += 1;
    }
    for (const count of buckets) {
      expect(Math.abs(count / draws - 0.1)).toBeLessThan(0.01);
    }
  });
});

describe('secureRandomInt', () => {
  it('liegt in [0, max)', () => {
    for (let i = 0; i < 20_000; i++) {
      const value = secureRandomInt(7);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });

  it('liefert bei max = 1 immer 0', () => {
    expect(secureRandomInt(1)).toBe(0);
  });

  it('weist ungueltige Grenzen zurueck', () => {
    expect(() => secureRandomInt(0)).toThrow(RangeError);
    expect(() => secureRandomInt(-3)).toThrow(RangeError);
    expect(() => secureRandomInt(2.5)).toThrow(RangeError);
  });
});

describe('createSeed', () => {
  it('liefert eine uint32', () => {
    const seed = createSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });

  it('wiederholt sich praktisch nie', () => {
    const seeds = new Set(Array.from({ length: 1000 }, () => createSeed()));
    expect(seeds.size).toBeGreaterThan(995);
  });
});

describe('createSeededRng — Determinismus', () => {
  it('liefert bei gleichem Seed identische Folgen', () => {
    const a = createSeededRng(1234);
    const b = createSeededRng(1234);
    for (let i = 0; i < 500; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('liefert bei anderem Seed andere Folgen', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    const sameCount = Array.from({ length: 100 }, () => (a.next() === b.next() ? 1 : 0)).reduce<number>(
      (x, y) => x + y,
      0
    );
    expect(sameCount).toBe(0);
  });

  it('merkt sich den Seed', () => {
    expect(createSeededRng(99).seed).toBe(99);
  });

  it('behandelt negative Seeds als uint32', () => {
    expect(createSeededRng(-1).seed).toBe(0xffffffff);
  });
});

describe('createSeededRng — Helfer', () => {
  const rng = createSeededRng(20260903);

  it('int liegt in [0, max)', () => {
    for (let i = 0; i < 10_000; i++) {
      const value = rng.int(5);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(5);
    }
    expect(() => rng.int(0)).toThrow(RangeError);
    expect(() => rng.int(1.5)).toThrow(RangeError);
  });

  it('range liegt in [min, max)', () => {
    for (let i = 0; i < 5000; i++) {
      const value = rng.range(300, 600);
      expect(value).toBeGreaterThanOrEqual(300);
      expect(value).toBeLessThan(600);
    }
  });

  it('intBetween ist inklusiv', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) seen.add(rng.intBetween(1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('pick waehlt aus dem Array und wirft bei leerem Array', () => {
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 500; i++) expect(items).toContain(rng.pick(items));
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it('shuffle permutiert ohne das Original zu veraendern', () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = createSeededRng(7).shuffle(source);
    expect(source).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(source);
  });

  it('shuffle ist deterministisch bei gleichem Seed', () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(createSeededRng(7).shuffle(source)).toEqual(createSeededRng(7).shuffle(source));
  });

  it('shuffle laesst leere und einelementige Arrays unveraendert', () => {
    expect(createSeededRng(1).shuffle([])).toEqual([]);
    expect(createSeededRng(1).shuffle(['x'])).toEqual(['x']);
  });

  it('weighted respektiert die Gewichte', () => {
    const items = [
      { id: 'selten', weight: 1 },
      { id: 'haeufig', weight: 9 },
    ];
    const local = createSeededRng(555);
    let often = 0;
    const draws = 50_000;
    for (let i = 0; i < draws; i++) {
      if (local.weighted(items, (item) => item.weight).id === 'haeufig') often++;
    }
    expect(Math.abs(often / draws - 0.9)).toBeLessThan(0.01);
  });

  it('weighted wirft bei leerem Array oder ungueltigen Gewichten', () => {
    expect(() => rng.weighted([], () => 1)).toThrow(RangeError);
    expect(() => rng.weighted([{ w: 0 }], (i) => i.w)).toThrow(RangeError);
    expect(() => rng.weighted([{ w: -1 }], (i) => i.w)).toThrow(RangeError);
    expect(() => rng.weighted([{ w: Number.POSITIVE_INFINITY }], (i) => i.w)).toThrow(RangeError);
  });

  it('chance(0) ist nie wahr, chance(1) immer', () => {
    const local = createSeededRng(3);
    for (let i = 0; i < 200; i++) {
      expect(local.chance(0)).toBe(false);
      expect(local.chance(1)).toBe(true);
    }
  });
});

describe('A0-Check: Fairness-Regel im Quellcode', () => {
  function collectFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return collectFiles(full);
      return entry.name.endsWith('.ts') ? [full] : [];
    });
  }

  /** Blockt Kommentare aus, damit nur echter Code gepruef wird. */
  function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  }

  it('src/core/ enthaelt kein Math.random', () => {
    const offenders = collectFiles('src/core').filter((file) =>
      /Math\s*\.\s*random/.test(stripComments(readFileSync(file, 'utf8')))
    );
    expect(offenders).toEqual([]);
  });

  it('lottery.ts zieht ueber secureRandomFloat', () => {
    const source = readFileSync('src/core/lottery.ts', 'utf8');
    expect(source).toContain('secureRandomFloat');
  });

  it('rng.ts nutzt crypto.getRandomValues', () => {
    const source = readFileSync('src/core/rng.ts', 'utf8');
    expect(source).toContain('getRandomValues');
  });
});
