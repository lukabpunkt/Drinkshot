/**
 * Session-Tests (Architektur §4, Audit A1: "Alle 4 Modi liefern korrekte Drinker").
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_PLAYERS, MAX_ROUND_HISTORY, STORAGE_KEY } from '@/config/rules';
import type { Bet } from '@/core/lottery';
import type { DeathId } from '@/core/session';
import {
  activePlayers,
  createEmptySession,
  createRoundSetup,
  createSessionStore,
  eliminatedPlayerIds,
  loadSession,
  resolveRound,
  roundOdds,
  saveSession,
  scoreboard,
  type RoundResult,
  type RoundSetup,
} from '@/core/session';

const BETS: Bet[] = [
  { playerId: 'p1', sips: 2 },
  { playerId: 'p2', sips: 3 },
  { playerId: 'p3', sips: 5 },
];

/** Baut ein RoundSetup ohne Ziehung — das Opfer wird fuer den Test vorgegeben. */
function setup(overrides: Partial<RoundSetup> = {}): RoundSetup {
  return {
    seed: 1,
    bets: BETS.map((bet) => ({ ...bet })),
    victimId: 'p3',
    extraVictimIds: [],
    deathId: 'basic_fall',
    extraDeaths: [],
    zone: 'body',
    mode: 'classic',
    durationPreset: 'normal',
    potSips: BETS.reduce((sum, bet) => sum + bet.sips, 0),
    ...overrides,
  };
}

beforeEach(() => localStorage.clear());

describe('createRoundSetup', () => {
  it('zieht ein Opfer aus der Runde und setzt einen Seed', () => {
    const result = createRoundSetup(BETS, 'classic', 'normal');
    expect(['p1', 'p2', 'p3']).toContain(result.victimId);
    expect(result.extraVictimIds).toEqual([]);
    expect(Number.isInteger(result.seed)).toBe(true);
    expect(result.deathId).toBe('basic_fall');
    expect(result.zone).toBe('body');
  });

  it('kopiert die Einsaetze, statt sie zu referenzieren', () => {
    const result = createRoundSetup(BETS, 'classic', 'normal');
    result.bets[0]!.sips = 99;
    expect(BETS[0]!.sips).toBe(2);
  });

  it('zieht im Modus "Double Tap" zwei verschiedene Opfer', () => {
    const result = createRoundSetup(BETS, 'doubleTap', 'long');
    expect(result.extraVictimIds).toHaveLength(1);
    expect(result.extraVictimIds[0]).not.toBe(result.victimId);
  });

  it('roundOdds liefert die Chancen-Tabelle', () => {
    expect(roundOdds(createRoundSetup(BETS, 'classic', 'normal'))['p3']).toBeCloseTo(0.5, 10);
  });
});

describe('resolveRound — Modus "Klassik"', () => {
  it('das Opfer trinkt seinen eigenen Einsatz', () => {
    const result = resolveRound(setup());
    expect(result.drinkers).toEqual([{ playerId: 'p3', sips: 5 }]);
    expect(result.eliminatedIds).toEqual([]);
  });

  it('haengt Chancen und Zeitstempel an', () => {
    const result = resolveRound(setup(), 1_700_000_000_000);
    expect(result.odds['p3']).toBeCloseTo(0.5, 10);
    expect(result.finishedAt).toBe(1_700_000_000_000);
  });

  it('greift auch beim kleinsten Einsatz', () => {
    expect(resolveRound(setup({ victimId: 'p1' })).drinkers).toEqual([{ playerId: 'p1', sips: 2 }]);
  });
});

describe('resolveRound — Modus "Verteiler"', () => {
  it('alle ausser dem Opfer trinken dessen Einsatz', () => {
    const result = resolveRound(setup({ mode: 'distributor' }));
    expect(result.drinkers).toEqual([
      { playerId: 'p1', sips: 5 },
      { playerId: 'p2', sips: 5 },
    ]);
    expect(result.drinkers.some((drinker) => drinker.playerId === 'p3')).toBe(false);
  });

  it('bei 2 Spielern trinkt genau einer', () => {
    const result = resolveRound(
      setup({
        mode: 'distributor',
        bets: [
          { playerId: 'a', sips: 4 },
          { playerId: 'b', sips: 7 },
        ],
        victimId: 'b',
      })
    );
    expect(result.drinkers).toEqual([{ playerId: 'a', sips: 7 }]);
  });
});

