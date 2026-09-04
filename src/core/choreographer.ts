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

import {
  CASCADE,
  CHOREO,
  CHOREO_FAIRNESS,
  PHASE_BUDGET,
  phaseDurations,
  type PhaseId,
} from '@/config/choreo';
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
  | { t: number; type: 'death'; deathId: DeathId; victim: PlayerId }
  /**
   * Showdown: Sammeln zwischen zwei Schuessen. Die Ueberlebenden stehen **explizit** im
   * Beat — der Director darf sie nicht aus dem Zustand der Maennchen ableiten, denn eine
   * Sequenz setzt `dead` erst an ihrem Ende, und bis dahin waere die Auskunft falsch.
   */
  | { t: number; type: 'regroup'; survivors: readonly PlayerId[]; holdMs: number }
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
  /**
   * Double Tap: weitere Opfer nach dem ersten, in der Reihenfolge des Nachschlags.
   * Jedes bekommt Ruck, Lock, Schuss und eigene Sequenz — aber keinen neuen Aufbau.
   */
  extraVictims?: readonly { victimId: PlayerId; deathId: DeathId }[];
  /**
   * Showdown: weitere Opfer, jedes mit **eigenem** Aufbau über die noch Lebenden.
   *
   * Bewusst ein anderes Feld als `extraVictims` — die zwei Dramaturgien sind verschieden.
   * Double Tap ist ein Nachschlag ohne Aufbau; die Kaskade baut jedes Mal neu auf, immer
   * länger, bis zum Duell. Beides gleichzeitig ergibt keinen Sinn und wird abgewiesen.
   */
  cascade?: readonly { victimId: PlayerId; deathId: DeathId }[];
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
/* Segmente                                                            */
/* ------------------------------------------------------------------ */

/**
 * Ein Segment ist ein vollständiger Bogen: anvisieren, locken, schiessen, sterben.
 *
 * Die klassische Runde besteht aus **einem** Segment. Der Showdown reiht mehrere
 * aneinander, jedes über die zu dem Zeitpunkt noch lebenden Spieler — und genau deshalb
 * werden Opfer, Nicht-Opfer und Verweilzeit-Bilanz **pro Segment** gerechnet. Global
 * gerechnet wäre bei n−1 Opfern nur ein einziger Nicht-Opfer übrig, und die Regel „der
 * letzte Fake ist nie das Opfer" würde in jedem Segment den Gewinner verraten.
 */
interface SegmentPlan {
  /** Wer in diesem Segment noch lebt und angevisiert werden darf. */
  players: readonly PlayerId[];
  victimId: PlayerId;
  deathId: DeathId;
  /** Phasenbudget dieses Segments. `intro: 0` heisst: kein Intro-Beat. */
  phases: Record<PhaseId, number>;
  /** Soll-Länge. Die Rundungsdrift landet im Lock-Hold. */
  budgetMs: number;
  fakeCount: number;
  /** `undefined` = alle scannen (Klassik). `0` = kein Scan (Montage-Segment). */
  scanBeats: number | undefined;
  panicHoldMs: readonly [number, number];
  /** Untergrenze für die Anzahl Panik-Beats; 0 = keine. */
  minPanicBeats: number;
  /** Letztes Ziel des Vorgängersegments — kein Repeat über die Grenze hinweg. */
  previousTarget: PlayerId | undefined;
}

interface SegmentResult {
  beats: Beat[];
  /** Immer exakt `plan.budgetMs`. */
  durationMs: number;
  lastTarget: PlayerId;
}

/**
 * Zieht ein Segment exakt auf sein Budget: Der Lock-Hold nimmt die Rundungsdrift auf.
 *
 * Angefasst wird nur der Lock **dieses** Segments. Alles davor bleibt liegen — die
 * Fairness-Bilanz vor dem Lock darf sich nicht verschieben —, alles danach wandert mit.
 */
