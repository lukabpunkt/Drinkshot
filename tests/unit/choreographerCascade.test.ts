/**
 * Die Showdown-Kaskade (GDD §3.6, Roadmap M5b).
 *
 * In einer Runde fallen n−1 Schüsse. Die Fairness-Zusicherung aus §3.5 gilt weiterhin,
 * aber sie muss **pro Segment** formuliert werden: `victimDwellShare` über das ganze
 * Skript wäre bedeutungslos, wenn fast jeder ein Opfer ist.
 *
 * Der schärfste Test ist T3. Würde jemand die Nicht-Opfer wieder global rechnen, wäre bei
 * n−1 Opfern genau **ein** Nicht-Opfer übrig — der letzte Fake-Lock jedes Segments ginge
 * dann immer auf den Gewinner und verriete ihn. T3 bricht in dem Moment.
 */

import { describe, expect, it } from 'vitest';
import { CASCADE, CHOREO } from '@/config/choreo';
import { DURATION_PRESETS, type DurationPreset } from '@/config/rules';
import type { PlayerId } from '@/core/lottery';
import {
  buildShowScript,
  dwellBeforeLockIn,
  segmentsOf,
  type Beat,
  type ShowScript,
} from '@/core/choreographer';

interface Cascade {
  script: ShowScript;
  players: PlayerId[];
  /** Erschiessungsreihenfolge. */
  order: PlayerId[];
  survivor: PlayerId;
}

/** Baut eine Kaskade, in der die Opfer per Seed rotieren. */
function makeCascade(playerCount: number, seed: number, preset: DurationPreset = 'normal'): Cascade {
  const players = Array.from({ length: playerCount }, (_, index) => `p${index + 1}`);

  // Reihenfolge deterministisch aus dem Seed mischen — sonst stirbt immer p1 zuerst.
  const pool = [...players];
  const order: PlayerId[] = [];
  let state = seed + 1;
  while (pool.length > 1) {
    state = (state * 1103515245 + 12345) >>> 0;
    order.push(pool.splice(state % pool.length, 1)[0]!);
  }
  const survivor = pool[0]!;

  const script = buildShowScript({
    players,
    victimId: order[0]!,
    seed,
    durationPreset: preset,
    deathId: 'basic_fall',
    cascade: order.slice(1).map((victimId) => ({ victimId, deathId: 'basic_fall' })),
  });

  return { script, players, order, survivor };
}

function shotTimes(script: ShowScript): number[] {
  return script.beats.filter((beat) => beat.type === 'shot').map((beat) => beat.t);
}

describe('Kaskade — Aufbau', () => {
  it('erschiesst genau n-1 Spieler, in der vorgegebenen Reihenfolge', () => {
    const { script, order } = makeCascade(6, 42);
    const deaths = script.beats.filter((beat) => beat.type === 'death');

    expect(deaths).toHaveLength(5);
    expect(deaths.map((beat) => (beat.type === 'death' ? beat.victim : ''))).toEqual(order);
  });

  it('hat ein Intro, ein Outro und je einen Lock pro Schuss', () => {
    const { script } = makeCascade(6, 7);
    expect(script.beats.filter((beat) => beat.type === 'intro')).toHaveLength(1);
    expect(script.beats.filter((beat) => beat.type === 'outro')).toHaveLength(1);
    expect(script.beats.filter((beat) => beat.type === 'lock')).toHaveLength(5);
    expect(script.beats.filter((beat) => beat.type === 'shot')).toHaveLength(5);
  });

  it('sammelt zwischen den Schüssen und nennt dabei die Überlebenden', () => {
    const { script, players, order } = makeCascade(5, 3);
    const regroups = script.beats.filter((beat) => beat.type === 'regroup');

    // Vier Schüsse, drei Pausen dazwischen.
    expect(regroups).toHaveLength(3);
    regroups.forEach((beat, index) => {
      if (beat.type !== 'regroup') return;
      const fallen = order.slice(0, index + 1);
      expect([...beat.survivors].sort()).toEqual(
        players.filter((player) => !fallen.includes(player)).sort()
      );
    });
  });

  it('zielt in jedem Segment nur auf die, die noch leben', () => {
    const { script, order, players } = makeCascade(6, 11);
    segmentsOf(script).forEach((beats, index) => {
      const fallen = order.slice(0, index);
      const alive = new Set(players.filter((player) => !fallen.includes(player)));
      for (const beat of beats) {
        if ('target' in beat) expect(alive.has(beat.target)).toBe(true);
      }
    });
  });

  it('das Outro steht am Ende', () => {
    const { script } = makeCascade(7, 5);
    expect(script.beats[script.beats.length - 1]?.type).toBe('outro');
  });
});

