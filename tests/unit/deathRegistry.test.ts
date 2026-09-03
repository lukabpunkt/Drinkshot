/**
 * Death-Registry-Tests (Architektur §6, Audit A3/A4).
 *
 * In M3 ist erst `basic_fall` registriert; die Auswahl-Regeln müssen trotzdem schon
 * stimmen, sonst fallen sie in M4 mit zwölf Sequenzen gleichzeitig auf.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { DEATH_NO_REPEAT_MIN_POOL, DEATH_NO_REPEAT_WINDOW } from '@/config/rules';
import { createSeededRng } from '@/core/rng';
import { DEATH_ZONES } from '@/core/session';
import {
  allDeaths,
  clearDeathRegistry,
  deathZone,
  getDeath,
  pickDeath,
  pushRecent,
  registerDeath,
  type DeathSequence,
} from '@/game/deaths/DeathSequence';
import { registerAllDeaths, resetDeathRegistration } from '@/game/deaths';

/** Leichtgewichtige Attrappe — `build()` wird hier nie aufgerufen. */
function fake(id: string, weight = 10, zone: DeathSequence['zone'] = 'body'): DeathSequence {
  return {
    id,
    zone,
    weight,
    needsSecondShot: false,
    build: () => {
      throw new Error('nicht aufgerufen');
    },
  };
}

beforeEach(() => {
  clearDeathRegistry();
  resetDeathRegistration();
});

describe('Registry', () => {
  it('registriert und findet Sequenzen', () => {
    registerDeath(fake('a'));
    expect(getDeath('a')?.id).toBe('a');
    expect(getDeath('gibt-es-nicht')).toBeUndefined();
    expect(allDeaths()).toHaveLength(1);
  });

  it('weist doppelte IDs zurück', () => {
    registerDeath(fake('a'));
    expect(() => registerDeath(fake('a'))).toThrow(/doppelt/);
  });

  it('liefert die Zone zu einer ID', () => {
    registerDeath(fake('kopf', 10, 'head'));
    expect(deathZone('kopf')).toBe('head');
    expect(deathZone('unbekannt')).toBeUndefined();
  });

  it('registerAllDeaths ist idempotent', () => {
    registerAllDeaths();
    registerAllDeaths();
    expect(allDeaths().map((d) => d.id)).toEqual(['basic_fall']);
  });

  it('basic_fall ist vollständig beschrieben', () => {
    registerAllDeaths();
    const sequence = getDeath('basic_fall');
    expect(sequence).toBeDefined();
    expect(DEATH_ZONES).toContain(sequence!.zone);
    expect(sequence!.weight).toBeGreaterThan(0);
    expect(typeof sequence!.needsSecondShot).toBe('boolean');
  });
});

describe('Auswahl', () => {
  it('wirft ohne registrierte Sequenz', () => {
    expect(() => pickDeath({ rng: createSeededRng(1) })).toThrow(/Keine DeathSequence/);
  });

  it('respektiert die Gewichte', () => {
    const pool = [fake('selten', 1), fake('haeufig', 9)];
    const rng = createSeededRng(4242);
    let often = 0;
    const draws = 20_000;
    for (let i = 0; i < draws; i++) {
      if (pickDeath({ rng, pool }).id === 'haeufig') often++;
    }
    expect(Math.abs(often / draws - 0.9)).toBeLessThan(0.01);
  });

  it('lässt Wunder weg, wenn sie abgeschaltet sind', () => {
    const pool = [fake('normal', 10), fake('wunder', 10, 'miracle')];
    const rng = createSeededRng(7);
    for (let i = 0; i < 500; i++) {
      expect(pickDeath({ rng, pool, miracles: false }).id).toBe('normal');
    }
  });

  it('fällt auf den ganzen Pool zurück, wenn nur Wunder registriert sind', () => {
    const pool = [fake('nur_wunder', 10, 'miracle')];
    expect(pickDeath({ rng: createSeededRng(1), pool, miracles: false }).id).toBe('nur_wunder');
  });

  it('ist bei gleichem Seed deterministisch', () => {
    const pool = Array.from({ length: 12 }, (_, i) => fake(`d${i}`, i + 1));
    const a = Array.from({ length: 50 }, () => pickDeath({ rng: createSeededRng(9), pool }).id);
    const b = Array.from({ length: 50 }, () => pickDeath({ rng: createSeededRng(9), pool }).id);
    expect(a).toEqual(b);
  });
});

describe(`No-Repeat-Fenster ${DEATH_NO_REPEAT_WINDOW}`, () => {
  it('wiederholt über 1 000 Runden keine ID innerhalb des Fensters', () => {
    const pool = Array.from({ length: 12 }, (_, i) => fake(`d${i}`));
    const rng = createSeededRng(123);
    let recent: string[] = [];

    for (let round = 0; round < 1000; round++) {
      const picked = pickDeath({ rng, pool, recent });
      expect(recent, `Runde ${round}: ${picked.id} war eben erst dran`).not.toContain(picked.id);
      recent = pushRecent(recent, picked.id);
      expect(recent.length).toBeLessThanOrEqual(DEATH_NO_REPEAT_WINDOW);
    }
  });

  it('greift nicht, solange zu wenige Sequenzen registriert sind', () => {
    // In M3 gibt es nur eine — sonst gäbe es gar keine Auswahl mehr.
    const pool = [fake('einzige')];
    const rng = createSeededRng(1);
    let recent: string[] = [];
    for (let i = 0; i < 20; i++) {
      const picked = pickDeath({ rng, pool, recent });
      expect(picked.id).toBe('einzige');
      recent = pushRecent(recent, picked.id);
    }
  });

  it('nutzt bei genau der Mindest-Poolgrösse alle Sequenzen', () => {
    const pool = Array.from({ length: DEATH_NO_REPEAT_MIN_POOL }, (_, i) => fake(`d${i}`));
    const rng = createSeededRng(55);
    const seen = new Set<string>();
    let recent: string[] = [];
    for (let i = 0; i < 400; i++) {
      const picked = pickDeath({ rng, pool, recent });
      seen.add(picked.id);
      recent = pushRecent(recent, picked.id);
    }
    expect(seen.size).toBe(DEATH_NO_REPEAT_MIN_POOL);
  });

  it('pushRecent behält nur die letzten Einträge', () => {
    let recent: string[] = [];
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) recent = pushRecent(recent, id);
    expect(recent).toEqual(['c', 'd', 'e', 'f']);
  });
});

describe('Vollständigkeit (M4)', () => {
  it.todo('alle 12 DeathIds aus GDD §4.1 sind registriert');
  it.todo('jede Sequenz dauert 1.5–4.5 s');
  it.todo('jede Sequenz endet mit victim.state === "dead" (außer miracle)');
  it.todo('nach Sequenz + Reset ist der Shotling wieder "idle"');
  it.todo('zu jeder Zone existiert ein Icon und ein Zonen-Text');
});