function applyDrift(beats: Beat[], drift: number): void {
  if (drift === 0) return;
  const lockBeat = beats.find((beat) => beat.type === 'lock');
  if (!lockBeat || lockBeat.type !== 'lock') return;

  lockBeat.holdMs = Math.max(1, lockBeat.holdMs + drift);
  for (const beat of beats) {
    if (beat.t > lockBeat.t) beat.t += drift;
  }
}

function buildSegment(plan: SegmentPlan, rng: SeededRng, t0: number): SegmentResult {
  const { players, victimId, phases } = plan;
  const beats: Beat[] = [];
  let t = t0;

  /* --- Intro: Iris-Wipe, alle laufen los --- */
  if (phases.intro > 0) {
    beats.push({ t, type: 'intro' });
    t += phases.intro;
  }

  /* --- Scan: jeder genau einmal, weich angefahren --- */
  const shuffled = shuffleWithoutRepeats(players, rng, plan.previousTarget);
  const scanOrder = plan.scanBeats === undefined ? shuffled : shuffled.slice(0, plan.scanBeats);
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
  const fakeCount = plan.fakeCount;
  const fakeHold = Math.round((CHOREO.fakeLockHoldMs[0] + CHOREO.fakeLockHoldMs[1]) / 2);
  const panicBudget = Math.max(0, phases.panic - fakeCount * fakeHold);

  const averagePanicHold = (plan.panicHoldMs[0] + plan.panicHoldMs[1]) / 2;
  let aimCount = Math.max(1, Math.round(panicBudget / averagePanicHold));
  if (plan.minPanicBeats > 0) {
    // GDD §3.5: zu zweit darf es nicht in drei Sekunden vorbei sein.
    aimCount = Math.max(aimCount, plan.minPanicBeats);
  }

  const panicHolds = distribute(
    panicBudget,
    aimCount,
    plan.panicHoldMs[0],
    plan.panicHoldMs[1],
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
   * Die Bilanz startet mit der Scan-Phase, damit die Panik deren Ungleichheit ausgleicht
   * — und sie ist **segmentlokal**: Über Segmente hinweg getragen, rechnete `balanceHolds`
   * die Zeit längst toter Spieler mit und die Normierung wäre schief.
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

  let previousTarget = scanOrder[scanOrder.length - 1] ?? plan.previousTarget;

  /** Erst die Ziele festlegen, dann die Haltezeiten ausbalancieren, dann emittieren. */
  interface PlannedBeat {
    kind: 'aim' | 'fake';
    target: PlayerId;
    holdMs: number;
  }

  const plan_: PlannedBeat[] = [];

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
      plan_.push({ kind: 'fake', target, holdMs: slot.holdMs });
      previousTarget = target;
    } else {
      // Aim-Beats wiederholen nie das laufende Ziel — bei ≥ 2 Spielern immer möglich.
      const allowed = players.filter((player) => player !== previousTarget);
      const target = takeLeastSeen(allowed.length > 0 ? allowed : players, slot.holdMs);
      plan_.push({ kind: 'aim', target, holdMs: slot.holdMs });
      previousTarget = target;
    }
  }

  balanceHolds(plan_, players, scanDwell, panicBudget);

  for (const planned of plan_) {
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
  beats.push({ t, type: 'death', deathId: plan.deathId, victim: victimId });
  t += phases.death;

  /*
   * Rundungsfehler der Phasen-Verteilung auf die Soll-Dauer ziehen: Audit A3 verlangt
   * 10/15/22 s ± 1 s, und das soll nicht vom Zufall abhängen.
   */
  applyDrift(beats, t0 + plan.budgetMs - t);

  return { beats, durationMs: plan.budgetMs, lastTarget: victimId };
}

/* ------------------------------------------------------------------ */
/* Kaskade (Showdown)                                                  */
/* ------------------------------------------------------------------ */

interface CascadeBudgets {
  opening: number;
  /** Ein Eintrag je Montage-Segment, wachsend. */
  montage: number[];
  finale: number;
}