describe('resolveRound — Modus "Sudden Death"', () => {
  it('das Opfer trinkt und scheidet aus', () => {
    const result = resolveRound(setup({ mode: 'suddenDeath' }));
    expect(result.drinkers).toEqual([{ playerId: 'p3', sips: 5 }]);
    expect(result.eliminatedIds).toEqual(['p3']);
    expect(result.winnerId).toBeUndefined();
  });

  it('kuert den letzten Ueberlebenden und beziffert, was er verteilt', () => {
    const result = resolveRound(
      setup({
        mode: 'suddenDeath',
        bets: [
          { playerId: 'a', sips: 4 },
          { playerId: 'b', sips: 6 },
        ],
        victimId: 'b',
      })
    );
    expect(result.eliminatedIds).toEqual(['b']);
    expect(result.winnerId).toBe('a');
    expect(result.sipsToDistribute).toBe(10);
  });
});

describe('resolveRound — Modus "Double Tap"', () => {
  it('beide Opfer trinken ihren eigenen Einsatz', () => {
    const result = resolveRound(setup({ mode: 'doubleTap', victimId: 'p3', extraVictimIds: ['p1'] }));
    expect(result.drinkers).toEqual([
      { playerId: 'p3', sips: 5 },
      { playerId: 'p1', sips: 2 },
    ]);
  });

  it('ohne zweites Opfer verhaelt es sich wie Klassik', () => {
    const result = resolveRound(setup({ mode: 'doubleTap' }));
    expect(result.drinkers).toEqual([{ playerId: 'p3', sips: 5 }]);
  });
});

describe('resolveRound — Miracle (GDD §4.1)', () => {
  it('niemand trinkt', () => {
    const result = resolveRound(setup({ zone: 'miracle', deathId: 'miracle_dodge' }));
    expect(result.drinkers).toEqual([]);
    expect(result.eliminatedIds).toEqual([]);
  });

  it('im Verteiler-Modus trinken alle genau 1', () => {
    const result = resolveRound(setup({ zone: 'miracle', mode: 'distributor' }));
    expect(result.drinkers).toEqual([
      { playerId: 'p1', sips: 1 },
      { playerId: 'p2', sips: 1 },
      { playerId: 'p3', sips: 1 },
    ]);
  });

  it('scheidet auch in Sudden Death niemanden aus', () => {
    expect(resolveRound(setup({ zone: 'miracle', mode: 'suddenDeath' })).eliminatedIds).toEqual([]);
  });
});

describe('Scoreboard & Ausscheiden', () => {
  it('summiert ueber alle Runden', () => {
    const session = createEmptySession();
    session.players = [
      { id: 'p1', name: 'A', colorId: 'red' },
      { id: 'p2', name: 'B', colorId: 'blue' },
    ];
    session.rounds = [
      resolveRound(setup({ bets: [{ playerId: 'p1', sips: 3 }], victimId: 'p1' })),
      resolveRound(setup({ bets: [{ playerId: 'p1', sips: 2 }], victimId: 'p1' })),
      resolveRound(setup({ bets: [{ playerId: 'p2', sips: 7 }], victimId: 'p2' })),
    ];
    expect(scoreboard(session)).toEqual({ p1: 5, p2: 7 });
  });

  it('startet jeden Spieler bei 0', () => {
    const session = createEmptySession();
    session.players = [{ id: 'p1', name: 'A', colorId: 'red' }];
    expect(scoreboard(session)).toEqual({ p1: 0 });
  });

  it('leitet Ausgeschiedene aus der History ab', () => {
    const session = createEmptySession();
    session.players = [
      { id: 'p1', name: 'A', colorId: 'red' },
      { id: 'p2', name: 'B', colorId: 'blue' },
      { id: 'p3', name: 'C', colorId: 'green' },
    ];
    session.rounds = [resolveRound(setup({ mode: 'suddenDeath', victimId: 'p2' }))];
    expect([...eliminatedPlayerIds(session)]).toEqual(['p2']);
    expect(activePlayers(session).map((player) => player.id)).toEqual(['p1', 'p3']);
  });
});

