/**
 * Ziehung des Opfers und Chancen-Berechnung.
 *
 * **Die einzige Stelle im Projekt, die entscheidet, wen es trifft.**
 * Regeln (GDD §3.4, ADR-2, CLAUDE.md):
 * - Trefferwahrscheinlichkeit p_i = b_i / B  (B = Summe aller Einsaetze)
 * - Roulette-Wheel-Selection mit `crypto.getRandomValues` ueber `secureRandomFloat()`
 * - Wird genau einmal beim Uebergang BET → ARENA aufgerufen
 * - Die Show (`choreographer.ts`, `ShowDirector`) inszeniert nur, sie entscheidet nichts
 */

import { MAX_BET, MIN_BET } from '@/config/rules';
import { secureRandomFloat } from './rng';

export type PlayerId = string;

export interface Bet {
  playerId: PlayerId;
  /** Einsatz in Schlucken, 1..10. */
  sips: number;
}

/** Erlaubt sowohl `{playerId, sips}` als auch die GDD-Pseudocode-Form `{id, bet}`. */
export interface WeightedEntry {
  playerId: PlayerId;
  sips: number;
}

function assertValidBets(bets: readonly Bet[]): void {
  if (bets.length === 0) {
    throw new RangeError('pickVictim: keine Einsaetze uebergeben.');
  }
  const seen = new Set<PlayerId>();
  for (const bet of bets) {
    if (!Number.isInteger(bet.sips) || bet.sips < MIN_BET || bet.sips > MAX_BET) {
      throw new RangeError(
        `Ungueltiger Einsatz fuer ${bet.playerId}: ${bet.sips} (erlaubt ${MIN_BET}..${MAX_BET}).`
      );
    }
    if (seen.has(bet.playerId)) {
      throw new RangeError(`Doppelter Einsatz fuer Spieler ${bet.playerId}.`);
    }
    seen.add(bet.playerId);
  }
}

/** Summe aller Einsaetze (B). */
export function totalSips(bets: readonly Bet[]): number {
  let total = 0;
  for (const bet of bets) total += bet.sips;
  return total;
}

/**
 * Chancen p_i = b_i / B fuer die Reveal-Tabelle auf dem Result-Screen.
 * Summe der Werte ist 1 (bis auf Float-Rundung).
 */
export function computeOdds(bets: readonly Bet[]): Record<PlayerId, number> {
  assertValidBets(bets);
  const total = totalSips(bets);
  const odds: Record<PlayerId, number> = {};
  for (const bet of bets) {
    odds[bet.playerId] = bet.sips / total;
  }
  return odds;
}

/**
 * Zieht genau ein Opfer, gewichtet mit dem Einsatz.
 *
 * @param bets  Einsaetze aller teilnehmenden Spieler (mind. 1 Eintrag).
 * @param randomFloat  Nur fuer Tests injizierbar; produktiv immer `secureRandomFloat`.
 */
export function pickVictim(bets: readonly Bet[], randomFloat: () => number = secureRandomFloat): PlayerId {
  assertValidBets(bets);
  const total = totalSips(bets);
  const r = randomFloat() * total; // [0, total)
  let acc = 0;
  for (const bet of bets) {
    acc += bet.sips;
    if (r < acc) return bet.playerId;
  }
  // Float-Rounding-Fallback (GDD §3.4)
  return bets[bets.length - 1]!.playerId;
}

/**
 * Zieht `count` verschiedene Opfer ohne Zuruecklegen (Modus "Double Tap", GDD §3.6).
 * Sind weniger Spieler als `count` vorhanden, werden alle gezogen.
 */
export function pickVictims(
  bets: readonly Bet[],
  count: number,
  randomFloat: () => number = secureRandomFloat
): PlayerId[] {
  assertValidBets(bets);
  const pool = bets.slice();
  const victims: PlayerId[] = [];
  const wanted = Math.min(count, pool.length);
  for (let i = 0; i < wanted; i++) {
    const victim = pickVictim(pool, randomFloat);
    victims.push(victim);
    const index = pool.findIndex((b) => b.playerId === victim);
    pool.splice(index, 1);
  }
  return victims;
}
