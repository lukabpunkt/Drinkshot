/**
 * Timing-Presets der Scope-Show.
 * Quellen: `docs/01-GDD.md §3.5` (Dramaturgie-Tabelle) und
 * `docs/03-ARCHITECTURE.md §5` (Phasen-Budget, Fairness-Regeln).
 *
 * Der Choreographer (`core/choreographer.ts`, M3) liest ausschliesslich diese Werte —
 * keine Magic-Numbers in der Show.
 */

import { DURATION_MS, type DurationPreset } from './rules';

/* ------------------------------------------------------------------ */
/* Phasen-Budget (Architektur §5.1)                                    */
/* ------------------------------------------------------------------ */

/**
 * Anteile an der Gesamtdauer. Summe der ersten vier = 0.90,
 * der Rest (10 %) gehoert der Todesanimation.
 * Gegenprobe bei 15 s: intro 1.5 s · scan 4.5 s · panic 4.95 s · lock 2.55 s — deckt sich
 * mit der GDD-Tabelle (Intro 0–1.5, Scan 1.5–6.0, Panik 6.0–11.0, Lock 11.0–13.5).
 */
export const PHASE_BUDGET = {
  intro: 0.1,
  scan: 0.3,
  panic: 0.33,
  lock: 0.17,
  death: 0.1,
} as const;

export type PhaseId = keyof typeof PHASE_BUDGET;

/** Absolute Phasendauern in ms fuer ein Preset. */
export function phaseDurations(preset: DurationPreset): Record<PhaseId, number> {
  const total = DURATION_MS[preset];
  return {
    intro: Math.round(total * PHASE_BUDGET.intro),
    scan: Math.round(total * PHASE_BUDGET.scan),
    panic: Math.round(total * PHASE_BUDGET.panic),
    lock: Math.round(total * PHASE_BUDGET.lock),
    death: Math.round(total * PHASE_BUDGET.death),
  };
}

/* ------------------------------------------------------------------ */
/* Beat-Timings                                                        */
/* ------------------------------------------------------------------ */

export const CHOREO = {
  /** Verweildauer des Reticles je Phase, [min, max] in ms. */
  scanHoldMs: [600, 1200] as const,
  panicHoldMs: [300, 700] as const,

  /** Fake-Lock: haelt kurz, faerbt sich fast rot, springt weg. */
  fakeLockHoldMs: [800, 1100] as const,
  /** Klammern schliessen sich nur bis 70 %, dann Abbruch (Art Direction §6). */
  fakeLockProgress: 0.7,
  fakeLockAbortMs: 220,
  fakeLockAbortEase: 'power4.in',

  /** Anzahl Fake-Locks je Preset (Architektur §5.4). */
  fakeLocksByPreset: { short: 1, normal: 2, long: 2 } as const satisfies Record<DurationPreset, number>,

  /** Reticle-Sprung: Dauer-Range und Easing (Art Direction §6). */
  hopMs: [300, 600] as const,
  hopEase: 'power3.inOut',
  /** Overshoot beim Ankommen, in Anteil der Distanz. */
  hopOvershoot: 0.08,

  /** Klammern schnappen beim echten Lock zusammen. */
  lockClampMs: 200,

  /** Slow-Mo waehrend des Locks (GDD §3.5). */
  slowMoScale: 0.4,
  slowMoRampMs: 400,

  /** Parallax-Verschiebung der Arena beim Reticle-Sprung (Art Direction §7). */
  parallaxFactor: 0.04,
  parallaxEase: 'power2.out',

  /** Nachbeben-Zoom nach dem Tod. */
  afterShockZoom: 1.08,
  afterShockMs: 600,

  /** Iris-Wipe beim Oeffnen des Scopes. */
  introIrisMs: 900,
  /** Reveal: Vignette faehrt weg, Result faehrt rein. */
  outroMs: 700,
} as const;

/* ------------------------------------------------------------------ */
/* Fairness-Regeln (Architektur §5.3–§5.6, GDD §3.5)                   */
/* ------------------------------------------------------------------ */

export const CHOREO_FAIRNESS = {
  /**
   * Das Opfer darf vor dem Lock nicht laenger anvisiert werden als 1/n + Toleranz
   * der Gesamt-Verweilzeit. Wird im Unit-Test ueber 10 000 Seeds geprueft.
   */
  victimShareTolerance: 0.05,
  /** Nie zweimal hintereinander dasselbe Ziel. */
  forbidImmediateRepeat: true,
  /**
   * Der **letzte** Fake-Lock vor dem echten Lock ist nie das Opfer (GDD §3.5, maximale
   * Fallhöhe). Frühere Fakes dürfen das Opfer treffen — sie müssen es sogar, sonst
   * hängt das Opfer messbar kürzer im Fadenkreuz als alle anderen (ADR-19).
   */
  lastFakeMustNotBeVictim: true,
  /** Frühere Fake-Locks dürfen auf dem Opfer landen. */
  earlyFakesMayTargetVictim: true,
  /** Bei 2 Spielern mindestens so viele Aim-Beats in der Panik-Phase. */
  minPanicBeatsTwoPlayers: 4,
} as const;

/* ------------------------------------------------------------------ */
/* Herzschlag & Audio-Kurve                                            */
/* ------------------------------------------------------------------ */

export const HEARTBEAT: {
  startPhase: PhaseId;
  bpm: readonly [number, number];
  duckTo: number;
  duckMs: number;
} = {
  /** Setzt in der Panik-Phase ein. */
  startPhase: 'panic',
  /** Tempo in BPM von Panik-Beginn bis Shot. */
  bpm: [70, 140],
  /** Musik wird beim Lock geduckt. */
  duckTo: 0.25,
  duckMs: 300,
};
