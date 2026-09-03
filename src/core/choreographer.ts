/**
 * Choreographer — erzeugt aus (players, victimId, seed, durationPreset, deathId)
 * das deterministische `ShowScript` für den ShowDirector.
 *
 * **Er inszeniert nur.** Das Opfer steht bereits fest (ADR-2); der Choreographer darf es
 * niemals ändern und nutzt ausschliesslich den seedbaren PRNG aus `rng.ts` — nie den
 * sicheren Zufall, denn die Show soll reproduzierbar sein.
 *
 * Die Anti-Vorhersagbarkeits-Regeln aus GDD §3.5 sind hier eingebaut, nicht angehängt:
 * - Das Opfer wird vor dem Lock **nicht häufiger** anvisiert als die anderen.
 * - Der letzte Fake-Lock vor dem echten Lock ist **nie** das Opfer.
 * - Bei zwei Spielern gibt es mindestens vier Wechsel in der Panik-Phase.
 */

import { CHOREO, CHOREO_FAIRNESS, phaseDurations } from '@/config/choreo';
import { DURATION_MS, type DurationPreset } from '@/config/rules';
import { createSeededRng, type SeededRng } from './rng';
import type { PlayerId } from './lottery';
import type { DeathId } from './session';

export type Beat =
  | { t: number; type: 'intro' }
  | { t: number; type: 'aim'; target: PlayerId; holdMs: number; style: 'smooth' | 'snap' }
  | { t: number; type: 'fakeLock'; target: PlayerId; holdMs: number }
  | { t: number; type: 'lock'; target: PlayerId; holdMs: number }
  | { t: number; type: 'shot' }
  | { t: number; type: 'death'; deathId: DeathId }
  | { t: number; type: 'outro' };

/** Beats, die das Reticle auf ein Ziel legen. */
export type TargetedBeat = Extract<Beat, { target: PlayerId }>;

export interface ShowScript {
  totalMs: number;
  beats: Beat[];
}

export interface ChoreographyInput {
  players: PlayerId[];
  victimId: PlayerId;
  seed: number;
  durationPreset: DurationPreset;
  deathId: DeathId;
}

/* ------------------------------------------------------------------ */
/* Hilfen                                                              */
/* ------------------------------------------------------------------ */

/**
 * Verteilt `total` ms auf `count` Beats, jeder möglichst in [min, max].
 *
 * Passt das Budget nicht (acht Spieler in 4.5 s Scan ergeben rechnerisch 562 ms statt der
 * angestrebten 600), bekommen alle gleich viel — lieber gleichmässig zu kurz als einzelne
 * Spieler auffällig länger im Fadenkreuz (ADR-18).
 */
function distribute(total: number, count: number, min: number, max: number, rng: SeededRng): number[] {
  if (count <= 0) return [];

  const even = total / count;
  if (even < min || even > max) {
    const clamped = Math.max(1, Math.round(even));
    return new Array<number>(count).fill(clamped);
  }

  // Zufällige Gewichte, dann auf das Budget normiert und in die Range geklemmt.
  const weights = Array.from({ length: count }, () => rng.range(0.8, 1.2));
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((weight) => (weight / sum) * total);

  const clampedValues = raw.map((value) => Math.min(max, Math.max(min, value)));
  const clampedSum = clampedValues.reduce((a, b) => a + b, 0);
  const correction = total / clampedSum;

  return clampedValues.map((value) => Math.max(1, Math.round(value * correction)));
}

/**
 * Mischt eine Ziel-Liste so, dass nie zweimal hintereinander dasselbe Ziel steht.
 * `avoidFirst` verhindert zusätzlich, dass der erste Beat das vorherige Ziel wiederholt.
 */
function shuffleWithoutRepeats(
  targets: readonly PlayerId[],
  rng: SeededRng,
  avoidFirst?: PlayerId
): PlayerId[] {
  const remaining = [...targets];
  const out: PlayerId[] = [];
  let previous = avoidFirst;

  while (remaining.length > 0) {
    // Kandidaten, die nicht das direkt vorherige Ziel wiederholen.
    const allowed: number[] = [];
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i] !== previous) allowed.push(i);
    }
    // Bleibt nur das verbotene Ziel übrig, muss es genommen werden (z. B. zwei gleiche am Ende).
    const pool = allowed.length > 0 ? allowed : remaining.map((_, i) => i);
    const pick = pool[rng.int(pool.length)]!;
    previous = remaining[pick]!;
    out.push(previous);
    remaining.splice(pick, 1);
  }

  return out;
}