describe('Persistenz', () => {
  it('liefert ohne gespeicherte Daten eine leere Session', () => {
    const session = loadSession();
    expect(session.players).toEqual([]);
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
    session.rounds = Array.from(
      { length: 60 },
      (_, i) => ({ ...setup(), finishedAt: i + 1, drinkers: [], eliminatedIds: [], odds: {} })
    ) as RoundResult[];
    saveSession(session);
    expect(loadSession().rounds).toHaveLength(MAX_ROUND_HISTORY);
  });

  it('ueberlebt kaputte Daten und muellige Spieler-Eintraege', () => {
    localStorage.setItem(STORAGE_KEY, '{kein json');
    expect(loadSession().players).toEqual([]);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        players: [
          { id: 'ok', name: 'Gut', colorId: 'red' },
          { id: 'x', name: 'Kaputt', colorId: 'magenta' },
          { name: 'ohne id', colorId: 'blue' },
          null,
          'nope',
        ],
      })
    );
    expect(loadSession().players).toEqual([{ id: 'ok', name: 'Gut', colorId: 'red' }]);
  });

  it('kuerzt zu lange Namen beim Laden', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ players: [{ id: 'a', name: 'Viel zu langer Name', colorId: 'red' }] })
    );
    expect(loadSession().players[0]!.name).toHaveLength(12);
  });

  it('funktioniert ohne Storage (privater Modus)', () => {
    expect(() => saveSession(createEmptySession(), undefined)).not.toThrow();
    expect(loadSession(undefined).players).toEqual([]);
  });
});

