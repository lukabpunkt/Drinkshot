/**
 * Session-Tests (Architektur §4).
 * M0 deckt Runden-Erzeugung und Persistenz ab; die Modus-Logik folgt in M1.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_ROUND_HISTORY, STORAGE_KEY } from '@/config/rules';
import type { Bet } from '@/core/lottery';
import {
  createEmptySession,
  createRoundSetup,
  loadSession,
  roundOdds,
  saveSession,
  type RoundResult,
} from '@/core/session';

const BETS: Bet[] = [
  { playerId: 'p1', sips: 2 },
  { playerId: 'p2', sips: 3 },
  { playerId: 'p3', sips: 5 },
];

beforeEach(() => localStorage.clear());

describe('createRoundSetup', () => {
  it('zieht ein Opfer aus der Runde und setzt einen Seed', () => {
    const setup = createRoundSetup(BETS, 'classic', 'normal');
    expect(['p1', 'p2', 'p3']).toContain(setup.victimId);
    expect(setup.extraVictimIds).toEqual([]);
    expect(Number.isInteger(setup.seed)).toBe(true);
    expect(setup.mode).toBe('classic');
    expect(setup.durationPreset).toBe('normal');
    expect(setup.deathId).toBe('basic_fall');
  });

  it('kopiert die Einsaetze, statt sie zu referenzieren', () => {
    const setup = createRoundSetup(BETS, 'classic', 'normal');
    setup.bets[0]!.sips = 99;
    expect(BETS[0]!.sips).toBe(2);
  });

  it('zieht im Modus "Double Tap" zwei verschiedene Opfer', () => {
    const setup = createRoundSetup(BETS, 'doubleTap', 'long');
    expect(setup.extraVictimIds).toHaveLength(1);
    expect(setup.extraVictimIds[0]).not.toBe(setup.victimId);
  });

  it('roundOdds liefert die Chancen-Tabelle', () => {
    const odds = roundOdds(createRoundSetup(BETS, 'classic', 'normal'));
    expect(odds['p3']).toBeCloseTo(0.5, 10);
  });
});

describe('Persistenz', () => {
  it('liefert ohne gespeicherte Daten eine leere Session', () => {
    const session = loadSession();
    expect(session.players).toEqual([]);
    expect(session.rounds).toEqual([]);
    expect(session.settings.mode).toBe('classic');
  });

  it('speichert und laedt Spieler und Settings', () => {
    const session = createEmptySession();
    session.players.push({ id: 'p1', name: 'Rudi', colorId: 'red' });
    session.settings.duration = 'long';
    saveSession(session);

    const loaded = loadSession();
    expect(loaded.players).toEqual([{ id: 'p1', name: 'Rudi', colorId: 'red' }]);
    expect(loaded.settings.duration).toBe('long');
  });

  it('kappt die Runden-History bei 50 Eintraegen', () => {
    const session = createEmptySession();
    session.rounds = Array.from({ length: 60 }, (_, i) => ({ finishedAt: i }) as RoundResult);
    saveSession(session);
    expect(loadSession().rounds).toHaveLength(MAX_ROUND_HISTORY);
  });

  it('ueberlebt kaputte Daten im localStorage', () => {
    localStorage.setItem(STORAGE_KEY, '{kein json');
    expect(loadSession().players).toEqual([]);
  });

  it('ueberlebt fehlende Felder', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ players: 'nope' }));
    const loaded = loadSession();
    expect(loaded.players).toEqual([]);
    expect(loaded.rounds).toEqual([]);
  });

  it('funktioniert ohne Storage (privater Modus)', () => {
    expect(() => saveSession(createEmptySession(), undefined)).not.toThrow();
    expect(loadSession(undefined).players).toEqual([]);
  });
});