/**
 * Verteilt die Zeit über die Segmente. Deterministisch, verbraucht **kein** RNG.
 *
 * Die Montage wächst geometrisch: Jedes Segment ist um `montageGrowth` länger als das
 * davor. Das liest sich als Beschleunigung, obwohl es das Gegenteil ist — weil die
 * Abstände zwischen den Schüssen grösser werden, wirkt jeder einzelne gewichtiger.
 *
 * `maxTotalMs` ist die Notbremse: Reisst die Runde das Budget, wird die **Montage**
 * gestaucht. Das Finale nie — es ist der Grund, warum jemand den Modus spielt.
 */
function cascadeBudgets(preset: DurationPreset, kills: number): CascadeBudgets {
  const base = DURATION_MS[preset];
  let opening = Math.round(base * CASCADE.openingShare);
  const finale = Math.round(base * CASCADE.finaleShare);

  // Zwischen Auftakt und Finale liegen `kills - 2` Segmente.
  const montageCount = Math.max(0, kills - 2);

  // Geometrische Gewichte, auf das Montage-Budget normiert.
  const weights: number[] = [];
  for (let i = 0; i < montageCount; i++) weights.push(CASCADE.montageGrowth ** i);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  const montageBudget = base * CASCADE.montageShare;
  let montage = weights.map((weight) =>
    Math.round(
      Math.min(
        CASCADE.montageMaxMs,
        Math.max(CASCADE.montageMinMs, (weight / weightSum) * montageBudget)
      )
    )
  );

  /*
   * Notbremse, in zwei Stufen — das Finale wird **nie** gekürzt, es ist der Grund, warum
   * jemand den Modus spielt.
   *
   * 1. Die Montage stauchen. Reicht das,
   * 2. den Auftakt kürzen (bis auf die Hälfte). Bei acht Spielern auf „Lang" ist selbst
   *    das nicht genug — dann läuft die Runde eben über die Grenze, weil Preset und
   *    Spielerzahl beide bewusst gewählt wurden. Ehrlicher, als still ein Duell zu
   *    beschneiden.
   */
  const overhead =
    kills * CASCADE.regroupMs + (kills - 1) * CASCADE.deathHoldMs + CASCADE.finalDeathHoldMs;
  const montageTotal = montage.reduce((sum, value) => sum + value, 0);
  const minMontage = montageCount * CASCADE.montageMinMs;

  let excess = opening + finale + overhead + montageTotal - CASCADE.maxTotalMs;
  if (excess > 0 && montageTotal > minMontage) {
    const room = Math.max(minMontage, montageTotal - excess);
    const factor = room / montageTotal;
    montage = montage.map((value) => Math.max(CASCADE.montageMinMs, Math.round(value * factor)));
    excess = opening + finale + overhead + montage.reduce((sum, v) => sum + v, 0) - CASCADE.maxTotalMs;
  }
  if (excess > 0) {
    opening = Math.max(Math.round(opening / 2), opening - excess);
  }

  return { opening, montage, finale };
}

/**
 * Verteilt ein Segment-Budget auf die Phasen.
 *
 * Montage-Segmente bekommen **keinen** Scan: Bei 700 ms über fünf Spieler bliebe pro
 * Ziel 140 ms, und `scope.aimAt` fährt dann in unter 100 ms — das Reticle teleportiert,
 * statt zu suchen. Ein Montage-Segment ist reine Panik: ein bis drei harte Wechsel, dann
 * die Klammer.
 */
