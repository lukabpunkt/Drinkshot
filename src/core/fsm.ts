/**
 * Game-State-Machine (Architektur §3).
 *
 * Die FSM kennt keine Screens — sie haelt den Spielzustand, prueft die Guards und ruft
 * `enter`/`exit`-Hooks. Der Router (M1) haengt sich als Hook ein.
 *
 * Verbindlich (ADR-2 / CLAUDE.md): `drawRound()` laeuft **genau einmal** beim Uebergang
 * BET → ARENA. ARENA liest nur, entscheidet nichts.
 */

import {
  MAX_BET,
  MIN_BET,
  MIN_PLAYERS,
  MODE_SPECS,
  type DurationPreset,
  type GameMode,
} from '@/config/rules';
import type { Bet, PlayerId } from './lottery';
import { createRoundSetup, type RoundSetup } from './session';

export const GAME_STATES = ['TITLE', 'LOBBY', 'PASS', 'BET', 'READY', 'ARENA', 'RESULT'] as const;
export type GameState = (typeof GAME_STATES)[number];

export type GameEvent =
  /** TITLE → LOBBY */
  | { type: 'start' }
  /** LOBBY → PASS(0), Guard: mind. 2 Spieler */
  | { type: 'begin' }
  /** PASS → BET */
  | { type: 'tap' }
  /** BET → PASS(i+1) oder, beim letzten Spieler, BET → READY */
  | { type: 'confirm'; sips: number }
  /** READY → ARENA (mit Ziehung) */
  | { type: 'startShow' }
  /** ARENA → RESULT */
  | { type: 'showFinished' }
  /** RESULT → PASS(0), im laufenden Turnier direkt RESULT → READY */
  | { type: 'nextRound' }
  /** RESULT → LOBBY */
  | { type: 'changePlayers' }
  /** PASS/BET/READY/ARENA → LOBBY (Back-Button / "Runde abbrechen?") */
  | { type: 'cancel' }
  /** Alles ausser TITLE → TITLE ("Hauptmenue"). Bricht auch ein laufendes Turnier ab. */
  | { type: 'quit' };

export type GameEventType = GameEvent['type'];

export interface FsmContext {
  /** Reihenfolge der Spieler in der Betting-Phase. */
  players: PlayerId[];
  /** Index des Spielers, der gerade dran ist (PASS/BET). */
  playerIndex: number;
  /** Bisher abgegebene Einsaetze der laufenden Runde. */
  bets: Bet[];
  /** Erst ab ARENA gesetzt — die Ziehung passiert beim Verlassen von READY. */
  round: RoundSetup | null;
  mode: GameMode;
  durationPreset: DurationPreset;
  /** Zaehlt abgeschlossene Runden der Session (fuer die HUD-Zeile "ROUND 3"). */
  roundNumber: number;
}

export interface Transition {
  from: GameState;
  to: GameState;
  event: GameEvent;
  context: Readonly<FsmContext>;
}

export interface StateHooks {
  enter?: (context: Readonly<FsmContext>, from: GameState) => void;
  exit?: (context: Readonly<FsmContext>, to: GameState) => void;
}

export interface FsmOptions {
  players?: PlayerId[];
  mode?: GameMode;
  durationPreset?: DurationPreset;
  /** Injizierbar fuer Tests; produktiv `createRoundSetup` (nutzt `pickVictim`). */
  drawRound?: (bets: readonly Bet[], mode: GameMode, duration: DurationPreset) => RoundSetup;
  /** M0: reines Logging. Ab M1 uebernimmt der Router. */
  onTransition?: (transition: Transition) => void;
}

export interface Fsm {
  readonly state: GameState;
  readonly context: Readonly<FsmContext>;
  /** Wieviele Ziehungen bisher stattfanden — Testhilfe fuer "genau einmal". */
  readonly drawCount: number;
  can(event: GameEventType): boolean;
  /** Fuehrt den Uebergang aus. Gibt `false` zurueck, wenn das Event hier nicht erlaubt ist. */
  send(event: GameEvent): boolean;
  setPlayers(players: PlayerId[]): void;
  setMode(mode: GameMode): void;
  setDuration(preset: DurationPreset): void;
  on(state: GameState, hooks: StateHooks): () => void;
  subscribe(listener: (transition: Transition) => void): () => void;
}

/** Welche Events sind in welchem State ueberhaupt zulaessig? */
const ALLOWED: Record<GameState, readonly GameEventType[]> = {
  TITLE: ['start'],
  LOBBY: ['begin', 'quit'],
  PASS: ['tap', 'cancel', 'quit'],
  BET: ['confirm', 'cancel', 'quit'],
  READY: ['startShow', 'cancel', 'quit'],
  ARENA: ['showFinished', 'cancel', 'quit'],
  RESULT: ['nextRound', 'changePlayers', 'quit'],
};