/**
 * Gleicht die Verweilzeiten über die **Haltezeiten** aus.
 *
 * Die Ziele der Panik-Beats liegen weitgehend fest: Aim-Beats dürfen das laufende Ziel
 * nicht wiederholen, und bei zwei Spielern heisst das strikte Abwechslung. Der letzte
 * Fake gehört per Regel dem Nicht-Opfer und hält deutlich länger als ein Panik-Beat —
 * ohne Ausgleich hinge das Opfer dadurch systematisch kürzer im Fadenkreuz, und das wäre
 * genauso ein Muster wie das Gegenteil (GDD §3.5: „± gleich").
 *
 * Also: Was über die Ziele nicht geht, geht über die Zeit. Die Aim-Beats jedes Spielers
 * werden so gestreckt oder gestaucht, dass am Ende alle gleich lange im Fadenkreuz
 * hingen — jeder einzelne Beat bleibt dabei im erlaubten Bereich, und das Gesamtbudget
 * der Panik-Phase bleibt unverändert.
 */
function balanceHolds(
  plan: { kind: 'aim' | 'fake'; target: PlayerId; holdMs: number }[],
  players: readonly PlayerId[],
  scanDwell: ReadonlyMap<PlayerId, number>,
  panicBudget: number
): void {
  const aimSlots = plan.filter((beat) => beat.kind === 'aim');
  if (aimSlots.length === 0) return;

  // Was schon feststeht: Scan-Zeit plus alle Fake-Locks.
  const fixed = new Map<PlayerId, number>(players.map((p) => [p, scanDwell.get(p) ?? 0]));
  for (const beat of plan) {
    if (beat.kind === 'fake') fixed.set(beat.target, (fixed.get(beat.target) ?? 0) + beat.holdMs);
  }

  const totalFixed = [...fixed.values()].reduce((a, b) => a + b, 0);
  const perPlayerTarget = (totalFixed + panicBudget) / players.length;

  // Wieviel Aim-Zeit jeder bräuchte, um auf den Zielwert zu kommen.
  const wanted = new Map<PlayerId, number>();
  for (const player of players) {
    wanted.set(player, Math.max(0, perPlayerTarget - (fixed.get(player) ?? 0)));
  }
  const wantedSum = [...wanted.values()].reduce((a, b) => a + b, 0) || 1;

  // Auf das Panik-Budget normieren und auf die Beats des Spielers verteilen.
  const slotsPerPlayer = new Map<PlayerId, number>();
  for (const beat of aimSlots) {
    slotsPerPlayer.set(beat.target, (slotsPerPlayer.get(beat.target) ?? 0) + 1);
  }

  for (const beat of aimSlots) {
    const share = ((wanted.get(beat.target) ?? 0) / wantedSum) * panicBudget;
    const count = slotsPerPlayer.get(beat.target) ?? 1;
    beat.holdMs = Math.round(
      Math.min(CHOREO.panicHoldMs[1], Math.max(CHOREO.panicHoldMs[0], share / count))
    );
  }

  // Nach dem Klemmen kann die Summe abweichen — gleichmässig nachziehen.
  const sum = aimSlots.reduce((total, beat) => total + beat.holdMs, 0);
  if (sum > 0 && Math.abs(sum - panicBudget) > 1) {
    const correction = panicBudget / sum;
    for (const beat of aimSlots) beat.holdMs = Math.max(1, Math.round(beat.holdMs * correction));
  }
}

/* ------------------------------------------------------------------ */
/* Hauptfunktion                                                       */
/* ------------------------------------------------------------------ */

