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

  /**
   * Double Tap: der Nachschlag auf das zweite Opfer (GDD §4.2).
   *
   * Kein zweiter Scan und keine zweite Panik — die Spannung ist mit dem ersten Schuss
   * verbraucht, ein zweiter Aufbau wuerde sie nicht wiederholen, sondern langweilen. Statt
   * dessen: kurzer Ruck aufs naechste Ziel, Klammern zu, Schuss. Ueberraschung statt
   * Aufbau.
   */
  doubleTapSwingMs: 500,
  doubleTapLockMs: 900,

  /** Iris-Wipe beim Oeffnen des Scopes. */
  introIrisMs: 900,
  /** Reveal: Vignette faehrt weg, Result faehrt rein. */
  outroMs: 700,
} as const;

/* ------------------------------------------------------------------ */
/* Fairness-Regeln (Architektur §5.3–§5.6, GDD §3.5)                   */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Intro-Inszenierung (GDD §3.5)                                       */
/* ------------------------------------------------------------------ */

/**
 * Der Auftakt vor der eigentlichen Show: Man sieht den Schuetzen von vorne, die Kamera
 * faehrt in sein Zielfernrohr, die Blende oeffnet sich — und die Maennchen stehen noch
 * in einer Reihe, bis ein Warnschuss neben ihnen einschlaegt.
 *
 * Die Zeiten kommen **obendrauf**, sie sind nicht Teil des Dauer-Presets: Das Preset
 * beschreibt den Aufbau bis zum Schuss, und der ist unveraendert. Dieselbe Regel gilt
 * fuer den Double-Tap-Nachschlag und die Showdown-Kaskade.
 *
 * Ab der zweiten Runde laeuft nur noch der Kurzteil (Reihe, Warnschuss, Auseinander) —
 * ein siebensekuendiger Vorspann vor jeder Runde waere am achten Abend nur noch Wartezeit.
 */
export const INTRO = {
  /** Wie lange man den Schuetzen frontal sieht. */
  sniperHoldMs: 3000,
  /** Fahrt in die Linse hinein, bis sie den Scope-Kreis fuellt. */
  pushMs: 1100,
  /** Wie weit die Linse zu Beginn kleiner ist als am Ende. */
  pushFactor: 2.6,
  /** Linsen-Innenradius im lokalen Massstab des Schuetzen-Containers. */
  lensRadiusPx: 110,
  /** Ruhe, bevor der Warnschuss faellt — das Fadenkreuz wandert ueber die Reihe. */
  rowHoldMs: 900,
  /** Vom Knall bis zum Losstieben. */
  warningShotMs: 260,
  /** Wie lange die Maennchen nach dem Warnschuss sprinten. */
  scatterMs: 700,

  /** Abstand zweier Maennchen in der Reihe, als Anteil ihrer Hoehe. */
  rowSpacingFactor: 0.55,
  /**
   * Tiefenversatz zwischen vorderer und hinterer Reihe (ab 7 Spielern).
   *
   * Der Kopf ist 0,406 der Hoehe hoch — bei geringerem Versatz schauen die Hinteren nur
   * noch mit dem Haaransatz ueber die Vorderen. 0,55 laesst 29 Welteinheiten Luft, also
   * Kopf und ein Stueck Schulter. Kostet nichts: Der aeusserste Fusspunkt liegt damit auf
   * Radius 200 von 351.
   */
  rowDepthFactor: 0.55,
  /**
   * Wie weit die Reihe hoechstens aus der Mitte reichen darf, als Anteil des Laufradius.
   * Nicht 1.0: Ab 0.9 lenkt der Brain vom Rand weg, und beim Auftauen risse
   * `clampToZone()` die Aeusseren sichtbar zurueck.
   */
  maxHalfSpanFactor: 0.86,
  /** Wie weit die Reihe hinter der Arenamitte steht, als Anteil der Hoehe. */
  rowOffsetFactor: 0.15,
  /** Wie weit vor den Fuessen des Aeussersten der Warnschuss einschlaegt. */
  warningShotAheadFactor: 0.8,
} as const;

/* ------------------------------------------------------------------ */
/* Showdown-Kaskade (GDD §3.6, Roadmap M5b)                            */
/* ------------------------------------------------------------------ */

/**
 * Timing der Kaskade: In einer Runde fallen n−1 Schuesse, bis einer steht.
 *
 * Die Kurve waechst **von unten nach oben**. Ein gleichmaessiger Nachschlag wie bei
 * Double Tap waere hier falsch: Der erste Schuss von sechs ist kein Hoehepunkt, der
 * letzte ist einer. Also kurzer Auftakt, dann eine Montage, die sich beschleunigt
 * anfuehlt, weil jedes Segment ein Stueck laenger wird als das davor — und am Ende ein
 * Duell mit vollem Aufbau, Scan, Panik und Fake-Locks.
 *
 * Alle Anteile beziehen sich auf `DURATION_MS[preset]`, also auf die Laenge einer
 * normalen Runde.
 */
export const CASCADE = {
  /** Auftakt: voller Aufbau, aber gekuerzt — das Ritual bleibt, die Laenge nicht. */
  openingShare: 0.6,
  /** Das finale Duell bekommt fast eine ganze Runde. */
  finaleShare: 0.9,
  /** Gesamtbudget aller Montage-Segmente dazwischen. */
  montageShare: 0.7,
  /** Jedes Montage-Segment ist um diesen Faktor laenger als das davor. */
  montageGrowth: 1.45,
  /**
   * Kuerzestes Montage-Segment. Muss Tod (1200), Lock (mind. 450) und wenigstens einen
   * sichtbaren Reticle-Wechsel (260) unterbringen — darunter entstehen Beats von wenigen
   * Millisekunden, die niemand sieht.
   */
  montageMinMs: 2200,
  /** Darueber waere es kein Montage-Schnitt mehr, sondern ein zweites Duell. */
  montageMaxMs: 4200,

  /** Sammeln nach jedem Tod: Klammern auf, Kamera raus, alle stieben auseinander. */
  regroupMs: 500,
  /**
   * Was das *Skript* einem Zwischentod einraeumt. Die Sequenzen laufen real 2,6–4,5 s
   * und ueberlappen bewusst mit dem naechsten Segment — sechs vollstaendig
   * ausgespielte Tode hintereinander waeren eine Diashow.
   */
  deathHoldMs: 1200,
  /** Der letzte Tod bekommt seine Zeit; danach kommt nur noch das Outro. */
  finalDeathHoldMs: 2600,

  /** Montage-Beats: kurz und hart. */
  panicHoldMs: [260, 520] as const,
  /** Wie schnell die Ueberlebenden je Segment zusaetzlich werden. */
  panicSpeedStep: 0.1,

  /** Notbremse: Laenger als das darf eine Runde nicht werden. */
  maxTotalMs: 45_000,
} as const;

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
