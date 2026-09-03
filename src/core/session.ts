/**
 * Datenmodell der Session (Architektur §4) sowie Spieler-, Runden- und Scoreboard-Logik.
 *
 * M0: Typen + Runden-Erzeugung (`createRoundSetup`) + Persistenz-Helfer.
 * TODO(M1): Drinker-Berechnung fuer alle 4 Modi (`resolveRound`) inkl. Unit-Tests pro Modus,
 *           Scoreboard-Aggregation, Sudden-Death-Ausscheiden.
 */

import {
  DEFAULT_SETTINGS,
  MAX_ROUND_HISTORY,
  MODE_SPECS,
  STORAGE_KEY,
  type DurationPreset,
  type GameMode,
  type Settings,
} from '@/config/rules';
import type { ColorId, HatId } from '@/config/theme';
import { computeOdds, pickVictims, type Bet, type PlayerId } from './lottery';
import { createSeed } from './rng';

/** ID einer Todesanimation, z. B. `head_helmet_spin` (GDD §4.1). */
export type DeathId = string;

export interface Player {
  id: PlayerId;
  /** max. 12 Zeichen (GDD §3.1). */
  name: string;
  colorId: ColorId;
  /** Pro Runde neu gewuerfelt. */
  hatId?: HatId;
}

export interface RoundSetup {
  /** Seed fuer Choreografie + Death-Auswahl — **nicht** fuer die Ziehung (ADR-2). */
  seed: number;
  bets: Bet[];
  /** Ergebnis der sicheren Ziehung. */
  victimId: PlayerId;
  /** Weitere Opfer im Modus "Double Tap". */
  extraVictimIds: PlayerId[];
  deathId: DeathId;
  mode: GameMode;
  durationPreset: DurationPreset;
}

export interface RoundResult extends RoundSetup {
  drinkers: { playerId: PlayerId; sips: number }[];
  odds: Record<PlayerId, number>;
  finishedAt: number;
}

export interface Session {
  players: Player[];
  rounds: RoundResult[];
  settings: Settings;
}

/** Platzhalter, bis die Death-Registry in M3 existiert. */
export const PLACEHOLDER_DEATH_ID: DeathId = 'basic_fall';

export function createEmptySession(): Session {
  return { players: [], rounds: [], settings: { ...DEFAULT_SETTINGS } };
}

/**
 * Erzeugt das RoundSetup fuer den Uebergang BET → ARENA.
 * Ruft `pickVictims` (und damit `crypto.getRandomValues`) genau einmal auf.
 */
export function createRoundSetup(
  bets: readonly Bet[],
  mode: GameMode,
  durationPreset: DurationPreset,
  deathId: DeathId = PLACEHOLDER_DEATH_ID
): RoundSetup {
  const victims = pickVictims(bets, MODE_SPECS[mode].victims);
  return {
    seed: createSeed(),
    bets: bets.map((bet) => ({ ...bet })),
    victimId: victims[0]!,
    extraVictimIds: victims.slice(1),
    deathId,
    mode,
    durationPreset,
  };
}

/** Chancen-Tabelle fuer den Result-Screen. */
export function roundOdds(setup: RoundSetup): Record<PlayerId, number> {
  return computeOdds(setup.bets);
}

/* ------------------------------------------------------------------ */
/* Persistenz (localStorage)                                           */
/* ------------------------------------------------------------------ */

export function loadSession(storage: Storage | undefined = globalThis.localStorage): Session {
  const fallback = createEmptySession();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Session>;
    return {
      players: Array.isArray(parsed.players) ? parsed.players : [],
      rounds: Array.isArray(parsed.rounds) ? parsed.rounds.slice(-MAX_ROUND_HISTORY) : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return fallback;
  }
}

export function saveSession(session: Session, storage: Storage | undefined = globalThis.localStorage): void {
  if (!storage) return;
  try {
    const trimmed: Session = { ...session, rounds: session.rounds.slice(-MAX_ROUND_HISTORY) };
    storage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Privater Modus / Quota — Persistenz ist ein Komfort-Feature, kein Muss.
  }
}
