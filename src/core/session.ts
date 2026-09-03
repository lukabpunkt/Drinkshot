/**
 * Datenmodell der Session (Architektur §4) sowie Spieler-, Runden- und Scoreboard-Logik.
 *
 * Hier faellt **keine** Entscheidung darueber, wen es trifft — das macht ausschliesslich
 * `lottery.ts`. Dieses Modul rechnet nur aus, wer nach den Modus-Regeln (GDD §3.6) trinkt.
 */

import {
  DEFAULT_SETTINGS,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MAX_ROUND_HISTORY,
  MIN_PLAYERS,
  MODE_SPECS,
  STORAGE_KEY,
  type DurationPreset,
  type GameMode,
  type Settings,
} from '@/config/rules';
import { COLOR_IDS, type ColorId, type HatId } from '@/config/theme';
import { computeOdds, pickVictims, totalSips, type Bet, type PlayerId } from './lottery';
import { createSeed } from './rng';
import { createStore, type Unsubscribe } from './store';

/** ID einer Todesanimation, z. B. `head_helmet_spin` (GDD §4.1). */
export type DeathId = string;

/** Trefferzone — bestimmt Icon und Text auf dem Result-Screen (GDD §4.1). */
export type DeathZone = 'head' | 'body' | 'leg' | 'butt' | 'miss' | 'miracle';

export const DEATH_ZONES: readonly DeathZone[] = ['head', 'body', 'leg', 'butt', 'miss', 'miracle'];

export interface Player {
  id: PlayerId;
  /** max. 12 Zeichen (GDD §3.1). */
  name: string;
  colorId: ColorId;
  /** Pro Runde neu gewuerfelt (ab M2). */
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
  zone: DeathZone;
  mode: GameMode;
  durationPreset: DurationPreset;
}

export interface Drinker {
  playerId: PlayerId;
  sips: number;
}

export interface RoundResult extends RoundSetup {
  drinkers: Drinker[];
  odds: Record<PlayerId, number>;
  finishedAt: number;
  /** Sudden Death: wer durch diese Runde ausgeschieden ist. */
  eliminatedIds: PlayerId[];
  /** Sudden Death: gesetzt, wenn danach nur noch eine Person uebrig ist. */
  winnerId?: PlayerId;
  /** Sudden Death: was der Letzte zu verteilen hat (Summe aller Einsaetze der Runde). */
  sipsToDistribute?: number;
}

export interface Session {
  players: Player[];
  rounds: RoundResult[];
  settings: Settings;
}

/** Platzhalter, bis die Death-Registry in M3/M4 existiert. */
export const PLACEHOLDER_DEATH_ID: DeathId = 'basic_fall';
export const PLACEHOLDER_DEATH_ZONE: DeathZone = 'body';

export function createEmptySession(): Session {
  return { players: [], rounds: [], settings: { ...DEFAULT_SETTINGS } };
}

/* ------------------------------------------------------------------ */
/* Runden-Erzeugung                                                    */
/* ------------------------------------------------------------------ */

/**
 * Erzeugt das RoundSetup fuer den Uebergang BET → ARENA.
 * Ruft `pickVictims` (und damit `crypto.getRandomValues`) genau einmal auf.
 */
export function createRoundSetup(
  bets: readonly Bet[],
  mode: GameMode,
  durationPreset: DurationPreset,
  deathId: DeathId = PLACEHOLDER_DEATH_ID,
  zone: DeathZone = PLACEHOLDER_DEATH_ZONE
): RoundSetup {
  const victims = pickVictims(bets, MODE_SPECS[mode].victims);
  return {
    seed: createSeed(),
    bets: bets.map((bet) => ({ ...bet })),
    victimId: victims[0]!,
    extraVictimIds: victims.slice(1),
    deathId,
    zone,
    mode,
    durationPreset,
  };
}

/** Chancen-Tabelle fuer den Result-Screen. */
export function roundOdds(setup: RoundSetup): Record<PlayerId, number> {
  return computeOdds(setup.bets);
}

function betOf(setup: RoundSetup, playerId: PlayerId): number {
  return setup.bets.find((bet) => bet.playerId === playerId)?.sips ?? 0;
}

/* ------------------------------------------------------------------ */
/* Modus-Logik: wer trinkt? (GDD §3.6)                                 */
/* ------------------------------------------------------------------ */

