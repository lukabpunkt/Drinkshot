/**
 * Choreographer-Tests (Architektur §5, Audit A3).
 *
 * Der wichtigste Test ist die Fairness: Wenn das Opfer vor dem Lock länger im Fadenkreuz
 * hängt als die anderen, lernen die Spieler nach ein paar Runden das Muster — und die
 * ganze Spannung ist weg, obwohl die Ziehung selbst sauber ist.
 */

import { describe, expect, it } from 'vitest';
import { CHOREO, CHOREO_FAIRNESS } from '@/config/choreo';
import { DURATION_MS, DURATION_PRESETS, type DurationPreset } from '@/config/rules';
import {
  buildShowScript,
  dwellBeforeLock,
  targetedBeats,
  victimDwellShare,
  type ShowScript,
} from '@/core/choreographer';

const SEEDS = 10_000;

function players(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `p${i + 1}`);
}

function build(
  n: number,
  seed: number,
  durationPreset: DurationPreset = 'normal',
  victimIndex = 0
): ShowScript {
  const list = players(n);
  return buildShowScript({
    players: list,
    victimId: list[victimIndex]!,
    seed,
    durationPreset,
    deathId: 'basic_fall',
  });
}

describe('Choreographer — Struktur', () => {
  it('beginnt mit intro und endet mit outro', () => {
    const script = build(4, 1);
    expect(script.beats[0]?.type).toBe('intro');
    expect(script.beats[script.beats.length - 1]?.type).toBe('outro');
  });

  it('enthält genau einen Lock, einen Schuss und einen Tod', () => {
    const script = build(5, 7);
    const count = (type: string): number => script.beats.filter((b) => b.type === type).length;
    expect(count('lock')).toBe(1);
    expect(count('shot')).toBe(1);
    expect(count('death')).toBe(1);
    expect(count('intro')).toBe(1);
    expect(count('outro')).toBe(1);
  });

  it('lockt ausschliesslich auf das Opfer', () => {
    for (let seed = 0; seed < 500; seed++) {
      const script = build(6, seed, 'normal', seed % 6);
      const lock = script.beats.find((b) => b.type === 'lock');
      expect(lock?.type === 'lock' && lock.target).toBe(`p${(seed % 6) + 1}`);
    }
  });

  it('hat aufsteigende Zeitstempel', () => {
    for (let seed = 0; seed < 200; seed++) {
      const script = build(4, seed);
      let previous = -1;
      for (const beat of script.beats) {
        expect(beat.t).toBeGreaterThanOrEqual(previous);
        previous = beat.t;
      }
    }
  });

  it('visiert im Scan jeden Spieler genau einmal an', () => {
    const list = players(6);
    const script = buildShowScript({
      players: list,
      victimId: 'p3',
      seed: 42,
      durationPreset: 'normal',
      deathId: 'basic_fall',
    });
    // Der Scan sind die ersten `n` aim-Beats mit Stil "smooth".
    const scan = script.beats.filter((b) => b.type === 'aim' && b.style === 'smooth');
    expect(scan).toHaveLength(6);
    expect(new Set(scan.map((b) => (b.type === 'aim' ? b.target : ''))).size).toBe(6);
  });

  it('setzt Schuss und Tod auf denselben Zeitpunkt', () => {
    const script = build(4, 11);
    const shot = script.beats.find((b) => b.type === 'shot');
    const death = script.beats.find((b) => b.type === 'death');
    expect(shot?.t).toBe(death?.t);
  });

  it('reicht die DeathId durch', () => {
    const list = players(3);
    const script = buildShowScript({
      players: list,
      victimId: 'p1',
      seed: 5,
      durationPreset: 'short',
      deathId: 'head_xray',
    });
    const death = script.beats.find((b) => b.type === 'death');
    expect(death?.type === 'death' && death.deathId).toBe('head_xray');
  });

  it('weist unsinnige Eingaben zurück', () => {
    expect(() =>
      buildShowScript({
        players: [],
        victimId: 'p1',
        seed: 1,
        durationPreset: 'normal',
        deathId: 'x',
      })
    ).toThrow(RangeError);

    expect(() =>
      buildShowScript({
        players: ['p1', 'p2'],
        victimId: 'p9',
        seed: 1,
        durationPreset: 'normal',
        deathId: 'x',
      })
    ).toThrow(RangeError);
  });
});

