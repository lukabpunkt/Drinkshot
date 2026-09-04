/**
 * FSM-Tests (Architektur §3, Audit A0: jeder Pfeil im Diagramm + 100 % Branch-Coverage).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFsm, GAME_STATES, type Fsm, type GameEvent, type Transition } from '@/core/fsm';
import type { Bet } from '@/core/lottery';
import type { RoundSetup } from '@/core/session';

const PLAYERS = ['p1', 'p2', 'p3'];

/** Deterministischer Ersatz fuer die Ziehung — die FSM darf sie nur einmal aufrufen. */
function fakeDraw(bets: readonly Bet[]): RoundSetup {
  return {
    seed: 42,
    bets: bets.map((b) => ({ ...b })),
    victimId: bets[0]!.playerId,
    extraVictimIds: [],
    deathId: 'basic_fall',
    extraDeaths: [],
    zone: 'body',
    mode: 'classic',
    durationPreset: 'normal',
  };
}

function makeFsm(players = PLAYERS): Fsm {
  return createFsm({ players, drawRound: fakeDraw });
}

/** Spielt bis zum gewuenschten State durch. */
function advanceTo(
  fsm: Fsm,
  target: 'LOBBY' | 'PASS' | 'BET' | 'READY' | 'ARENA' | 'RESULT'
): Fsm {
  fsm.send({ type: 'start' });
  if (target === 'LOBBY') return fsm;
  fsm.send({ type: 'begin' });
  if (target === 'PASS') return fsm;
  fsm.send({ type: 'tap' });
  if (target === 'BET') return fsm;
  // Alle Spieler setzen — endet in READY, nicht mehr direkt in der Arena.
  for (let i = 0; i < PLAYERS.length; i++) {
    fsm.send({ type: 'confirm', sips: 3 });
    if (fsm.state === 'PASS') fsm.send({ type: 'tap' });
  }
  if (target === 'READY') return fsm;
  fsm.send({ type: 'startShow' });
  if (target === 'ARENA') return fsm;
  fsm.send({ type: 'showFinished' });
  return fsm;
}

describe('FSM — Startzustand', () => {
  it('startet in TITLE ohne Runde', () => {
    const fsm = makeFsm();
    expect(fsm.state).toBe('TITLE');
    expect(fsm.context.round).toBeNull();
    expect(fsm.context.bets).toEqual([]);
    expect(fsm.drawCount).toBe(0);
  });

  it('nimmt Defaults, wenn keine Optionen uebergeben werden', () => {
    const fsm = createFsm();
    expect(fsm.context.players).toEqual([]);
    expect(fsm.context.mode).toBe('classic');
    expect(fsm.context.durationPreset).toBe('normal');
  });
});

describe('FSM — jeder Pfeil des Diagramms', () => {
  let fsm: Fsm;

  beforeEach(() => {
    fsm = makeFsm();
  });

  it('TITLE --start--> LOBBY', () => {
    expect(fsm.send({ type: 'start' })).toBe(true);
    expect(fsm.state).toBe('LOBBY');
  });

  it('LOBBY --begin--> PASS(0)', () => {
    advanceTo(fsm, 'LOBBY');
    expect(fsm.send({ type: 'begin' })).toBe(true);
    expect(fsm.state).toBe('PASS');
    expect(fsm.context.playerIndex).toBe(0);
  });

  it('LOBBY --begin--> blockiert bei weniger als 2 Spielern', () => {
    const solo = createFsm({ players: ['p1'], drawRound: fakeDraw });
    solo.send({ type: 'start' });
    expect(solo.send({ type: 'begin' })).toBe(false);
    expect(solo.state).toBe('LOBBY');
  });

  it('PASS --tap--> BET', () => {
    advanceTo(fsm, 'PASS');
    expect(fsm.send({ type: 'tap' })).toBe(true);
    expect(fsm.state).toBe('BET');
  });

  it('BET --confirm--> PASS(i+1), solange noch jemand fehlt', () => {
    advanceTo(fsm, 'BET');
    expect(fsm.send({ type: 'confirm', sips: 4 })).toBe(true);
    expect(fsm.state).toBe('PASS');
    expect(fsm.context.playerIndex).toBe(1);
    expect(fsm.context.bets).toEqual([{ playerId: 'p1', sips: 4 }]);
    expect(fsm.drawCount).toBe(0);
  });

  it('BET --confirm--> ARENA beim letzten Spieler, mit genau einer Ziehung', () => {
    advanceTo(fsm, 'ARENA');
    expect(fsm.state).toBe('ARENA');
    expect(fsm.drawCount).toBe(1);
    expect(fsm.context.round?.victimId).toBe('p1');
    expect(fsm.context.bets).toHaveLength(3);
  });

  it('ARENA --showFinished--> RESULT und zaehlt die Runde', () => {
    advanceTo(fsm, 'ARENA');
    expect(fsm.send({ type: 'showFinished' })).toBe(true);
    expect(fsm.state).toBe('RESULT');
    expect(fsm.context.roundNumber).toBe(1);
  });

  it('RESULT --nextRound--> PASS(0) mit frischer Runde', () => {
    advanceTo(fsm, 'RESULT');
    expect(fsm.send({ type: 'nextRound' })).toBe(true);
    expect(fsm.state).toBe('PASS');
    expect(fsm.context.playerIndex).toBe(0);
    expect(fsm.context.bets).toEqual([]);
    expect(fsm.context.round).toBeNull();
  });

  it('RESULT --changePlayers--> LOBBY', () => {
    advanceTo(fsm, 'RESULT');
    expect(fsm.send({ type: 'changePlayers' })).toBe(true);
    expect(fsm.state).toBe('LOBBY');
  });

  it.each(['PASS', 'BET', 'ARENA'] as const)('%s --cancel--> LOBBY und verwirft die Runde', (state) => {
    advanceTo(fsm, state);
    expect(fsm.send({ type: 'cancel' })).toBe(true);
    expect(fsm.state).toBe('LOBBY');
    expect(fsm.context.round).toBeNull();
    expect(fsm.context.bets).toEqual([]);
    expect(fsm.context.playerIndex).toBe(0);
  });
});

