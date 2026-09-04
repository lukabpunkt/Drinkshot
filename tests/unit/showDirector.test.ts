/**
 * ShowDirector (Architektur §5).
 *
 * Bis hierher gab es **keinen** Test für den Director — er wurde nur vom ArenaScreen
 * gebaut, und dessen E2E-Tests prüfen das Ergebnis, nicht die Regie. Genau deshalb ist
 * monatelang unbemerkt geblieben, dass der zweite Double-Tap-Lock das Fadenkreuz auf das
 * bereits tote erste Opfer zurückfuhr.
 *
 * Getestet wird gegen Attrappen: Scope, Kamera, Arena und Partikel sind reine
 * Aufzeichnungsobjekte. Was zählt, ist **worauf** der Director zeigt und **wann** —
 * nicht, wie es aussieht.
 */

import gsap from 'gsap';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildShowScript } from '@/core/choreographer';
import { createSeededRng } from '@/core/rng';
import type { PlayerId } from '@/core/lottery';
import { ShowDirector } from '@/game/ShowDirector';

vi.mock('@/audio/AudioManager', () => ({
  play: vi.fn(),
  startHeartbeat: vi.fn(),
  setHeartbeatBpm: vi.fn(),
  stopHeartbeat: vi.fn(),
  duckMusic: vi.fn(),
  unduckMusic: vi.fn(),
  suspendAudio: vi.fn(),
  resumeAudio: vi.fn(),
}));

/** Merkt sich, worauf gezielt wurde — das ist die eigentliche Aussage der Show. */
interface AimLog {
  targets: { x: number; y: number }[];
  locks: number;
  releases: number;
}

function makeScope(log: AimLog): Record<string, unknown> {
  return {
    centerX: 0,
    centerY: 0,
    aimAt: (target: { x: number; y: number }) => {
      log.targets.push({ x: target.x, y: target.y });
      return gsap.to({}, { duration: 0 });
    },
    snapTo: (target: { x: number; y: number }) => log.targets.push({ x: target.x, y: target.y }),
    lock: () => {
      log.locks += 1;
      return gsap.timeline();
    },
    fakeLock: () => gsap.timeline(),
    flash: () => gsap.timeline(),
    release: () => {
      log.releases += 1;
    },
    applyGlassSplit: () => Promise.resolve(),
  };
}

function makeCamera(): Record<string, unknown> {
  return {
    timeScale: 1,
    zoomIn: () => gsap.to({}, { duration: 0 }),
    zoomOut: () => gsap.to({}, { duration: 0 }),
    parallaxNudge: () => gsap.to({}, { duration: 0 }),
    shakeScreen: () => gsap.to({}, { duration: 0 }),
    afterShock: () => gsap.to({}, { duration: 0 }),
    slowMotion: () => gsap.to({}, { duration: 0 }),
    resetTime: () => undefined,
    reset: () => undefined,
  };
}

/**
 * Ein Männchen als Attrappe. `aimPoint` ist pro Spieler eindeutig, damit sich aus dem
 * Aim-Protokoll ablesen lässt, **wer** im Fadenkreuz hing.
 */
function makeShotling(index: number): Record<string, unknown> {
  let state = 'walk';
  let driven = false;
  return {
    aimPoint: { x: index * 100, y: index * 100 },
    brain: {
      x: index * 100,
      y: index * 100,
      speedMultiplier: 1,
      stop: () => undefined,
      burst: () => undefined,
    },
    getState: () => state,
    setState: (next: string) => {
      state = next;
    },
    get isDead() {
      return state === 'dead';
    },
    isDriven: () => driven,
    setDriven: (value: boolean) => {
      driven = value;
    },
    resetHead: () => undefined,
    lookAt: () => undefined,
  };
}