describe('Choreographer — Dauer-Presets (Audit A3: 10/15/22 s ± 1 s)', () => {
  it.each(DURATION_PRESETS)('%s trifft die Soll-Dauer', (preset) => {
    for (let seed = 0; seed < 300; seed++) {
      const script = build(5, seed, preset);
      expect(Math.abs(script.totalMs - DURATION_MS[preset])).toBeLessThanOrEqual(1000);
    }
  });

  it('der letzte Beat liegt auf der Gesamtdauer', () => {
    for (const preset of DURATION_PRESETS) {
      const script = build(4, 3, preset);
      expect(script.beats[script.beats.length - 1]?.t).toBe(script.totalMs);
    }
  });

  it('gilt für 2 bis 8 Spieler', () => {
    for (let n = 2; n <= 8; n++) {
      for (const preset of DURATION_PRESETS) {
        const script = build(n, n * 13, preset);
        expect(Math.abs(script.totalMs - DURATION_MS[preset])).toBeLessThanOrEqual(1000);
      }
    }
  });
});

describe(`Choreographer — Fairness über ${SEEDS.toLocaleString('de-DE')} Seeds`, () => {
  it.each([2, 3, 4, 5, 6, 7, 8])(
    'bei %i Spielern bleibt der Opfer-Anteil ≤ 1/n + 5 %%',
    (n) => {
      const limit = 1 / n + CHOREO_FAIRNESS.victimShareTolerance;
      let worst = 0;
      let worstSeed = -1;

      for (let seed = 0; seed < SEEDS; seed++) {
        const script = build(n, seed, 'normal', seed % n);
        const share = victimDwellShare(script, `p${(seed % n) + 1}`);
        if (share > worst) {
          worst = share;
          worstSeed = seed;
        }
      }

      expect(worst, `schlimmster Seed ${worstSeed}: ${(worst * 100).toFixed(2)} %`).toBeLessThanOrEqual(
        limit
      );
    }
  );

  /**
   * Das GDD formuliert die Regel **statistisch**: „Die Reticle-Verweilzeit auf jedem
   * Spieler muss bis zum Lock ± gleich sein." Einzelne Runden dürfen und sollen
   * schwanken — ein Fake-Lock von knapp einer Sekunde verschiebt die Bilanz kräftig, und
   * genau diese Unregelmässigkeit macht die Show unvorhersehbar. Im Mittel muss die
   * Verweilzeit des Opfers aber auf der der anderen liegen: **in beide Richtungen**.
   * Systematisch *weniger* Aufmerksamkeit wäre genauso ein Muster wie mehr.
   */
  it.each([2, 4, 6, 8])('bei %i Spielern liegt die Opfer-Verweilzeit im Mittel bei 1/n', (n) => {
    let victimSum = 0;
    let othersSum = 0;
    let othersCount = 0;
    const seeds = 5000;

    for (let seed = 0; seed < seeds; seed++) {
      const victimIndex = seed % n;
      const script = build(n, seed, 'normal', victimIndex);
      const victimId = `p${victimIndex + 1}`;
      const dwell = dwellBeforeLock(script);

      victimSum += dwell[victimId] ?? 0;
      for (const [id, value] of Object.entries(dwell)) {
        if (id === victimId) continue;
        othersSum += value;
        othersCount++;
      }
    }

    const victimMean = victimSum / seeds;
    const othersMean = othersSum / othersCount;
    const deviation = Math.abs(victimMean - othersMean) / othersMean;

    expect(
      deviation,
      `Opfer ${victimMean.toFixed(0)} ms vs. andere ${othersMean.toFixed(0)} ms ` +
        `(${(deviation * 100).toFixed(1)} % Abweichung)`
    ).toBeLessThan(0.12);
  });
});