export function createFsm(options: FsmOptions = {}): Fsm {
  const drawRound = options.drawRound ?? createRoundSetup;

  const context: FsmContext = {
    players: options.players ? [...options.players] : [],
    playerIndex: 0,
    bets: [],
    round: null,
    mode: options.mode ?? 'classic',
    durationPreset: options.durationPreset ?? 'normal',
    roundNumber: 0,
  };

  let state: GameState = 'TITLE';
  let drawCount = 0;

  const hooks = new Map<GameState, Set<StateHooks>>();
  const listeners = new Set<(transition: Transition) => void>();
  if (options.onTransition) listeners.add(options.onTransition);

  const runExit = (to: GameState): void => {
    for (const hook of hooks.get(state) ?? []) hook.exit?.(context, to);
  };

  const runEnter = (from: GameState): void => {
    for (const hook of hooks.get(state) ?? []) hook.enter?.(context, from);
  };

  const resetRound = (): void => {
    context.playerIndex = 0;
    context.bets = [];
    context.round = null;
  };

  /**
   * Traegt die Runde die Einsaetze der vorigen weiter?
   *
   * In Sudden Death wird einmal gesetzt und danach Runde fuer Runde geschossen, bis einer
   * steht (ADR-56). Das haengt an `MODE_SPECS[...].eliminates`: Ein Modus, der ausscheiden
   * laesst, spielt ein Turnier — und ein Turnier setzt am Anfang, nicht vor jeder Runde.
   *
   * Die Bedingung beendet sich von selbst. Ist das Turnier entschieden, gibt
   * `activePlayers()` wieder alle zurueck (ADR-57); fuer die meisten davon gibt es keinen
   * Einsatz mehr, und es geht wie gewohnt in eine frische Setzphase.
   */
  const carriesStakes = (): boolean =>
    MODE_SPECS[context.mode].eliminates &&
    context.players.length >= MIN_PLAYERS &&
    context.players.every((id) => context.bets.some((bet) => bet.playerId === id));

  const transition = (to: GameState, event: GameEvent): void => {
    const from = state;
    runExit(to);
    state = to;
    runEnter(from);
    const payload: Transition = { from, to, event, context };
    for (const listener of [...listeners]) listener(payload);
  };

  /** Ermittelt das Ziel eines Events oder `null`, wenn der Guard nicht haelt. */
  const resolveTarget = (event: GameEvent): GameState | null => {
    switch (event.type) {
      case 'start':
        return 'LOBBY';

      case 'begin':
        return context.players.length >= MIN_PLAYERS ? 'PASS' : null;

      case 'tap':
        return 'BET';

      case 'confirm':
        return context.playerIndex < context.players.length - 1 ? 'PASS' : 'READY';

      case 'startShow':
        return 'ARENA';

      case 'showFinished':
        return 'RESULT';

      case 'nextRound':
        return carriesStakes() ? 'READY' : 'PASS';

      case 'changePlayers':
        return 'LOBBY';

      case 'cancel':
        return 'LOBBY';

      case 'quit':
        return 'TITLE';
    }
  };

  /** Seiteneffekte auf den Kontext — laufen vor dem eigentlichen Wechsel. */
  const applyEffects = (event: GameEvent, target: GameState): void => {
    switch (event.type) {
      case 'begin':
        // Neue Partie, neue Zaehlung — sonst zeigt das HUD "ROUND 7" in Runde 1.
        context.roundNumber = 0;
        resetRound();
        return;

      case 'nextRound':
        if (carriesStakes()) {
          // Die Ausgeschiedenen fallen aus der Ziehung; der Topf bleibt, wie er war.
          context.bets = context.bets.filter((bet) => context.players.includes(bet.playerId));
          context.playerIndex = 0;
          context.round = null;
          return;
        }
        resetRound();
        return;

      case 'confirm': {
        const playerId = context.players[context.playerIndex]!;
        context.bets.push({ playerId, sips: event.sips });
        if (target === 'PASS') context.playerIndex += 1;
        return;
      }

      /*
       * Hier faellt die Entscheidung — genau einmal, ausschliesslich in der FSM (ADR-2).
       *
       * Bis M5 hing die Ziehung am `confirm` des letzten Spielers. Seit der Start-Screen
       * dazwischensteht, haengt sie an dem Uebergang, der die Show wirklich startet: Wer
       * aus READY abbricht, hat nie gezogen (ADR-42).
       */
      case 'startShow':
        context.round = drawRound(context.bets, context.mode, context.durationPreset);
        drawCount += 1;
        return;

      case 'showFinished':
        context.roundNumber += 1;
        return;

      case 'cancel':
        resetRound();
        return;

      /*
       * Zurueck ans Lagerfeuer. Bis hierher gab es diesen Weg nicht — kein Event hatte
       * TITLE als Ziel, und wer einmal "Spielen" gedrueckt hatte, kam bis zum Neuladen
       * nicht mehr zurueck (ADR-58).
       */
      case 'quit':
        resetRound();
        context.roundNumber = 0;
        return;

      case 'start':
      case 'tap':
      case 'changePlayers':
        return;
    }
  };

  const fsm: Fsm = {
    get state() {
      return state;
    },
    get context() {
      return context;
    },
    get drawCount() {
      return drawCount;
    },

    can(eventType) {
      return ALLOWED[state].includes(eventType);
    },

    send(event) {
      if (!ALLOWED[state].includes(event.type)) return false;

      if (event.type === 'confirm') {
        if (!Number.isInteger(event.sips) || event.sips < MIN_BET || event.sips > MAX_BET) {
          throw new RangeError(`Ungueltiger Einsatz: ${event.sips} (erlaubt ${MIN_BET}..${MAX_BET}).`);
        }
      }

      const target = resolveTarget(event);
      if (target === null) return false;

      applyEffects(event, target);
      transition(target, event);
      return true;
    },

    setPlayers(players) {
      context.players = [...players];
      if (context.playerIndex >= context.players.length) context.playerIndex = 0;
    },

    setMode(mode) {
      context.mode = mode;
    },

    setDuration(preset) {
      context.durationPreset = preset;
    },

    on(target, stateHooks) {
      let set = hooks.get(target);
      if (!set) {
        set = new Set();
        hooks.set(target, set);
      }
      set.add(stateHooks);
      return () => {
        hooks.get(target)?.delete(stateHooks);
      };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return fsm;
}