describe('SessionStore', () => {
  const nameFor = (index: number): string => `Spieler ${index}`;

  it('vergibt Farben der Reihe nach', () => {
    const store = createSessionStore(createEmptySession());
    store.addPlayer(nameFor);
    store.addPlayer(nameFor);
    store.addPlayer(nameFor);
    expect(store.state.players.map((player) => player.colorId)).toEqual(['red', 'blue', 'green']);
  });

  it('vergibt eine frei gewordene Farbe erneut', () => {
    const store = createSessionStore(createEmptySession());
    store.addPlayer(nameFor);
    const second = store.addPlayer(nameFor)!;
    store.addPlayer(nameFor);
    store.removePlayer(second.id);
    expect(store.addPlayer(nameFor)!.colorId).toBe('blue');
  });

  it('stoppt bei 8 Spielern', () => {
    const store = createSessionStore(createEmptySession());
    for (let i = 0; i < MAX_PLAYERS; i++) expect(store.addPlayer(nameFor)).not.toBeNull();
    expect(store.addPlayer(nameFor)).toBeNull();
    expect(store.state.players).toHaveLength(MAX_PLAYERS);
  });

  it('fuellt auf die Mindestzahl auf', () => {
    const store = createSessionStore(createEmptySession());
    store.ensureMinimumPlayers(nameFor);
    expect(store.state.players).toHaveLength(2);
    store.ensureMinimumPlayers(nameFor);
    expect(store.state.players).toHaveLength(2);
  });

  it('benennt um und kuerzt auf 12 Zeichen', () => {
    const store = createSessionStore(createEmptySession());
    const player = store.addPlayer(nameFor)!;
    store.renamePlayer(player.id, 'Ein sehr langer Name');
    expect(store.state.players[0]!.name).toBe('Ein sehr lan');
  });

  it('persistiert jede Aenderung', () => {
    const store = createSessionStore(createEmptySession());
    store.addPlayer(nameFor);
    expect(loadSession().players).toHaveLength(1);
  });

  it('meldet canStart erst ab zwei aktiven Spielern', () => {
    const store = createSessionStore(createEmptySession());
    store.addPlayer(nameFor);
    expect(store.canStart()).toBe(false);
    store.addPlayer(nameFor);
    expect(store.canStart()).toBe(true);
  });

  it('schliesst Ausgeschiedene waehrend des Turniers von activePlayers aus', () => {
    const store = createSessionStore(createEmptySession());
    const a = store.addPlayer(nameFor)!;
    const b = store.addPlayer(nameFor)!;
    const c = store.addPlayer(nameFor)!;
    const bets = [a, b, c].map((player, i) => ({ playerId: player.id, sips: i + 1 }));
    // Drei Spieler, einer faellt: das Turnier laeuft noch, also bleibt er draussen.
    store.recordRound(resolveRound(setup({ mode: 'suddenDeath', bets, victimId: c.id })));
    expect(store.activePlayers().map((player) => player.id)).toEqual([a.id, b.id]);
    expect(store.canStart()).toBe(true);
  });

  it('holt nach dem entschiedenen Turnier alle zurueck', () => {
    const store = createSessionStore(createEmptySession());
    const a = store.addPlayer(nameFor)!;
    const b = store.addPlayer(nameFor)!;
    const c = store.addPlayer(nameFor)!;
    const all = [a, b, c].map((player, i) => ({ playerId: player.id, sips: i + 1 }));

    store.recordRound(resolveRound(setup({ mode: 'suddenDeath', bets: all, victimId: c.id })));
    const finale = resolveRound(
      setup({ mode: 'suddenDeath', bets: all.slice(0, 2), victimId: b.id, potSips: 6 })
    );
    expect(finale.winnerId).toBe(a.id);
    // Der Letzte verteilt den Topf des Turniers, nicht nur den der Schlussrunde (ADR-53).
    expect(finale.sipsToDistribute).toBe(6);

    store.recordRound(finale);
    expect(store.activePlayers()).toHaveLength(3);
    expect(store.canStart()).toBe(true);
  });

  it('startTournament laesst frueheres Ausscheiden verfallen', () => {
    const store = createSessionStore(createEmptySession());
    const a = store.addPlayer(nameFor)!;
    const b = store.addPlayer(nameFor)!;
    const c = store.addPlayer(nameFor)!;
    const bets = [a, b, c].map((player, i) => ({ playerId: player.id, sips: i + 1 }));
    store.recordRound(
      resolveRound(setup({ mode: 'suddenDeath', bets, victimId: c.id }), Date.now() - 1000)
    );
    expect(store.activePlayers()).toHaveLength(2);

    store.startTournament();
    expect(store.activePlayers()).toHaveLength(3);
  });

  it('ueberlebt Runden ohne eliminatedIds im Speicher', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        players: [{ id: 'p1', name: 'Anna', colorId: 'red' }],
        rounds: [
          { mode: 'suddenDeath', finishedAt: 1, bets: [{ playerId: 'p1', sips: 2 }] },
          { finishedAt: 2 },
          { mode: 'gibtsnicht', finishedAt: 3 },
        ],
      })
    );
    const session = loadSession();
    // Nur die Runde mit bekanntem Modus ueberlebt — und sie hat wieder alle Felder.
    expect(session.rounds).toHaveLength(1);
    expect(session.rounds[0]!.eliminatedIds).toEqual([]);
    expect(session.rounds[0]!.potSips).toBe(2);
    expect(() => eliminatedPlayerIds(session)).not.toThrow();
  });

  it('benachrichtigt Subscriber', () => {
    const store = createSessionStore(createEmptySession());
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.addPlayer(nameFor);
    expect(calls).toBe(1);
    off();
    store.addPlayer(nameFor);
    expect(calls).toBe(1);
  });

  it('startTournament zieht die Grenze, reset raeumt alles ab', () => {
    const store = createSessionStore(createEmptySession());
    store.addPlayer(nameFor);
    store.recordRound(resolveRound(setup()));
    store.startTournament();
    // Die History bleibt — nur das Ausscheiden davor zaehlt nicht mehr (ADR-54).
    expect(store.state.rounds).toHaveLength(1);
    expect(store.state.tournamentFrom).toBeGreaterThan(0);
    expect(store.state.players).toHaveLength(1);

    store.reset();
    expect(store.state.players).toEqual([]);
    expect(loadSession().players).toEqual([]);
  });

  it('findet Spieler ueber die ID', () => {
    const store = createSessionStore(createEmptySession());
    const player = store.addPlayer(nameFor)!;
    expect(store.playerById(player.id)?.id).toBe(player.id);
    expect(store.playerById('gibt-es-nicht')).toBeUndefined();
  });
});

describe('createRoundSetup — Double Tap zieht eine Sequenz je Opfer', () => {
  it('legt fuer jedes Extra-Opfer genau eine Sequenz an', () => {
    let calls = 0;
    const round = createRoundSetup(BETS, 'doubleTap', 'normal', () => {
      calls += 1;
      return { deathId: `death_${calls}` as DeathId, zone: 'body' };
    });

    expect(round.extraVictimIds).toHaveLength(1);
    expect(round.extraDeaths).toHaveLength(1);
    expect(calls).toBe(2);
    // Nacheinander aus demselben PRNG gezogen — nicht zweimal dieselbe Ziehung.
    expect(round.extraDeaths[0]!.deathId).not.toBe(round.deathId);
  });

  it('bleibt in den anderen Modi bei einer Sequenz', () => {
    const round = createRoundSetup(BETS, 'classic', 'normal', () => ({
      deathId: 'basic_fall',
      zone: 'body',
    }));
    expect(round.extraVictimIds).toHaveLength(0);
    expect(round.extraDeaths).toHaveLength(0);
  });
});