export function buildShowScript(input: ChoreographyInput): ShowScript {
  const { players, victimId, seed, durationPreset, deathId } = input;

  if (players.length === 0) throw new RangeError('buildShowScript: keine Spieler.');
  if (!players.includes(victimId)) {
    throw new RangeError(`buildShowScript: Opfer ${victimId} ist nicht in der Spielerliste.`);
  }

  const rng = createSeededRng(seed);
  const phases = phaseDurations(durationPreset);
  const beats: Beat[] = [];

  let t = 0;

  /* --- Intro: Iris-Wipe, alle laufen los --- */
  beats.push({ t, type: 'intro' });
  t += phases.intro;

  /* --- Scan: jeder genau einmal, weich angefahren --- */
  const scanOrder = shuffleWithoutRepeats(players, rng);
  const scanHolds = distribute(
    phases.scan,
    scanOrder.length,
    CHOREO.scanHoldMs[0],
    CHOREO.scanHoldMs[1],
    rng
  );

  scanOrder.forEach((target, index) => {
    beats.push({ t, type: 'aim', target, holdMs: scanHolds[index]!, style: 'smooth' });
    t += scanHolds[index]!;
  });

  /* --- Panik: schnellere Wechsel, dazwischen die Fake-Locks --- */
  const fakeCount = CHOREO.fakeLocksByPreset[durationPreset];
  const fakeHold = Math.round((CHOREO.fakeLockHoldMs[0] + CHOREO.fakeLockHoldMs[1]) / 2);
  const panicBudget = Math.max(0, phases.panic - fakeCount * fakeHold);

  const averagePanicHold = (CHOREO.panicHoldMs[0] + CHOREO.panicHoldMs[1]) / 2;
  let aimCount = Math.max(1, Math.round(panicBudget / averagePanicHold));
  if (players.length === 2) {
    // GDD §3.5: zu zweit darf es nicht in drei Sekunden vorbei sein.
    aimCount = Math.max(aimCount, CHOREO_FAIRNESS.minPanicBeatsTwoPlayers);
  }

  const panicHolds = distribute(
    panicBudget,
    aimCount,
    CHOREO.panicHoldMs[0],
    CHOREO.panicHoldMs[1],
    rng
  );

  /*
   * Panik-Phase als **eine** Slot-Folge bauen, statt Fakes nachträglich in eine fertige
   * Reihenfolge zu schieben: sonst repariert man eine Wiederholung und erzeugt dabei die
   * nächste.
   *
   * Die Fakes **belegen** Slots, sie hängen sich nicht hinten an. Angehängt hätte der
   * letzte Fake dem Nicht-Opfer eine knappe Extra-Sekunde Verweilzeit geschenkt — bei
   * zwei Spielern hing das Opfer dadurch messbar kürzer im Fadenkreuz als der andere
   * (ADR-19).
   */
  interface Slot {
    kind: 'aim' | 'fake';
    holdMs: number;
    /** Nur der letzte Fake schliesst das Opfer als Ziel aus. */
    final?: boolean;
  }

  const totalSlots = aimCount + fakeCount;
  const fakePositions = new Set<number>();
  if (fakeCount > 0) {
    // Der letzte Slot ist immer ein Fake — unmittelbar vor dem Lock (GDD §3.5).
    fakePositions.add(totalSlots - 1);
    for (let i = 1; i < fakeCount; i++) {
      const position = Math.max(1, Math.round((totalSlots * i) / (fakeCount + 1)));
      // Kollisionen nach hinten ausweichen, damit wirklich `fakeCount` Fakes entstehen.
      let candidate = position;
      while (fakePositions.has(candidate) && candidate < totalSlots - 1) candidate++;
      fakePositions.add(candidate);
    }
  }

  const slots: Slot[] = [];
  let aimIndex = 0;
  for (let i = 0; i < totalSlots; i++) {
    if (fakePositions.has(i)) {
      slots.push({ kind: 'fake', holdMs: fakeHold, final: i === totalSlots - 1 });
    } else {
      slots.push({ kind: 'aim', holdMs: panicHolds[aimIndex] ?? Math.round(averagePanicHold) });
      aimIndex++;
    }
  }

  /*
   * Ziel-Auswahl über eine **Verweilzeit-Bilanz** statt über feste Beat-Quoten.
   *
   * Der Audit misst nicht, wie oft jemand anvisiert wird, sondern wie lange — und die
   * Fake-Locks halten deutlich länger als ein Panik-Beat. Eine Quote auf Beat-Ebene
   * würde das übersehen und ausserdem die Abwechslung durcheinanderbringen, sobald ein
   * Fake dazwischenrutscht. Deshalb bekommt jeder Beat das Ziel, das bisher am
   * **wenigsten** im Fadenkreuz hing.
   *
   * Die Bilanz startet mit der Scan-Phase, damit die Panik deren Ungleichheit ausgleicht.
   */
  const dwell = new Map<PlayerId, number>(players.map((player) => [player, 0]));
  scanOrder.forEach((target, index) => {
    dwell.set(target, (dwell.get(target) ?? 0) + scanHolds[index]!);
  });
  const scanDwell = new Map(dwell);

  const nonVictims = players.filter((player) => player !== victimId);

  /** Nimmt aus `allowed` das Ziel mit der geringsten bisherigen Verweilzeit. */
  const takeLeastSeen = (allowed: readonly PlayerId[], holdMs: number): PlayerId => {
    let best: PlayerId | undefined;
    let bestDwell = Number.POSITIVE_INFINITY;
    for (const candidate of allowed) {
      const current = dwell.get(candidate) ?? 0;
      // Gleichstand per Seed auflösen, damit die Show nicht immer gleich aussieht.
      if (current < bestDwell || (current === bestDwell && rng.chance(0.5))) {
        best = candidate;
        bestDwell = current;
      }
    }
    const chosen = best ?? victimId;
    dwell.set(chosen, (dwell.get(chosen) ?? 0) + holdMs);
    return chosen;
  };

  let previousTarget = scanOrder[scanOrder.length - 1];

  /** Erst die Ziele festlegen, dann die Haltezeiten ausbalancieren, dann emittieren. */
  interface PlannedBeat {
    kind: 'aim' | 'fake';
    target: PlayerId;
    holdMs: number;
  }

  const plan: PlannedBeat[] = [];

  for (const slot of slots) {
    if (slot.kind === 'fake') {
      /*
       * Der **letzte** Fake geht nie ans Opfer (harte Regel, GDD §3.5: maximale Fallhöhe).
       * Frühere Fakes dürfen es treffen — täten sie es nie, hinge das Opfer messbar
       * kürzer im Fadenkreuz als alle anderen (ADR-19).
       *
       * Bei zwei Spielern hat der letzte Fake nur einen Kandidaten; dann eskaliert er auf
       * dem Ziel, auf dem das Reticle ohnehin steht. Dramaturgisch genau richtig: die
       * Klammern fahren zu, dann springt es weg.
       */
      const eligible = slot.final ? nonVictims : players;
      const candidates = eligible.filter((player) => player !== previousTarget);
      const allowed = candidates.length > 0 ? candidates : eligible;
      const target = allowed.length > 0 ? takeLeastSeen(allowed, slot.holdMs) : victimId;
      plan.push({ kind: 'fake', target, holdMs: slot.holdMs });
      previousTarget = target;
    } else {
      // Aim-Beats wiederholen nie das laufende Ziel — bei ≥ 2 Spielern immer möglich.
      const allowed = players.filter((player) => player !== previousTarget);
      const target = takeLeastSeen(allowed, slot.holdMs);
      plan.push({ kind: 'aim', target, holdMs: slot.holdMs });
      previousTarget = target;
    }
  }

  balanceHolds(plan, players, scanDwell, panicBudget);

  for (const planned of plan) {
    if (planned.kind === 'fake') {
      beats.push({ t, type: 'fakeLock', target: planned.target, holdMs: planned.holdMs });
    } else {
      beats.push({
        t,
        type: 'aim',
        target: planned.target,
        holdMs: planned.holdMs,
        style: 'snap',
      });
    }
    t += planned.holdMs;
  }

  /* --- Lock auf das Opfer --- */
  beats.push({ t, type: 'lock', target: victimId, holdMs: phases.lock });
  t += phases.lock;

  /* --- Schuss und Tod --- */
  beats.push({ t, type: 'shot' });
  beats.push({ t, type: 'death', deathId });
  t += phases.death;

  beats.push({ t, type: 'outro' });

  /*
   * Rundungsfehler der Phasen-Verteilung auf die Soll-Dauer ziehen: Audit A3 verlangt
   * 10/15/22 s ± 1 s, und das soll nicht vom Zufall abhängen.
   */
  const target = DURATION_MS[durationPreset];
  const drift = target - t;
  if (drift !== 0) {
    const lockBeat = beats.find((beat) => beat.type === 'lock');
    if (lockBeat && lockBeat.type === 'lock') {
      lockBeat.holdMs = Math.max(1, lockBeat.holdMs + drift);
      for (const beat of beats) {
        if (beat.t > lockBeat.t) beat.t += drift;
      }
    }
    t = target;
  }

  return { totalMs: t, beats };
}

