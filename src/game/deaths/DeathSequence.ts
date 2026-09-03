/**
 * Todesanimationen: Interface, Registry und Auswahl (Architektur §6).
 *
 * Jede Sequenz liefert eine fertige GSAP-Timeline **inklusive Sound-Cues**. Damit laufen
 * Bild und Ton zwangsläufig synchron — sie hängen an derselben Zeitachse und werden von
 * derselben Uhr getrieben (Architektur §7.7).
 *
 * Die Auswahl ist gewichtet und hat ein No-Repeat-Fenster: dieselbe Animation darf sich
 * in vier aufeinanderfolgenden Runden nicht wiederholen (GDD §10.4).
 */

import { DEATH_NO_REPEAT_MIN_POOL, DEATH_NO_REPEAT_WINDOW } from '@/config/rules';
import type { SeededRng } from '@/core/rng';
import type { DeathId, DeathZone } from '@/core/session';
import type { Arena } from '../Arena';
import type { Camera } from '../Camera';
import type { Scope } from '../Scope';
import type { Shotling } from '../Shotling';
import type { ParticlePool } from '../fx/ParticlePool';

/** Werkzeugkasten, den jede Sequenz bekommt. */
export interface FxKit {
  particles: ParticlePool;
  /** Layer für Grabsteine, Sprechblasen und alles, was über der Arena liegt. */
  overlay: Arena['actorLayer'];
}

export interface DeathAudio {
  /**
   * @param cue    Name des Sound-Cues
   * @param when   Vorlauf in Sekunden auf der Audio-Uhr — so lassen sich Cues exakt auf
   *               Key-Frames legen, statt sie im Frame-Loop zu triggern (Audit A3/A4).
   * @param detune Verstimmung in Halbtönen; variiert wiederholte Geräusche.
   */
  play(cue: string, when?: number, detune?: number): void;
}

export interface DeathContext {
  victim: Shotling;
  others: Shotling[];
  scope: Scope;
  camera: Camera;
  fx: FxKit;
  audio: DeathAudio;
  rng: SeededRng;
  arena: Arena;
}

export interface DeathSequence {
  id: DeathId;
  zone: DeathZone;
  /** Auswahl-Gewicht; `miracle` ist bewusst sehr klein. */
  weight: number;
  /** Braucht die Sequenz einen zweiten Schuss (Bein, Miss)? */
  needsSecondShot: boolean;
  /**
   * Optionaler Riegel: Manche Sequenzen brauchen eine Voraussetzung — `head_hat_launch`
   * etwa einen Hut, den rund 40 % der Männchen nicht tragen. Die Auswahl fragt vorher.
   */
  isEligible?(ctx: DeathContext): boolean;
  build(ctx: DeathContext): gsap.core.Timeline;
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

const registry = new Map<DeathId, DeathSequence>();

export function registerDeath(sequence: DeathSequence): void {
  if (registry.has(sequence.id)) {
    throw new Error(`DeathSequence "${sequence.id}" ist doppelt registriert.`);
  }
  registry.set(sequence.id, sequence);
}

export function getDeath(id: DeathId): DeathSequence | undefined {
  return registry.get(id);
}

export function allDeaths(): DeathSequence[] {
  return [...registry.values()];
}

export function deathZone(id: DeathId): DeathZone | undefined {
  return registry.get(id)?.zone;
}

/** Nur für Tests: Registry leeren. */
export function clearDeathRegistry(): void {
  registry.clear();
}

/* ------------------------------------------------------------------ */
/* Auswahl                                                             */
/* ------------------------------------------------------------------ */

export interface PickDeathOptions {
  rng: SeededRng;
  /** Die zuletzt gespielten IDs, neueste zuletzt. */
  recent?: readonly DeathId[];
  /** Sind Wunder erlaubt (Settings)? */
  miracles?: boolean;
  /**
   * Kontext für `isEligible`. Fehlt er (etwa bei der Ziehung, wo es noch keine Shotlings
   * gibt), werden Sequenzen mit Voraussetzung übersprungen — lieber eine Sequenz weniger
   * als eine, die nicht spielbar ist.
   */
  context?: DeathContext;
  /** Nur für Tests: statt der globalen Registry diese Liste verwenden. */
  pool?: readonly DeathSequence[];
}

/**
 * Gewichtete Auswahl mit No-Repeat-Fenster.
 *
 * Das Fenster greift nur, solange genug Sequenzen registriert sind — sonst hätte man in
 * M3 mit einer einzigen Animation gar keine Auswahl mehr.
 */
export function pickDeath(options: PickDeathOptions): DeathSequence {
  const all = options.pool ?? allDeaths();
  if (all.length === 0) throw new Error('Keine DeathSequence registriert.');

  const allowMiracles = options.miracles ?? true;
  let candidates: DeathSequence[] = all.filter(
    (sequence) => allowMiracles || sequence.zone !== 'miracle'
  );
  if (candidates.length === 0) candidates = [...all];

  // Voraussetzungen prüfen (z. B. „trägt einen Hut").
  const eligible = candidates.filter(
    (sequence) => !sequence.isEligible || (options.context && sequence.isEligible(options.context))
  );
  if (eligible.length > 0) candidates = eligible;

  if (candidates.length >= DEATH_NO_REPEAT_MIN_POOL) {
    const blocked = new Set((options.recent ?? []).slice(-DEATH_NO_REPEAT_WINDOW));
    const fresh = candidates.filter((sequence) => !blocked.has(sequence.id));
    if (fresh.length > 0) candidates = fresh;
  }

  return options.rng.weighted(candidates, (sequence) => sequence.weight);
}

/** Hält die zuletzt gespielten IDs für das No-Repeat-Fenster. */
export function pushRecent(recent: readonly DeathId[], id: DeathId): DeathId[] {
  return [...recent, id].slice(-DEATH_NO_REPEAT_WINDOW);
}