function cascadePhases(
  budgetMs: number,
  kind: 'opening' | 'montage' | 'finale',
  deathMs: number
): Record<PhaseId, number> {
  const body = Math.max(0, budgetMs - deathMs);

  if (kind === 'montage') {
    /*
     * Kein Intro, kein Scan. Was bleibt, teilen sich Panik und Lock — und beide bekommen
     * eine Untergrenze: Der Lock muss sichtbar zugehen (`lockClampMs` plus Reserve für
     * die Drift), und mindestens ein Reticle-Wechsel muss lesbar sein. Sonst entstehen
     * Beats von wenigen Millisekunden.
     */
    const minLock = CHOREO.lockClampMs + 250;
    const minPanic = CASCADE.panicHoldMs[0];
    const lock = Math.max(minLock, Math.min(body - minPanic, Math.round(body * 0.4)));
    return { intro: 0, scan: 0, panic: Math.max(minPanic, body - lock), lock, death: deathMs };
  }

  // Auftakt und Finale folgen dem normalen Phasen-Verhältnis, nur ohne Todes-Anteil.
  const share = PHASE_BUDGET.intro + PHASE_BUDGET.scan + PHASE_BUDGET.panic + PHASE_BUDGET.lock;
  const scale = body / share;
  const intro = kind === 'opening' ? Math.round(PHASE_BUDGET.intro * scale) : 0;
  const scan = Math.round(PHASE_BUDGET.scan * scale);
  const lock = Math.round(PHASE_BUDGET.lock * scale);
  return { intro, scan, panic: Math.max(0, body - intro - scan - lock), lock, death: deathMs };
}

/* ------------------------------------------------------------------ */
/* Hauptfunktion                                                       */
/* ------------------------------------------------------------------ */

export function buildShowScript(input: ChoreographyInput): ShowScript {
  const { players, victimId, seed, durationPreset, deathId } = input;
  const extraVictims = input.extraVictims ?? [];
  const cascade = input.cascade ?? [];

  if (players.length === 0) throw new RangeError('buildShowScript: keine Spieler.');
  if (!players.includes(victimId)) {
    throw new RangeError(`buildShowScript: Opfer ${victimId} ist nicht in der Spielerliste.`);
  }
  if (extraVictims.length > 0 && cascade.length > 0) {
    throw new RangeError('buildShowScript: cascade und extraVictims schliessen sich aus.');
  }

  const followUps = [...extraVictims, ...cascade];
  const seen = new Set<PlayerId>([victimId]);
  for (const extra of followUps) {
    if (!players.includes(extra.victimId)) {
      throw new RangeError(`buildShowScript: Opfer ${extra.victimId} ist nicht in der Spielerliste.`);
    }
    if (seen.has(extra.victimId)) {
      throw new RangeError(`buildShowScript: Opfer ${extra.victimId} kommt doppelt vor.`);
    }
    seen.add(extra.victimId);
  }
  if (cascade.length > players.length - 2) {
    // Einer muss stehen bleiben, sonst gibt es keinen Gewinner.
    throw new RangeError('buildShowScript: die Kaskade laesst niemanden uebrig.');
  }

  const rng = createSeededRng(seed);
  const phases = phaseDurations(durationPreset);
  const isCascade = cascade.length > 0;
  const budgets = cascadeBudgets(durationPreset, cascade.length + 1);

  /* --- Der Aufbau: ein vollständiges Segment über alle Spieler --- */
  const opening = buildSegment(
    {
      players,
      victimId,
      deathId,
      phases: isCascade
        ? cascadePhases(budgets.opening, 'opening', CASCADE.deathHoldMs)
        : phases,
      budgetMs: isCascade ? budgets.opening : DURATION_MS[durationPreset],
      fakeCount: isCascade ? 1 : CHOREO.fakeLocksByPreset[durationPreset],
      scanBeats: undefined,
      panicHoldMs: CHOREO.panicHoldMs,
      minPanicBeats: players.length === 2 ? CHOREO_FAIRNESS.minPanicBeatsTwoPlayers : 0,
      previousTarget: undefined,
    },
    rng,
    0
  );

  const beats: Beat[] = [...opening.beats];
  let t = opening.durationMs;
  let previousTarget: PlayerId | undefined = opening.lastTarget;

  /*
   * Double Tap: Nachschlag ohne neuen Aufbau (GDD §4.2).
   *
   * Der zählt bewusst **nicht** in die Preset-Dauer: Das Preset beschreibt den Aufbau bis
   * zum Schuss, und der ist bei zwei Opfern derselbe. Die Runde dauert dann eben länger
   * — das ist der Modus.
   */
  for (const extra of extraVictims) {
    beats.push({
      t,
      type: 'aim',
      target: extra.victimId,
      holdMs: CHOREO.doubleTapSwingMs,
      style: 'snap',
    });
    t += CHOREO.doubleTapSwingMs;

    beats.push({ t, type: 'lock', target: extra.victimId, holdMs: CHOREO.doubleTapLockMs });
    t += CHOREO.doubleTapLockMs;

    beats.push({ t, type: 'shot' });
    beats.push({ t, type: 'death', deathId: extra.deathId, victim: extra.victimId });
    t += phases.death;
  }

  /*
   * Showdown: Jedes weitere Opfer bekommt ein **eigenes** Segment über die noch
   * Lebenden — kurz in der Mitte, mit vollem Aufbau im Finale.
   *
   * Dass die Segmente eigene Spieler-Pools haben, ist nicht nur Kosmetik: Global
   * gerechnet gäbe es bei n−1 Opfern genau einen Nicht-Opfer, und die Regel „der letzte
   * Fake ist nie das Opfer" würde in jedem Segment den Gewinner verraten.
   */
  let alive = players.filter((player) => player !== victimId);
  cascade.forEach((entry, index) => {
    beats.push({ t, type: 'regroup', survivors: [...alive], holdMs: CASCADE.regroupMs });
    t += CASCADE.regroupMs;

    const isFinale = alive.length === 2;
    const budget = isFinale ? budgets.finale : (budgets.montage[index] ?? CASCADE.montageMinMs);
    const deathMs = isFinale ? CASCADE.finalDeathHoldMs : CASCADE.deathHoldMs;

    const segment = buildSegment(
      {
        players: alive,
        victimId: entry.victimId,
        deathId: entry.deathId,
        phases: cascadePhases(budget, isFinale ? 'finale' : 'montage', deathMs),
        budgetMs: budget,
        fakeCount: isFinale ? CHOREO.fakeLocksByPreset[durationPreset] : 0,
        scanBeats: isFinale ? undefined : 0,
        panicHoldMs: isFinale ? CHOREO.panicHoldMs : CASCADE.panicHoldMs,
        minPanicBeats: isFinale ? CHOREO_FAIRNESS.minPanicBeatsTwoPlayers : 0,
        previousTarget,
      },
      rng,
      t
    );

    beats.push(...segment.beats);
    t += segment.durationMs;
    previousTarget = segment.lastTarget;
    alive = alive.filter((player) => player !== entry.victimId);
  });

  beats.push({ t, type: 'outro' });

  return { totalMs: t, beats };
}