describe('Kaskade — Dramaturgie', () => {
  it('das Finale ist das längste Segment', () => {
    for (const players of [4, 6, 8]) {
      const { script } = makeCascade(players, 21);
      const lengths = segmentDurations(script);
      const finale = lengths[lengths.length - 1]!;
      for (const other of lengths.slice(0, -1)) expect(finale).toBeGreaterThan(other);
    }
  });

  it('die Montage wächst zum Finale hin', () => {
    const { script } = makeCascade(8, 99);
    // Segment 0 ist der Auftakt, das letzte das Finale — dazwischen die Montage.
    const montage = segmentDurations(script).slice(1, -1);
    for (let i = 1; i < montage.length; i++) {
      expect(montage[i]!).toBeGreaterThanOrEqual(montage[i - 1]!);
    }
  });

  it('nur Auftakt und Finale scannen; die Montage schneidet hart', () => {
    const { script } = makeCascade(6, 8);
    const segments = segmentsOf(script);

    const smoothIn = (beats: Beat[]): number =>
      beats.filter((beat) => beat.type === 'aim' && beat.style === 'smooth').length;

    expect(smoothIn(segments[0]!)).toBeGreaterThan(0);
    expect(smoothIn(segments[segments.length - 1]!)).toBeGreaterThan(0);
    for (const middle of segments.slice(1, -1)) expect(smoothIn(middle)).toBe(0);
  });

  it('bleibt in jedem Preset unter der Notbremse plus Toleranz', () => {
    for (const preset of DURATION_PRESETS) {
      for (const players of [4, 6, 8]) {
        const { script } = makeCascade(players, 1, preset);
        expect(script.totalMs).toBeLessThanOrEqual(CASCADE.maxTotalMs);
      }
    }
  });
});