/**
 * Rechnet aus dem RoundSetup die Trinkenden aus.
 *
 * | Modus        | Wer trinkt                                                            |
 * |--------------|------------------------------------------------------------------------|
 * | classic      | das Opfer, seinen eigenen Einsatz                                      |
 * | distributor  | alle ausser dem Opfer, jeweils den Einsatz des Opfers                  |
 * | suddenDeath  | wie classic; das Opfer scheidet aus, der Letzte verteilt               |
 * | doubleTap    | beide Opfer, jeweils ihren eigenen Einsatz                             |
 *
 * Bei einer Miracle-Runde (`zone === 'miracle'`) trinkt niemand — ausser im Modus
 * "Verteiler", da trinken alle genau 1 (GDD §4.1).
 */
export function resolveRound(setup: RoundSetup, finishedAt = Date.now()): RoundResult {
  const base = {
    ...setup,
    bets: setup.bets.map((bet) => ({ ...bet })),
    extraVictimIds: [...setup.extraVictimIds],
    odds: computeOdds(setup.bets),
    finishedAt,
  };

  if (setup.zone === 'miracle') {
    const drinkers: Drinker[] =
      setup.mode === 'distributor' ? setup.bets.map((bet) => ({ playerId: bet.playerId, sips: 1 })) : [];
    return { ...base, drinkers, eliminatedIds: [] };
  }

  const victimBet = betOf(setup, setup.victimId);

  switch (setup.mode) {
    case 'classic':
      return { ...base, drinkers: [{ playerId: setup.victimId, sips: victimBet }], eliminatedIds: [] };

    case 'distributor':
      return {
        ...base,
        drinkers: setup.bets
          .filter((bet) => bet.playerId !== setup.victimId)
          .map((bet) => ({ playerId: bet.playerId, sips: victimBet })),
        eliminatedIds: [],
      };

    case 'doubleTap': {
      const victims = [setup.victimId, ...setup.extraVictimIds];
      return {
        ...base,
        drinkers: victims.map((playerId) => ({ playerId, sips: betOf(setup, playerId) })),
        eliminatedIds: [],
      };
    }

    case 'suddenDeath': {
      const survivors = setup.bets
        .map((bet) => bet.playerId)
        .filter((playerId) => playerId !== setup.victimId);
      const result: RoundResult = {
        ...base,
        drinkers: [{ playerId: setup.victimId, sips: victimBet }],
        eliminatedIds: [setup.victimId],
      };
      if (survivors.length === 1) {
        result.winnerId = survivors[0]!;
        result.sipsToDistribute = totalSips(setup.bets);
      }
      return result;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Scoreboard & Ausscheiden                                            */
/* ------------------------------------------------------------------ */

/** Summe der getrunkenen Schluecke je Spieler ueber die ganze Session. */
export function scoreboard(session: Session): Record<PlayerId, number> {
  const totals: Record<PlayerId, number> = {};
  for (const player of session.players) totals[player.id] = 0;
  for (const round of session.rounds) {
    for (const drinker of round.drinkers) {
      totals[drinker.playerId] = (totals[drinker.playerId] ?? 0) + drinker.sips;
    }
  }
  return totals;
}

/** Im Modus "Sudden Death" ausgeschiedene Spieler — aus der Runden-History abgeleitet. */
export function eliminatedPlayerIds(session: Session): Set<PlayerId> {
  const out = new Set<PlayerId>();
  for (const round of session.rounds) {
    for (const id of round.eliminatedIds) out.add(id);
  }
  return out;
}

/** Spieler, die in der naechsten Runde antreten. */
export function activePlayers(session: Session): Player[] {
  const eliminated = eliminatedPlayerIds(session);
  return session.players.filter((player) => !eliminated.has(player.id));
}

/* ------------------------------------------------------------------ */
/* Persistenz (localStorage)                                           */
/* ------------------------------------------------------------------ */

function sanitizePlayers(raw: unknown): Player[] {
  if (!Array.isArray(raw)) return [];
  const players: Player[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const candidate = entry as Partial<Player>;
    if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') continue;
    if (!COLOR_IDS.includes(candidate.colorId as ColorId)) continue;
    players.push({
      id: candidate.id,
      name: candidate.name.slice(0, MAX_NAME_LENGTH),
      colorId: candidate.colorId as ColorId,
    });
    if (players.length === MAX_PLAYERS) break;
  }
  return players;
}

export function loadSession(storage: Storage | undefined = globalThis.localStorage): Session {
  const fallback = createEmptySession();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Session>;
    return {
      players: sanitizePlayers(parsed.players),
      rounds: Array.isArray(parsed.rounds) ? parsed.rounds.slice(-MAX_ROUND_HISTORY) : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return fallback;
  }
}

export function saveSession(
  session: Session,
  storage: Storage | undefined = globalThis.localStorage
): void {
  if (!storage) return;
  try {
    const trimmed: Session = { ...session, rounds: session.rounds.slice(-MAX_ROUND_HISTORY) };
    storage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Privater Modus / Quota — Persistenz ist ein Komfort-Feature, kein Muss.
  }
}

/* ------------------------------------------------------------------ */
/* SessionStore — der Zustand, den die Screens teilen                  */
/* ------------------------------------------------------------------ */

export interface SessionStore {
  readonly state: Readonly<Session>;
  subscribe(listener: (session: Readonly<Session>) => void): Unsubscribe;

  /** Naechste freie Farbe, Default-Name. Gibt `null` zurueck, wenn 8 erreicht sind. */
  addPlayer(nameFor: (index: number) => string): Player | null;
  removePlayer(id: PlayerId): void;
  renamePlayer(id: PlayerId, name: string): void;
  /** Fuellt bis `MIN_PLAYERS` auf — beim ersten Start der App. */
  ensureMinimumPlayers(nameFor: (index: number) => string): void;

  setSettings(patch: Partial<Settings>): void;
  recordRound(result: RoundResult): void;

  activePlayers(): Player[];
  scoreboard(): Record<PlayerId, number>;
  playerById(id: PlayerId): Player | undefined;
  canStart(): boolean;

  /** Runden und Ausscheiden zuruecksetzen; Spieler und Settings bleiben. */
  resetRounds(): void;
  /** Alles zurueck auf Werkszustand. */
  reset(): void;
}

let playerCounter = 0;

function nextPlayerId(): PlayerId {
  playerCounter += 1;
  return `p${Date.now().toString(36)}${playerCounter.toString(36)}`;
}

export function createSessionStore(
  initial: Session = loadSession(),
  storage: Storage | undefined = globalThis.localStorage
): SessionStore {
  const store = createStore<Session>(initial);

  const persist = (): void => saveSession(store.get(), storage);

  const commit = (patch: Partial<Session>): void => {
    store.set(patch);
    persist();
  };

  const usedColors = (): Set<ColorId> => new Set(store.get().players.map((player) => player.colorId));

  const api: SessionStore = {
    get state() {
      return store.get();
    },

    subscribe(listener) {
      return store.subscribe((session) => listener(session));
    },

    addPlayer(nameFor) {
      const players = store.get().players;
      if (players.length >= MAX_PLAYERS) return null;
      const taken = usedColors();
      const colorId = COLOR_IDS.find((id) => !taken.has(id)) ?? COLOR_IDS[0]!;
      const player: Player = {
        id: nextPlayerId(),
        name: nameFor(players.length + 1),
        colorId,
      };
      commit({ players: [...players, player] });
      return player;
    },

    removePlayer(id) {
      const players = store.get().players.filter((player) => player.id !== id);
      commit({ players });
    },

    renamePlayer(id, name) {
      const trimmed = name.slice(0, MAX_NAME_LENGTH);
      const players = store
        .get()
        .players.map((player) => (player.id === id ? { ...player, name: trimmed } : player));
      commit({ players });
    },

    ensureMinimumPlayers(nameFor) {
      while (store.get().players.length < MIN_PLAYERS) {
        if (api.addPlayer(nameFor) === null) break;
      }
    },

    setSettings(patch) {
      commit({ settings: { ...store.get().settings, ...patch } });
    },

    recordRound(result) {
      commit({ rounds: [...store.get().rounds, result].slice(-MAX_ROUND_HISTORY) });
    },

    activePlayers() {
      return activePlayers(store.get());
    },

    scoreboard() {
      return scoreboard(store.get());
    },

    playerById(id) {
      return store.get().players.find((player) => player.id === id);
    },

    canStart() {
      return activePlayers(store.get()).length >= MIN_PLAYERS;
    },

    resetRounds() {
      commit({ rounds: [] });
    },

    reset() {
      store.replace(createEmptySession());
      persist();
    },
  };

  return api;
}