describe('Choreographer — Anti-Vorhersagbarkeit', () => {
  /**
   * GDD §3.5 verlangt nur für den **letzten** Fake ein Nicht-Opfer (maximale Fallhöhe).
   * Frühere Fakes dürfen — und sollen — das Opfer treffen, sonst hinge es systematisch
   * kürzer im Fadenkreuz (ADR-19).
   */
  it('der letzte Fake-Lock ist nie das Opfer', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const n = 2 + (seed % 7);
      const victimIndex = seed % n;
      const script = build(n, seed, 'normal', victimIndex);
      const fakes = script.beats.filter((b) => b.type === 'fakeLock');
      expect(fakes.length).toBeGreaterThan(0);
      const last = fakes[fakes.length - 1]!;
      expect(last.type === 'fakeLock' && last.target).not.toBe(`p${victimIndex + 1}`);
    }
  });

  it('frühere Fake-Locks treffen auch mal das Opfer', () => {
    let onVictim = 0;
    for (let seed = 0; seed < 3000; seed++) {
      const n = 3 + (seed % 6);
      const victimIndex = seed % n;
      const fakes = build(n, seed, 'normal', victimIndex).beats.filter(
        (b) => b.type === 'fakeLock'
      );
      if (fakes.slice(0, -1).some((f) => f.type === 'fakeLock' && f.target === `p${victimIndex + 1}`)) {
        onVictim++;
      }
    }
    expect(onVictim).toBeGreaterThan(100);
  });

  it('der letzte Fake sitzt unmittelbar vor dem Lock', () => {
    for (let seed = 0; seed < 500; seed++) {
      const script = build(5, seed);
      const lockIndex = script.beats.findIndex((b) => b.type === 'lock');
      expect(script.beats[lockIndex - 1]?.type).toBe('fakeLock');
    }
  });

  it('ein aim-Beat wiederholt nie das direkt vorherige Ziel', () => {
    for (let seed = 0; seed < 3000; seed++) {
      const n = 2 + (seed % 7);
      const beats = targetedBeats(build(n, seed, 'normal', seed % n));
      for (let i = 1; i < beats.length; i++) {
        if (beats[i]!.type !== 'aim') continue;
        expect(beats[i]!.target, `Seed ${seed}, n=${n}, Beat ${i}`).not.toBe(beats[i - 1]!.target);
      }
    }
  });

  it('springt ab 3 Spielern auch über Fakes hinweg immer auf ein neues Ziel', () => {
    for (let seed = 0; seed < 2000; seed++) {
      const n = 3 + (seed % 6);
      const beats = targetedBeats(build(n, seed, 'normal', seed % n));
      for (let i = 1; i < beats.length; i++) {
        expect(beats[i]!.target, `Seed ${seed}, n=${n}, Beat ${i}`).not.toBe(beats[i - 1]!.target);
      }
    }
  });

  it('bei 2 Spielern eskaliert höchstens der Fake auf dem laufenden Ziel', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const beats = targetedBeats(build(2, seed, 'normal', seed % 2));
      for (let i = 1; i < beats.length; i++) {
        if (beats[i]!.target !== beats[i - 1]!.target) continue;
        // Wiederholung nur erlaubt, wenn daraus ein Fake-Lock wird.
        expect(beats[i]!.type).toBe('fakeLock');
      }
    }
  });

  it('erzwingt bei 2 Spielern mindestens 4 Panik-Beats', () => {
    for (let seed = 0; seed < 500; seed++) {
      for (const preset of DURATION_PRESETS) {
        const script = build(2, seed, preset);
        const panic = script.beats.filter((b) => b.type === 'aim' && b.style === 'snap');
        expect(panic.length).toBeGreaterThanOrEqual(CHOREO_FAIRNESS.minPanicBeatsTwoPlayers);
      }
    }
  });

  it('setzt so viele Fake-Locks wie das Preset vorgibt', () => {
    for (const preset of DURATION_PRESETS) {
      for (let seed = 0; seed < 200; seed++) {
        const script = build(5, seed, preset);
        const fakes = script.beats.filter((b) => b.type === 'fakeLock');
        expect(fakes).toHaveLength(CHOREO.fakeLocksByPreset[preset]);
      }
    }
  });
});

describe('Choreographer — Determinismus', () => {
  it('gleicher Seed ⇒ identisches Skript', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(build(6, seed)).toEqual(build(6, seed));
    }
  });

  it('anderer Seed ⇒ anderes Skript', () => {
    let different = 0;
    for (let seed = 0; seed < 200; seed++) {
      if (JSON.stringify(build(6, seed)) !== JSON.stringify(build(6, seed + 1))) different++;
    }
    expect(different).toBeGreaterThan(190);
  });

  it('hängt nicht von der Reihenfolge der Spielerliste ab (kein verstecktes Leck)', () => {
    const a = buildShowScript({
      players: ['a', 'b', 'c', 'd'],
      victimId: 'c',
      seed: 77,
      durationPreset: 'normal',
      deathId: 'basic_fall',
    });
    // Dasselbe Opfer, andere Reihenfolge: das Skript darf anders aussehen, aber der
    // Lock muss weiterhin auf 'c' liegen und die Fairness halten.
    const b = buildShowScript({
      players: ['d', 'c', 'b', 'a'],
      victimId: 'c',
      seed: 77,
      durationPreset: 'normal',
      deathId: 'basic_fall',
    });
    for (const script of [a, b]) {
      const lock = script.beats.find((beat) => beat.type === 'lock');
      expect(lock?.type === 'lock' && lock.target).toBe('c');
      expect(victimDwellShare(script, 'c')).toBeLessThanOrEqual(
        1 / 4 + CHOREO_FAIRNESS.victimShareTolerance
      );
    }
  });
});