function makeDirector(options: { players: PlayerId[]; victimId: PlayerId; extra?: PlayerId[] }) {
  const log: AimLog = { targets: [], locks: 0, releases: 0 };
  const shotlings = new Map<PlayerId, unknown>();
  options.players.forEach((id, index) => shotlings.set(id, makeShotling(index + 1)));

  const script = buildShowScript({
    players: options.players,
    victimId: options.victimId,
    seed: 7,
    durationPreset: 'normal',
    deathId: 'basic_fall',
    ...(options.extra
      ? { extraVictims: options.extra.map((victimId) => ({ victimId, deathId: 'basic_fall' })) }
      : {}),
  });

  const shots: { index: number; total: number; final: boolean }[] = [];
  let finished = 0;

  const director = new ShowDirector({
    script,
    scope: makeScope(log),
    camera: makeCamera(),
    arena: { actorLayer: {} },
    particles: {},
    rng: createSeededRng(1),
    shotlings,
    onFinished: () => {
      finished += 1;
    },
    onShotFired: (info: { index: number; total: number; final: boolean }) => shots.push(info),
  } as never);

  return { director, script, log, shots, shotlings, finished: () => finished };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ShowDirector — Lock zielt auf den Beat', () => {
  it('lockt beim einzelnen Opfer auf dieses', () => {
    const { director, log, script, shotlings } = makeDirector({
      players: ['p1', 'p2', 'p3'],
      victimId: 'p2',
    });
    const lock = script.beats.find((beat) => beat.type === 'lock');
    expect(lock?.type === 'lock' && lock.target).toBe('p2');

    director.play();
    // Durchspulen statt `skipToEnd()`: Das unterdrückt die Callbacks absichtlich.
    seekTo(director, script.totalMs);

    expect(log.locks).toBe(1);
    const expected = (shotlings.get('p2') as { aimPoint: { x: number } }).aimPoint;
    expect(log.targets.at(-1)?.x).toBe(expected.x);
    director.destroy();
  });

  it('der zweite Lock geht aufs zweite Opfer, nicht auf das erste (Double Tap)', () => {
    const { director, script, log, shotlings } = makeDirector({
      players: ['p1', 'p2', 'p3', 'p4'],
      victimId: 'p2',
      extra: ['p4'],
    });

    const locks = script.beats.filter((beat) => beat.type === 'lock');
    expect(locks).toHaveLength(2);
    expect(locks.map((beat) => (beat.type === 'lock' ? beat.target : ''))).toEqual(['p2', 'p4']);

    director.play();
    seekTo(director, locks[1]!.t + 10);

    /*
     * Der eigentliche Beleg: Wo landet das Fadenkreuz beim zweiten Lock? Vorher las der
     * Director `options.victimId` — es fuhr auf p2 zurück, also auf die Leiche.
     */
    const expected = (shotlings.get('p4') as { aimPoint: { x: number } }).aimPoint;
    expect(log.targets.at(-1)?.x).toBe(expected.x);

    const firstVictim = (shotlings.get('p2') as { aimPoint: { x: number } }).aimPoint;
    expect(log.targets.at(-1)?.x).not.toBe(firstVictim.x);
    director.destroy();
  });
});

describe('ShowDirector — Schuss-Kontext', () => {
  it('meldet den einzigen Schuss als den letzten', () => {
    const { director, script, shots } = makeDirector({ players: ['p1', 'p2'], victimId: 'p1' });
    director.play();
    seekTo(director, script.totalMs);
    expect(shots).toEqual([{ index: 1, total: 1, final: true }]);
    director.destroy();
  });

  it('markiert bei zwei Schüssen nur den zweiten als final', () => {
    const { director, script, shots } = makeDirector({
      players: ['p1', 'p2', 'p3'],
      victimId: 'p1',
      extra: ['p3'],
    });
    director.play();
    // Bis kurz hinter den zweiten Schuss spulen, dann steht beides im Protokoll.
    const lastShot = [...script.beats].reverse().find((beat) => beat.type === 'shot')!;
    seekTo(director, lastShot.t + 10);

    expect(shots.map((info) => info.final)).toEqual([false, true]);
    expect(shots.at(-1)).toEqual({ index: 2, total: 2, final: true });
    director.destroy();
  });
});

describe('ShowDirector — laufende Todesanimationen', () => {
  it('weckt kein Männchen auf, dessen Sequenz noch läuft', () => {
    const { director, script, shotlings } = makeDirector({
      players: ['p1', 'p2', 'p3', 'p4'],
      victimId: 'p2',
      extra: ['p4'],
    });

    /*
     * Eine Sequenz setzt `dead` erst an ihrem Ende — bis dahin ist das Opfer nur
     * `isDriven()`. Ohne den Guard bekäme es beim nächsten Zielwechsel `panic` und liefe
     * los, während GSAP sein Rig animiert.
     */
    const victim = shotlings.get('p2') as {
      setDriven: (value: boolean) => void;
      setState: (next: string) => void;
      getState: () => string;
    };
    victim.setState('aimed');
    victim.setDriven(true);

    director.play();
    seekTo(director, script.totalMs);

    expect(victim.getState()).not.toBe('panic');
    director.destroy();
  });

  it('skipToEnd baut keine weiteren Sequenzen mehr', () => {
    const { director, script, shots } = makeDirector({
      players: ['p1', 'p2', 'p3', 'p4'],
      victimId: 'p2',
      extra: ['p4'],
    });
    director.play();

    // Direkt nach dem ersten Schuss überspringen.
    const firstShot = script.beats.find((beat) => beat.type === 'shot')!;
    seekTo(director, firstShot.t + 10);
    expect(shots).toHaveLength(1);

    director.skipToEnd();
    // Der übersprungene zweite Schuss feuert seinen Callback nicht nach.
    expect(shots).toHaveLength(1);
    director.destroy();
  });
});

/** Spult die Show auf einen Zeitpunkt in ms. */
function seekTo(director: ShowDirector, ms: number): void {
  const timeline = (director as unknown as { timeline: gsap.core.Timeline }).timeline;
  timeline.time(ms / 1000);
}