describe('Kaskade — Fairness pro Segment', () => {
  /** T1: Das Opfer hängt vor seinem Lock nicht länger im Fadenkreuz als 1/r + 5 %. */
  it('das Segment-Opfer fällt nicht aus der Reihe', () => {
    for (let seed = 0; seed < 2000; seed++) {
      const { script, order } = makeCascade(6, seed);
      segmentsOf(script).forEach((beats, index) => {
        const dwell = dwellBeforeLockIn(beats);
        const total = Object.values(dwell).reduce((sum, value) => sum + value, 0);
        const targets = Object.keys(dwell).length;
        // Montage-Segmente haben ein bis zwei Beats — dort ist der Anteil quantisiert
        // und die Aussage bedeutungslos. Geprüft wird, wo wirklich gesucht wird.
        if (total === 0 || targets < 3) return;

        const share = (dwell[order[index]!] ?? 0) / total;
        expect(share).toBeLessThanOrEqual(1 / targets + 0.05);
      });
    }
  });

  /**
   * T2: Der Überlebende wird in keinem Segment anders behandelt als die anderen, die in
   * diesem Segment nicht sterben. Das ist die eigentliche Antwort auf „verrät die Show
   * den Gewinner".
   */
  it('der Überlebende ist von den anderen Nicht-Opfern nicht zu unterscheiden', () => {
    /*
     * Verglichen wird **innerhalb** eines Segments. Über Segmente hinweg gemittelt käme
     * ein Scheineffekt heraus: Der Überlebende ist in jedem Segment dabei, die anderen
     * fallen nach und nach weg — und je weniger übrig sind, desto grösser ist der Anteil
     * jedes Einzelnen. Der Überlebende wäre dann rechnerisch bevorzugt, ohne dass die
     * Show irgendetwas verrät.
     */
    let differenceSum = 0;
    let samples = 0;

    for (let seed = 0; seed < 4000; seed++) {
      const { script, order, survivor } = makeCascade(6, seed);
      segmentsOf(script).forEach((beats, index) => {
        const dwell = dwellBeforeLockIn(beats);
        const total = Object.values(dwell).reduce((sum, value) => sum + value, 0);
        // Im Finale stehen nur zwei: Wer nicht das Opfer ist, ist der Gewinner. Da gibt
        // es nichts zu verbergen.
        if (total === 0 || Object.keys(dwell).length < 3) return;

        const others: number[] = [];
        let survivorShare: number | undefined;
        for (const [id, ms] of Object.entries(dwell)) {
          if (id === order[index]) continue;
          if (id === survivor) survivorShare = ms / total;
          else others.push(ms / total);
        }
        if (survivorShare === undefined || others.length === 0) return;

        const otherMean = others.reduce((sum, value) => sum + value, 0) / others.length;
        differenceSum += survivorShare - otherMean;
        samples += 1;
      });
    }

    expect(samples).toBeGreaterThan(1000);
    // Der mittlere Unterschied muss um null liegen — in beide Richtungen.
    expect(Math.abs(differenceSum / samples)).toBeLessThan(0.01);
  });

  /**
   * T3: Der letzte Fake-Lock jedes Segments ist nie das Segment-Opfer — und er landet
   * **nicht systematisch** auf dem Überlebenden.
   */
  it('der letzte Fake verrät den Gewinner nicht', () => {
    let fakes = 0;
    let onSurvivor = 0;

    for (let seed = 0; seed < 3000; seed++) {
      const { script, order, survivor } = makeCascade(6, seed);
      segmentsOf(script).forEach((beats, index) => {
        const lockIndex = beats.findIndex((beat) => beat.type === 'lock');
        if (lockIndex <= 0) return;
        const before = beats[lockIndex - 1];
        if (!before || before.type !== 'fakeLock') return;

        // Harte Regel: nie das Opfer dieses Segments.
        expect(before.target).not.toBe(order[index]);

        fakes += 1;
        if (before.target === survivor) onSurvivor += 1;
      });
    }

    expect(fakes).toBeGreaterThan(100);
    /*
     * Im Auftakt gibt es fünf Nicht-Opfer, im Finale nur eines (dort ist die Rate
     * zwangsläufig 1). Über alle Segmente gemittelt muss der Anteil deutlich unter 1
     * liegen — global gerechnete Nicht-Opfer ergäben exakt 1,0.
     */
    expect(onSurvivor / fakes).toBeLessThan(0.75);
  });

  /**
   * T4: Wann die Schüsse fallen, darf nur von Spielerzahl, Schusszahl und Preset
   * abhängen — nie davon, **wen** es trifft. Sonst lernt man „Schuss 3 kommt spät, also
   * bin ich dran".
   */
  it('die Schusszeiten verraten nicht, wen es trifft', () => {
    const players = ['p1', 'p2', 'p3', 'p4', 'p5'];
    const reference = shotTimes(
      buildShowScript({
        players,
        victimId: 'p1',
        seed: 1234,
        durationPreset: 'normal',
        deathId: 'basic_fall',
        cascade: [
          { victimId: 'p2', deathId: 'basic_fall' },
          { victimId: 'p3', deathId: 'basic_fall' },
          { victimId: 'p4', deathId: 'basic_fall' },
        ],
      })
    );

    // Dieselbe Runde, andere Opferreihenfolge: Die Zeiten müssen gleich bleiben.
    const permutations: PlayerId[][] = [
      ['p5', 'p4', 'p3', 'p2'],
      ['p3', 'p1', 'p5', 'p4'],
      ['p2', 'p5', 'p1', 'p3'],
      ['p4', 'p3', 'p2', 'p5'],
    ];

    for (const order of permutations) {
      const times = shotTimes(
        buildShowScript({
          players,
          victimId: order[0]!,
          seed: 1234,
          durationPreset: 'normal',
          deathId: 'basic_fall',
          cascade: order.slice(1).map((victimId) => ({ victimId, deathId: 'basic_fall' })),
        })
      );
      expect(times).toEqual(reference);
    }
  });

  /** T5: Kein Beat ist so kurz, dass man ihn nicht mehr sieht. */
  it('jeder Lock schliesst sichtbar, jeder Wechsel ist erkennbar', () => {
    for (const preset of DURATION_PRESETS) {
      for (const players of [3, 5, 8]) {
        const { script } = makeCascade(players, 17, preset);
        for (const beat of script.beats) {
          if (beat.type === 'lock') expect(beat.holdMs).toBeGreaterThanOrEqual(CHOREO.lockClampMs);
          if (beat.type === 'aim' || beat.type === 'fakeLock') {
            expect(beat.holdMs).toBeGreaterThanOrEqual(Math.round(CHOREO.hopMs[0] * 0.6));
          }
        }
      }
    }
  });
});

describe('Kaskade — Zurückweisungen', () => {
  const base = {
    players: ['p1', 'p2', 'p3'],
    victimId: 'p1',
    seed: 1,
    durationPreset: 'normal' as const,
    deathId: 'basic_fall',
  };

  it('weist cascade und extraVictims gleichzeitig zurück', () => {
    expect(() =>
      buildShowScript({
        ...base,
        extraVictims: [{ victimId: 'p2', deathId: 'basic_fall' }],
        cascade: [{ victimId: 'p3', deathId: 'basic_fall' }],
      })
    ).toThrow(RangeError);
  });

  it('weist doppelte Opfer zurück', () => {
    expect(() =>
      buildShowScript({ ...base, cascade: [{ victimId: 'p1', deathId: 'basic_fall' }] })
    ).toThrow(RangeError);
  });

  it('weist eine Kaskade zurück, die niemanden übrig lässt', () => {
    expect(() =>
      buildShowScript({
        ...base,
        cascade: [
          { victimId: 'p2', deathId: 'basic_fall' },
          { victimId: 'p3', deathId: 'basic_fall' },
        ],
      })
    ).toThrow(RangeError);
  });
});

/** Länge jedes Segments in ms, abgeleitet aus den Beat-Zeiten. */
function segmentDurations(script: ShowScript): number[] {
  const segments = segmentsOf(script);
  return segments.map((beats) => {
    const first = beats[0]?.t ?? 0;
    const last = beats[beats.length - 1]?.t ?? first;
    return last - first;
  });
}