describe('FSM — unzulaessige Events', () => {
  const ALL_EVENTS: GameEvent[] = [
    { type: 'start' },
    { type: 'begin' },
    { type: 'tap' },
    { type: 'confirm', sips: 3 },
    { type: 'showFinished' },
    { type: 'nextRound' },
    { type: 'changePlayers' },
    { type: 'cancel' },
    { type: 'startShow' },
  ];

  const ALLOWED: Record<string, string[]> = {
    TITLE: ['start'],
    LOBBY: ['begin'],
    PASS: ['tap', 'cancel'],
    BET: ['confirm', 'cancel'],
    READY: ['startShow', 'cancel'],
    ARENA: ['showFinished', 'cancel'],
    RESULT: ['nextRound', 'changePlayers'],
  };

  it.each(GAME_STATES)('in %s werden nur die erlaubten Events angenommen', (state) => {
    for (const event of ALL_EVENTS) {
      const fsm = makeFsm();
      advanceTo(fsm, state === 'TITLE' ? 'LOBBY' : state);
      if (state === 'TITLE') {
        // frische Instanz, noch kein start
        const fresh = makeFsm();
        expect(fresh.can(event.type)).toBe(ALLOWED['TITLE']!.includes(event.type));
        continue;
      }
      expect(fsm.state).toBe(state);
      const allowed = ALLOWED[state]!.includes(event.type);
      expect(fsm.can(event.type)).toBe(allowed);
      if (!allowed) {
        expect(fsm.send(event)).toBe(false);
        expect(fsm.state).toBe(state);
      }
    }
  });

  it('wirft bei ungueltigem Einsatz', () => {
    const fsm = makeFsm();
    advanceTo(fsm, 'BET');
    expect(() => fsm.send({ type: 'confirm', sips: 0 })).toThrow(RangeError);
    expect(() => fsm.send({ type: 'confirm', sips: 11 })).toThrow(RangeError);
    expect(() => fsm.send({ type: 'confirm', sips: 2.5 })).toThrow(RangeError);
    expect(fsm.state).toBe('BET');
  });
});

describe('FSM — Hooks & Subscriber', () => {
  it('ruft exit des alten und enter des neuen States', () => {
    const fsm = makeFsm();
    const order: string[] = [];
    fsm.on('TITLE', { exit: (_ctx, to) => order.push(`exit TITLE -> ${to}`) });
    fsm.on('LOBBY', { enter: (_ctx, from) => order.push(`enter LOBBY <- ${from}`) });
    fsm.send({ type: 'start' });
    expect(order).toEqual(['exit TITLE -> LOBBY', 'enter LOBBY <- TITLE']);
  });

  it('ignoriert Hooks ohne passende Callbacks', () => {
    const fsm = makeFsm();
    fsm.on('LOBBY', {});
    expect(() => fsm.send({ type: 'start' })).not.toThrow();
  });

  it('meldet Hooks wieder ab', () => {
    const fsm = makeFsm();
    const enter = vi.fn();
    const off = fsm.on('LOBBY', { enter });
    off();
    off(); // doppeltes Abmelden ist erlaubt
    fsm.send({ type: 'start' });
    expect(enter).not.toHaveBeenCalled();
  });

  it('benachrichtigt Subscriber und onTransition', () => {
    const onTransition = vi.fn();
    const fsm = createFsm({ players: PLAYERS, drawRound: fakeDraw, onTransition });
    const seen: Transition[] = [];
    const off = fsm.subscribe((transition) => seen.push(transition));

    fsm.send({ type: 'start' });
    expect(onTransition).toHaveBeenCalledTimes(1);
    expect(seen[0]?.from).toBe('TITLE');
    expect(seen[0]?.to).toBe('LOBBY');

    off();
    fsm.send({ type: 'begin' });
    expect(seen).toHaveLength(1);
    expect(onTransition).toHaveBeenCalledTimes(2);
  });
});