/* ------------------------------------------------------------------ */
/* Auswertung (Tests, Dev-Panel, Fairness-Audit)                       */
/* ------------------------------------------------------------------ */

/** Beats, die ein Ziel anvisieren — in Reihenfolge. */
export function targetedBeats(script: ShowScript): TargetedBeat[] {
  return script.beats.filter((beat): beat is TargetedBeat => 'target' in beat);
}

/**
 * Verweilzeit des Reticles je Spieler **vor dem Lock**. Genau diese Zahl darf für das
 * Opfer nicht aus der Reihe fallen, sonst lernen die Spieler das Muster (GDD §3.5).
 */
export function dwellBeforeLock(script: ShowScript): Record<PlayerId, number> {
  const dwell: Record<PlayerId, number> = {};
  for (const beat of script.beats) {
    if (beat.type === 'lock') break;
    if (beat.type === 'aim' || beat.type === 'fakeLock') {
      dwell[beat.target] = (dwell[beat.target] ?? 0) + beat.holdMs;
    }
  }
  return dwell;
}

/** Anteil des Opfers an der gesamten Verweilzeit vor dem Lock. */
export function victimDwellShare(script: ShowScript, victimId: PlayerId): number {
  const dwell = dwellBeforeLock(script);
  const total = Object.values(dwell).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return (dwell[victimId] ?? 0) / total;
}
