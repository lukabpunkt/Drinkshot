/**
 * Konfigurations-Tests (Audit A0: "theme.ts/rules.ts/choreo.ts enthalten die GDD-Werte").
 * Diese Datei ist die automatisierte Fassung des Review-Checks.
 */

import { describe, expect, it } from 'vitest';
import { CHOREO, CHOREO_FAIRNESS, PHASE_BUDGET, phaseDurations } from '@/config/choreo';
import {
  DEFAULT_BET,
  DEFAULT_MODE,
  DURATION_MS,
  GAME_MODES,
  MAX_BET,
  MAX_PLAYERS,
  MIN_BET,
  MIN_PLAYERS,
  MODE_SPECS,
  riskTier,
} from '@/config/rules';
import { PLAYER_COLORS, UI_COLORS, colorById, hex, textColorOn } from '@/config/theme';

describe('rules.ts gegen GDD §3', () => {
  it('Spielerzahl 2–8', () => {
    expect(MIN_PLAYERS).toBe(2);
    expect(MAX_PLAYERS).toBe(8);
  });

  it('Einsatz 1–10, Default 3, kein 0-Einsatz', () => {
    expect(MIN_BET).toBe(1);
    expect(MAX_BET).toBe(10);
    expect(DEFAULT_BET).toBe(3);
  });

  it('Default-Modus ist Klassik (ADR-3)', () => {
    expect(DEFAULT_MODE).toBe('classic');
  });

  it('kennt alle 4 Modi aus GDD §3.6', () => {
    expect([...GAME_MODES]).toEqual(['classic', 'distributor', 'suddenDeath', 'doubleTap']);
    expect(MODE_SPECS.doubleTap.victims).toBe(2);
    expect(MODE_SPECS.classic.victims).toBe(1);
    expect(MODE_SPECS.suddenDeath.eliminates).toBe(true);
    expect(MODE_SPECS.classic.eliminates).toBe(false);
  });

  it('Dauer-Presets 10 / 15 / 22 s', () => {
    expect(DURATION_MS.short).toBe(10_000);
    expect(DURATION_MS.normal).toBe(15_000);
    expect(DURATION_MS.long).toBe(22_000);
  });

  it('Risiko-Ampel: 1–3 vorsichtig, 4–6 mutig, 7–10 wahnsinnig', () => {
    expect([1, 2, 3].map(riskTier)).toEqual(['careful', 'careful', 'careful']);
    expect([4, 5, 6].map(riskTier)).toEqual(['bold', 'bold', 'bold']);
    expect([7, 8, 9, 10].map(riskTier)).toEqual(['insane', 'insane', 'insane', 'insane']);
  });
});

describe('theme.ts gegen Art Direction §2', () => {
  it('hat die 8 Spielerfarben in fester Reihenfolge', () => {
    expect(PLAYER_COLORS.map((c) => c.id)).toEqual([
      'red',
      'blue',
      'green',
      'yellow',
      'purple',
      'orange',
      'pink',
      'cyan',
    ]);
    expect(PLAYER_COLORS.map((c) => c.hex)).toEqual([
      // Lila wurde in M5 von #a55eea auf #af73ee aufgehellt: 4.33:1 auf dem Panel
      // reissen die 4.5:1 aus Audit A5, jetzt sind es 5.23:1.
      0xff4757, 0x3b82f6, 0x2ed573, 0xffd32a, 0xaf73ee, 0xff7f50, 0xff6b9d, 0x18dcff,
    ]);
  });

  it('gibt jeder Farbe ein eigenes Symbol (Farbenblind-Fallback)', () => {
    const symbols = PLAYER_COLORS.map((c) => c.symbol);
    expect(new Set(symbols).size).toBe(PLAYER_COLORS.length);
  });

  it('hat die UI-Farben aus der Tabelle', () => {
    expect(hex(UI_COLORS.bgDeep)).toBe('#0f0e1a');
    expect(hex(UI_COLORS.accent)).toBe('#ffb800');
    expect(hex(UI_COLORS.danger)).toBe('#ff2d55');
    expect(hex(UI_COLORS.paper)).toBe('#fff8e7');
  });

  it('verbietet hellen Text auf Gelb und Cyan', () => {
    expect(textColorOn('yellow')).toBe(UI_COLORS.ink);
    expect(textColorOn('cyan')).toBe(UI_COLORS.ink);
    expect(textColorOn('red')).toBe(UI_COLORS.paper);
  });

  it('colorById findet die Farbe und wirft bei Unsinn', () => {
    expect(colorById('green').nickname).toBe('Gustav');
    // @ts-expect-error absichtlich ungueltige ID
    expect(() => colorById('magenta')).toThrow();
  });
});

describe('choreo.ts gegen GDD §3.5 / Architektur §5', () => {
  it('Phasen-Budget summiert sich zu 1', () => {
    const sum = Object.values(PHASE_BUDGET).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('deckt sich bei 15 s mit der GDD-Dramaturgie-Tabelle', () => {
    const d = phaseDurations('normal');
    expect(d.intro).toBe(1500); // 0.0 – 1.5 s
    expect(d.intro + d.scan).toBe(6000); // Scan endet bei 6.0 s
    expect(d.intro + d.scan + d.panic).toBeCloseTo(10_950, -2); // Panik ~11 s
    expect(d.intro + d.scan + d.panic + d.lock).toBeCloseTo(13_500, -2); // Shot ~13.5 s
  });

  it('hat die Verweildauern aus dem GDD', () => {
    expect(CHOREO.scanHoldMs).toEqual([600, 1200]);
    expect(CHOREO.panicHoldMs).toEqual([300, 700]);
    expect(CHOREO.hopMs).toEqual([300, 600]);
    expect(CHOREO.slowMoScale).toBe(0.4);
  });

  it('hat 1 Fake-Lock bei kurz, 2 bei normal/lang', () => {
    expect(CHOREO.fakeLocksByPreset.short).toBe(1);
    expect(CHOREO.fakeLocksByPreset.normal).toBe(2);
    expect(CHOREO.fakeLocksByPreset.long).toBe(2);
  });

  it('haelt die Anti-Vorhersagbarkeits-Regeln fest', () => {
    expect(CHOREO_FAIRNESS.victimShareTolerance).toBe(0.05);
    expect(CHOREO_FAIRNESS.lastFakeMustNotBeVictim).toBe(true);
    expect(CHOREO_FAIRNESS.forbidImmediateRepeat).toBe(true);
    expect(CHOREO_FAIRNESS.minPanicBeatsTwoPlayers).toBe(4);
  });
});