describe('resolveRound — Showdown', () => {
  it('lässt alle bis auf einen trinken, jeder seinen eigenen Einsatz', () => {
    const round = resolveRound(
      setup({ mode: 'showdown', victimId: 'p1', extraVictimIds: ['p3'] })
    );

    // p1 (2) und p3 (5) sind gefallen, p2 (3) steht noch.
    expect(round.drinkers).toEqual([
      { playerId: 'p1', sips: 2 },
      { playerId: 'p3', sips: 5 },
    ]);
  });

  it('macht den Übriggebliebenen zum Gewinner, der seinen Einsatz verteilt', () => {
    const round = resolveRound(
      setup({ mode: 'showdown', victimId: 'p1', extraVictimIds: ['p3'] })
    );

    expect(round.winnerId).toBe('p2');
    // Seinen eigenen Einsatz, nicht den Pot.
    expect(round.sipsToDistribute).toBe(3);
  });

  it('scheidet niemanden für die Session aus — das ist der Unterschied zu Sudden Death', () => {
    const showdown = resolveRound(
      setup({ mode: 'showdown', victimId: 'p1', extraVictimIds: ['p3'] })
    );
    const suddenDeath = resolveRound(setup({ mode: 'suddenDeath', victimId: 'p1' }));

    expect(showdown.eliminatedIds).toEqual([]);
    expect(suddenDeath.eliminatedIds).toEqual(['p1']);
  });

  it('bleibt zu zweit sinnvoll: einer trinkt, einer verteilt', () => {
    const round = resolveRound(
      setup({
        bets: [
          { playerId: 'a', sips: 4 },
          { playerId: 'b', sips: 6 },
        ],
        mode: 'showdown',
        victimId: 'a',
        extraVictimIds: [],
      })
    );

    expect(round.drinkers).toEqual([{ playerId: 'a', sips: 4 }]);
    expect(round.winnerId).toBe('b');
    expect(round.sipsToDistribute).toBe(6);
  });

  it('die Session läuft danach weiter — alle sind wieder dabei', () => {
    const session = createSessionStore();
    session.addPlayer((index) => `Spieler ${index}`);
    session.addPlayer((index) => `Spieler ${index}`);
    session.addPlayer((index) => `Spieler ${index}`);
    const [a, b, c] = session.state.players.map((player) => player.id);

    session.recordRound(
      resolveRound(
        setup({
          bets: [
            { playerId: a!, sips: 2 },
            { playerId: b!, sips: 3 },
            { playerId: c!, sips: 4 },
          ],
          mode: 'showdown',
          victimId: a!,
          extraVictimIds: [b!],
        })
      )
    );

    expect(session.activePlayers()).toHaveLength(3);
    expect(session.canStart()).toBe(true);
  });
});

describe('createRoundSetup — Showdown zieht bis auf einen', () => {
  it('erschiesst alle bis auf einen und zieht je eine Sequenz', () => {
    let calls = 0;
    const round = createRoundSetup(BETS, 'showdown', 'normal', () => {
      calls += 1;
      return { deathId: `death_${calls}` as DeathId, zone: 'body' };
    });

    // Drei Spieler → zwei fallen, einer bleibt.
    expect(round.extraVictimIds).toHaveLength(1);
    expect(round.extraDeaths).toHaveLength(1);
    expect(calls).toBe(2);

    const victims = new Set([round.victimId, ...round.extraVictimIds]);
    expect(victims.size).toBe(2);
  });

  it('reicht der Auswahl durch, an welcher Stelle der Runde sie steht', () => {
    const seen: { index: number; total: number; drawn: readonly string[] }[] = [];
    createRoundSetup(BETS, 'showdown', 'normal', (_rng, context) => {
      seen.push({ index: context.index, total: context.total, drawn: [...context.drawn] });
      return { deathId: `death_${context.index}` as DeathId, zone: 'body' };
    });

    expect(seen.map((entry) => entry.index)).toEqual([0, 1]);
    expect(seen.every((entry) => entry.total === 2)).toBe(true);
    // Die zweite Ziehung kennt die erste — sonst gäbe es Dubletten in einer Runde.
    expect(seen[0]!.drawn).toEqual([]);
    expect(seen[1]!.drawn).toEqual(['death_0']);
  });
});
