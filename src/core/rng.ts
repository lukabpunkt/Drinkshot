/**
 * Zufall.
 *
 * Zwei strikt getrennte Quellen (Architektur §1, CLAUDE.md "Fairness"):
 *
 * 1. **Sicherer Zufall** (`secureRandomFloat`) — ausschliesslich fuer die Ziehung des Opfers.
 *    Basiert auf `crypto.getRandomValues`. `Math.random` ist in `src/core/` per ESLint verboten.
 * 2. **Seedbarer PRNG** (`createSeededRng`, mulberry32) — fuer die Show: Choreografie,
 *    Death-Auswahl, Huete, Idle-Gags. Reproduzierbar fuer Debugging, Replays und Tests.
 */

const cryptoRef: Crypto = globalThis.crypto;

if (typeof cryptoRef?.getRandomValues !== 'function') {
  throw new Error('crypto.getRandomValues ist nicht verfuegbar — Drinkshot braucht sicheren Zufall.');
}

const TWO_POW_32 = 0x1_0000_0000;
const TWO_POW_26 = 0x400_0000;
const TWO_POW_53 = Number.MAX_SAFE_INTEGER + 1;

/* ------------------------------------------------------------------ */
/* Sicherer Zufall                                                     */
/* ------------------------------------------------------------------ */

const secureBuffer = new Uint32Array(2);

/**
 * Kryptografisch sichere Gleitkommazahl in [0, 1) mit voller 53-Bit-Mantisse.
 * Nur hierueber laeuft die Ziehung des Opfers.
 */
export function secureRandomFloat(): number {
  cryptoRef.getRandomValues(secureBuffer);
  const hi = secureBuffer[0]! >>> 5; // 27 Bit
  const lo = secureBuffer[1]! >>> 6; // 26 Bit
  return (hi * TWO_POW_26 + lo) / TWO_POW_53; // 27 + 26 = 53 Bit Mantisse
}

/**
 * Sichere Ganzzahl in [0, maxExclusive) — ohne Modulo-Bias (Rejection Sampling).
 */
export function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError(`maxExclusive muss eine positive Ganzzahl sein, war: ${maxExclusive}`);
  }
  if (maxExclusive === 1) return 0;

  const limit = Math.floor(TWO_POW_32 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    cryptoRef.getRandomValues(buf);
    value = buf[0]!;
  } while (value >= limit);
  return value % maxExclusive;
}

/** Neuer Seed fuer eine Runde (uint32, aus sicherem Zufall). */
export function createSeed(): number {
  const buf = new Uint32Array(1);
  cryptoRef.getRandomValues(buf);
  return buf[0]!;
}

/* ------------------------------------------------------------------ */
/* Seedbarer PRNG (mulberry32)                                         */
/* ------------------------------------------------------------------ */

export interface SeededRng {
  /** Der Seed, mit dem dieser Generator erzeugt wurde. */
  readonly seed: number;
  /** Gleitkommazahl in [0, 1). */
  next(): number;
  /** Ganzzahl in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Gleitkommazahl in [min, max). */
  range(min: number, max: number): number;
  /** Ganzzahl in [min, max] (inklusiv) — passt zu den [min, max]-Tokens in `choreo.ts`. */
  intBetween(min: number, max: number): number;
  /** Zufaelliges Element. Wirft bei leerem Array. */
  pick<T>(items: readonly T[]): T;
  /** Neue, gemischte Kopie (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[];
  /** Gewichtete Auswahl; Gewichte muessen > 0 sein. */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T;
  /** true mit Wahrscheinlichkeit p. */
  chance(p: number): boolean;
}

/**
 * mulberry32 — 32 Bit State, sehr schnell, gute Verteilung fuer Spiel-Zwecke.
 * Nicht kryptografisch und darf niemals fuer die Ziehung benutzt werden.
 */
export function createSeededRng(seed: number): SeededRng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / TWO_POW_32;
  };

  const int = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError(`maxExclusive muss eine positive Ganzzahl sein, war: ${maxExclusive}`);
    }
    return Math.floor(next() * maxExclusive);
  };

  const rng: SeededRng = {
    seed: seed >>> 0,
    next,
    int,
    range: (min, max) => min + next() * (max - min),
    intBetween: (min, max) => min + int(max - min + 1),
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new RangeError('pick() auf leerem Array');
      return items[int(items.length)]!;
    },
    shuffle: <T>(items: readonly T[]): T[] => {
      const copy = items.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = int(i + 1);
        const a = copy[i]!;
        copy[i] = copy[j]!;
        copy[j] = a;
      }
      return copy;
    },
    weighted: <T>(items: readonly T[], weightOf: (item: T) => number): T => {
      if (items.length === 0) throw new RangeError('weighted() auf leerem Array');
      let total = 0;
      for (const item of items) {
        const w = weightOf(item);
        if (!(w > 0) || !Number.isFinite(w)) {
          throw new RangeError('Gewichte muessen endliche Zahlen > 0 sein.');
        }
        total += w;
      }
      let r = next() * total;
      for (const item of items) {
        r -= weightOf(item);
        if (r < 0) return item;
      }
      return items[items.length - 1]!;
    },
    chance: (p) => next() < p,
  };

  return rng;
}
