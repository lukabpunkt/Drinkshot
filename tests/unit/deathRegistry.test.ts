/**
 * Death-Registry-Tests (Architektur §6, Audit A3/A4).
 *
 * In M3 ist erst `basic_fall` registriert; die Auswahl-Regeln müssen trotzdem schon
 * stimmen, sonst fallen sie in M4 mit zwölf Sequenzen gleichzeitig auf.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { DEATH_NO_REPEAT_MIN_POOL, DEATH_NO_REPEAT_WINDOW, MIRACLE_CHANCE } from '@/config/rules';
import { createSeededRng } from '@/core/rng';
import { t } from '@/core/i18n';
import { DEATH_CATALOG } from '@/game/deaths/catalog';
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
    const first = allDeaths().length;
    registerAllDeaths();
    expect(allDeaths()).toHaveLength(first);
  });

  it('jede Sequenz ist vollständig beschrieben', () => {
    registerAllDeaths();
    for (const sequence of allDeaths()) {
      expect(DEATH_ZONES, sequence.id).toContain(sequence.zone);
      expect(sequence.weight, sequence.id).toBeGreaterThan(0);
      expect(typeof sequence.needsSecondShot, sequence.id).toBe('boolean');
      expect(typeof sequence.build, sequence.id).toBe('function');
    }
  });
});

describe('Auswahl', () => {
  it('wirft bei leerem Pool', () => {
    expect(() => pickDeath({ rng: createSeededRng(1), pool: [] })).toThrow(/Katalog/);
  });

  /*
   * Die Ziehung läuft über den **Katalog**, nicht über die Registry — sonst müsste der
   * gesamte Rendering-Code geladen sein, bevor überhaupt gewürfelt werden kann (ADR-35).
   */
  it('zieht auch ohne geladene Implementierungen', () => {
    clearDeathRegistry();
    const meta = pickDeath({ rng: createSeededRng(3) });
    expect(DEATH_CATALOG.map((entry) => entry.id)).toContain(meta.id);
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

  /*
   * GDD §4.1: „Rarität, 1 von 40 Runden". Die Seltenheit hängt an `MIRACLE_CHANCE`, nicht
   * an einem Gewicht — sonst müsste man sie bei jeder neuen Sequenz nachrechnen.
   */
  it(`trifft die Wunder-Rate von 1 zu ${Math.round(1 / MIRACLE_CHANCE)}`, () => {
    const pool = [
      ...Array.from({ length: 11 }, (_, i) => fake(`d${i}`, 10)),
      fake('wunder', 1, 'miracle'),
    ];
    const rng = createSeededRng(20260904);
    const draws = 40_000;
    let miracles = 0;
    for (let i = 0; i < draws; i++) {
      if (pickDeath({ rng, pool }).zone === 'miracle') miracles++;
    }
    const rate = miracles / draws;
    expect(
      Math.abs(rate - MIRACLE_CHANCE),
      `gemessen 1 zu ${(1 / rate).toFixed(1)}`
    ).toBeLessThan(0.005);
  });

  it('die Wunder-Rate hängt nicht an der Zahl der übrigen Sequenzen', () => {
    // Gegenprobe: Mit doppelt so vielen normalen Sequenzen bleibt die Rate gleich.
    const many = [
      ...Array.from({ length: 30 }, (_, i) => fake(`d${i}`, 10)),
      fake('wunder', 1, 'miracle'),
    ];
    const rng = createSeededRng(4711);
    let miracles = 0;
    for (let i = 0; i < 40_000; i++) {
      if (pickDeath({ rng, pool: many }).zone === 'miracle') miracles++;
    }
    expect(Math.abs(miracles / 40_000 - MIRACLE_CHANCE)).toBeLessThan(0.005);
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

describe('Vollständigkeit', () => {
  /*
   * Dauer, Endzustand und Reset prüft `deaths.test.ts` pro Sequenz — dort steht der
   * Harness mit echtem Rig. Hier bleibt, was die Registry als Ganzes betrifft.
   */
  it('registriert alle zwölf Sequenzen aus GDD §4.1', () => {
    registerAllDeaths();
    const byZone = new Map<string, string[]>();
    for (const sequence of allDeaths()) {
      byZone.set(sequence.zone, [...(byZone.get(sequence.zone) ?? []), sequence.id]);
    }
    expect(byZone.get('head')?.sort()).toEqual([
      'head_hat_launch',
      'head_helmet_spin',
      'head_xray',
    ]);
    expect(byZone.get('body')?.sort()).toEqual([
      'basic_fall',
      'body_deflate',
      'body_dramatic',
      'body_freeze_shatter',
    ]);
    expect(byZone.get('leg')?.sort()).toEqual(['leg_hop', 'leg_spin']);
    expect(byZone.get('butt')?.sort()).toEqual(['butt_hotfoot', 'butt_rocket']);
    expect(byZone.get('miss')).toEqual(['miss_then_hit']);
    expect(byZone.get('miracle')).toEqual(['miracle_dodge']);

    // GDD §10.4 verlangt mindestens 12 unterschiedliche Tode.
    expect(allDeaths().length).toBeGreaterThanOrEqual(12);
  });

  it('jede registrierte Sequenz hat ein positives Gewicht', () => {
    registerAllDeaths();
    for (const sequence of allDeaths()) {
      expect(sequence.weight, sequence.id).toBeGreaterThan(0);
    }
  });

  it('jede Zone hat einen Text auf dem Result-Screen', () => {
    registerAllDeaths();
    for (const sequence of allDeaths()) {
      const text = t(`result.zone.${sequence.zone}`);
      expect(text, `Zonen-Text für ${sequence.zone} fehlt`).not.toContain('[missing:');
      expect(text.trim()).not.toBe('');
    }
  });
});
