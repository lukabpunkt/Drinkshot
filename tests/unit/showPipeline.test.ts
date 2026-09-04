/**
 * Ende-zu-Ende-Test der Fairness-Kette (Audit A3: „1 000 simulierte Runden: `victimId`
 * == angezeigtes Opfer in 100 %").
 *
 * Geprüft wird die ganze Strecke, nicht ein Teilstück:
 *   Einsätze → `pickVictim` (sicherer Zufall) → `RoundSetup` → `ShowScript` → Lock-Ziel
 *   → `resolveRound` → wer trinkt.
 *
 * Genau hier könnte ein Fehler unbemerkt bleiben: Die Ziehung wäre statistisch sauber,
 * die Show würde aber jemand anderen erschiessen — und niemand würde es merken, weil das
 * Ergebnis ja aus derselben Runde stammt.
 */

import { describe, expect, it } from 'vitest';
import { MIN_BET, MAX_BET, GAME_MODES, DURATION_PRESETS } from '@/config/rules';
import { buildShowScript } from '@/core/choreographer';
import { createSeededRng } from '@/core/rng';
import { createRoundSetup, resolveRound, type RoundSetup } from '@/core/session';
import type { Bet } from '@/core/lottery';

const ROUNDS = 1000;

/** Baut eine zufällige, aber reproduzierbare Runde. */
function randomBets(round: number): { players: string[]; bets: Bet[] } {
  const rng = createSeededRng(round * 2654435761);
  const count = 2 + rng.int(7);
  const players = Array.from({ length: count }, (_, i) => `p${i + 1}`);
  const bets = players.map((playerId) => ({
    playerId,
    sips: rng.intBetween(MIN_BET, MAX_BET),
  }));
  return { players, bets };
}

function lockTarget(setup: RoundSetup, players: string[]): string | undefined {
  const script = buildShowScript({
    players,
    victimId: setup.victimId,
    seed: setup.seed,
    durationPreset: setup.durationPreset,
    deathId: setup.deathId,
  });
  const lock = script.beats.find((beat) => beat.type === 'lock');
  return lock?.type === 'lock' ? lock.target : undefined;
}

describe(`Fairness-Kette über ${ROUNDS.toLocaleString('de-DE')} Runden`, () => {
  it('die Show lockt immer genau auf das gezogene Opfer', () => {
    let checked = 0;
    for (let round = 0; round < ROUNDS; round++) {
      const { players, bets } = randomBets(round);
      const mode = GAME_MODES[round % GAME_MODES.length]!;
      const preset = DURATION_PRESETS[round % DURATION_PRESETS.length]!;

      const setup = createRoundSetup(bets, mode, preset);
      expect(players).toContain(setup.victimId);
      expect(lockTarget(setup, players), `Runde ${round}`).toBe(setup.victimId);
      checked++;
    }
    expect(checked).toBe(ROUNDS);
  });

  it('der Todes-Beat trägt dieselbe DeathId wie das Setup', () => {
    for (let round = 0; round < 300; round++) {
      const { players, bets } = randomBets(round);
      const setup = createRoundSetup(bets, 'classic', 'normal', () => ({
        deathId: `death_${round % 7}`,
        zone: 'body',
      }));
      const script = buildShowScript({
        players,
        victimId: setup.victimId,
        seed: setup.seed,
        durationPreset: setup.durationPreset,
        deathId: setup.deathId,
      });
      const death = script.beats.find((beat) => beat.type === 'death');
      expect(death?.type === 'death' && death.deathId).toBe(setup.deathId);
    }
  });

  it('wer trinkt, passt zum Opfer und zum Modus', () => {
    for (let round = 0; round < ROUNDS; round++) {
      const { bets } = randomBets(round);
      const mode = GAME_MODES[round % GAME_MODES.length]!;
      const setup = createRoundSetup(bets, mode, 'normal');
      const result = resolveRound(setup);

      switch (mode) {
        case 'classic':
        case 'suddenDeath':
          expect(result.drinkers.map((d) => d.playerId)).toEqual([setup.victimId]);
          break;
        case 'distributor':
          expect(result.drinkers.map((d) => d.playerId)).not.toContain(setup.victimId);
          expect(result.drinkers).toHaveLength(bets.length - 1);
          break;
        case 'doubleTap':
          expect(result.drinkers[0]?.playerId).toBe(setup.victimId);
          expect(result.drinkers.length).toBe(Math.min(2, bets.length));
          break;
        case 'showdown': {
          // Alle bis auf einen trinken ihren eigenen Einsatz, der Letzte verteilt.
          expect(result.drinkers).toHaveLength(bets.length - 1);
          for (const drinker of result.drinkers) {
            const own = bets.find((bet) => bet.playerId === drinker.playerId)?.sips;
            expect(drinker.sips).toBe(own);
          }
          const drinking = new Set(result.drinkers.map((drinker) => drinker.playerId));
          expect(drinking.has(result.winnerId!)).toBe(false);
          expect(result.sipsToDistribute).toBe(
            bets.find((bet) => bet.playerId === result.winnerId)?.sips
          );
          // Niemand scheidet dauerhaft aus — sonst wäre die Session nach einer Runde vorbei.
          expect(result.eliminatedIds).toEqual([]);
          break;
        }
      }
    }
  });

  it('die gezogenen Opfer streuen über alle Spieler', () => {
    // Gegenprobe: Wäre irgendwo eine feste Auswahl eingebaut, fiele es hier auf.
    const counts = new Map<string, number>();
    const players = ['p1', 'p2', 'p3', 'p4'];
    const bets = players.map((playerId) => ({ playerId, sips: 5 }));
    for (let round = 0; round < 4000; round++) {
      const setup = createRoundSetup(bets, 'classic', 'normal');
      counts.set(setup.victimId, (counts.get(setup.victimId) ?? 0) + 1);
    }
    expect(counts.size).toBe(4);
    for (const player of players) {
      expect(Math.abs((counts.get(player) ?? 0) / 4000 - 0.25)).toBeLessThan(0.03);
    }
  });

  it('das Skript hält die Preset-Dauer über alle Runden ein', () => {
    for (let round = 0; round < ROUNDS; round++) {
      const { players, bets } = randomBets(round);
      const preset = DURATION_PRESETS[round % DURATION_PRESETS.length]!;
      const setup = createRoundSetup(bets, 'classic', preset);
      const script = buildShowScript({
        players,
        victimId: setup.victimId,
        seed: setup.seed,
        durationPreset: setup.durationPreset,
        deathId: setup.deathId,
      });
      const expected = { short: 10_000, normal: 15_000, long: 22_000 }[preset];
      expect(Math.abs(script.totalMs - expected), `Runde ${round}, ${preset}`).toBeLessThanOrEqual(
        1000
      );
    }
  });
});