describe('FSM — Setter', () => {
  it('setPlayers ersetzt die Liste und korrigiert einen ueberlaufenden Index', () => {
    const fsm = makeFsm();
    advanceTo(fsm, 'BET');
    fsm.send({ type: 'confirm', sips: 2 });
    fsm.send({ type: 'tap' });
    fsm.send({ type: 'confirm', sips: 2 });
    fsm.send({ type: 'tap' });
    expect(fsm.context.playerIndex).toBe(2);

    fsm.setPlayers(['a', 'b']);
    expect(fsm.context.players).toEqual(['a', 'b']);
    expect(fsm.context.playerIndex).toBe(0);
  });

  it('setPlayers laesst einen gueltigen Index stehen', () => {
    const fsm = makeFsm();
    advanceTo(fsm, 'BET');
    fsm.send({ type: 'confirm', sips: 2 });
    expect(fsm.context.playerIndex).toBe(1);
    fsm.setPlayers(['a', 'b', 'c', 'd']);
    expect(fsm.context.playerIndex).toBe(1);
  });

  it('setMode und setDuration wirken auf den Kontext', () => {
    const fsm = makeFsm();
    fsm.setMode('distributor');
    fsm.setDuration('long');
    expect(fsm.context.mode).toBe('distributor');
    expect(fsm.context.durationPreset).toBe('long');
  });

  it('reicht Modus und Dauer an die Ziehung durch', () => {
    const draw = vi.fn(fakeDraw);
    const fsm = createFsm({
      players: ['a', 'b'],
      mode: 'doubleTap',
      durationPreset: 'short',
      drawRound: draw,
    });
    fsm.send({ type: 'start' });
    fsm.send({ type: 'begin' });
    fsm.send({ type: 'tap' });
    fsm.send({ type: 'confirm', sips: 1 });
    fsm.send({ type: 'tap' });
    fsm.send({ type: 'confirm', sips: 2 });
    // Der letzte Einsatz fuehrt nach READY — gezogen wird erst beim Start (ADR-42).
    expect(fsm.state).toBe('READY');
    expect(draw).not.toHaveBeenCalled();

    fsm.send({ type: 'startShow' });
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw).toHaveBeenCalledWith(
      [
        { playerId: 'a', sips: 1 },
        { playerId: 'b', sips: 2 },
      ],
      'doubleTap',
      'short'
    );
  });
});

describe('FSM — Ziehung genau einmal (ADR-2)', () => {
  it('zieht ueber drei Runden genau dreimal', () => {
    const draw = vi.fn(fakeDraw);
    const fsm = createFsm({ players: ['a', 'b'], drawRound: draw });
    fsm.send({ type: 'start' });
    fsm.send({ type: 'begin' });

    for (let round = 1; round <= 3; round++) {
      fsm.send({ type: 'tap' });
      fsm.send({ type: 'confirm', sips: 2 });
      fsm.send({ type: 'tap' });
      fsm.send({ type: 'confirm', sips: 3 });
      expect(fsm.state).toBe('READY');
      fsm.send({ type: 'startShow' });
      expect(fsm.state).toBe('ARENA');
      expect(draw).toHaveBeenCalledTimes(round);
      fsm.send({ type: 'showFinished' });
      if (round < 3) fsm.send({ type: 'nextRound' });
    }
    expect(fsm.context.roundNumber).toBe(3);
  });

  it('nutzt produktiv die echte Ziehung aus lottery.ts', () => {
    const fsm = createFsm({ players: ['a', 'b'] });
    fsm.send({ type: 'start' });
    fsm.send({ type: 'begin' });
    fsm.send({ type: 'tap' });
    fsm.send({ type: 'confirm', sips: 5 });
    fsm.send({ type: 'tap' });
    fsm.send({ type: 'confirm', sips: 5 });
    fsm.send({ type: 'startShow' });
    expect(fsm.state).toBe('ARENA');
    expect(['a', 'b']).toContain(fsm.context.round?.victimId);
    expect(fsm.drawCount).toBe(1);
  });

  it('wer aus READY abbricht, hat nie gezogen', () => {
    const draw = vi.fn(fakeDraw);
    const fsm = createFsm({ players: ['a', 'b'], drawRound: draw });
    advanceTo(fsm, 'READY');

    expect(fsm.context.round).toBeNull();
    fsm.send({ type: 'cancel' });

    expect(fsm.state).toBe('LOBBY');
    expect(draw).not.toHaveBeenCalled();
    expect(fsm.drawCount).toBe(0);
    // Der Abbruch raeumt die Einsaetze weg, sonst laegen sie in der naechsten Runde noch da.
    expect(fsm.context.bets).toEqual([]);
  });

  it('READY haelt die Einsaetze, bis der Start kommt', () => {
    const fsm = makeFsm();
    advanceTo(fsm, 'READY');
    expect(fsm.context.bets).toHaveLength(PLAYERS.length);
    expect(fsm.context.round).toBeNull();

    fsm.send({ type: 'startShow' });
    expect(fsm.context.round).not.toBeNull();
  });
});