/* ------------------------------------------------------------------ */
/* Auswertung (Tests, Dev-Panel, Fairness-Audit)                       */
/* ------------------------------------------------------------------ */

/**
 * Zerlegt das Skript in seine Segmente, getrennt an den `regroup`-Beats.
 *
 * Ohne Kaskade ist das genau ein Segment — deshalb funktionieren die Auswertungen unten
 * für alle Modi gleich.
 */
export function segmentsOf(script: ShowScript): Beat[][] {
  const segments: Beat[][] = [[]];
  for (const beat of script.beats) {
    if (beat.type === 'regroup') {
      segments.push([]);
      continue;
    }
    segments[segments.length - 1]!.push(beat);
  }
  return segments;
}

/**
 * Verweilzeit des Reticles je Spieler vor dem Lock **dieses** Segments.
 *
 * Bei der Kaskade ist die segmentweise Betrachtung die einzige sinnvolle: Ein Segment ist
 * der Zeitraum, in dem ein Zuschauer überhaupt etwas vorhersagen könnte.
 */
export function dwellBeforeLockIn(beats: readonly Beat[]): Record<PlayerId, number> {
  const dwell: Record<PlayerId, number> = {};
  for (const beat of beats) {
    if (beat.type === 'lock') break;
    if (beat.type === 'aim' || beat.type === 'fakeLock') {
      dwell[beat.target] = (dwell[beat.target] ?? 0) + beat.holdMs;
    }
  }
  return dwell;
}

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
