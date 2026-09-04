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

import { DEATH_NO_REPEAT_MIN_POOL, DEATH_NO_REPEAT_WINDOW, MIRACLE_CHANCE } from '@/config/rules';
import type { SeededRng } from '@/core/rng';
import type { DeathId, DeathZone } from '@/core/session';
import { DEATH_CATALOG, type DeathMeta } from './catalog';
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
  /**
   * Ist dieser Tod das Ende der Runde? Im Showdown folgen weitere Schuesse — dann fehlt
   * die Schlussgeste (alle halten an, einer klatscht, Kamera-Nachbeben), damit die
   * Ueberlebenden weiterlaufen und sich die Runde nicht wie sechs Enden anfuehlt.
   * Default `true`.
   */
  settle?: boolean;
}

/** Eine Sequenz ist ihre Katalog-Beschreibung plus die Animation dazu. */
export interface DeathSequence extends DeathMeta {
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
  /** Ohne Angabe der ganze Katalog; Tests reichen eigene Listen herein. */
  pool?: readonly DeathMeta[];
}

/**
 * Auswahl der Todesanimation.
 *
 * Das Wunder läuft **nicht** über die Gewichte: Das GDD schreibt „1 von 40 Runden" fest
 * (§4.1), und ein Gewicht müsste bei jeder neuen Sequenz nachgerechnet werden, um dieselbe
 * Seltenheit zu behalten. Stattdessen wird die Chance zuerst gewürfelt; erst danach geht
 * es in die gewichtete Auswahl unter den übrigen.
 *
 * Das No-Repeat-Fenster greift nur, solange genug Sequenzen registriert sind — sonst hätte
 * man mit wenigen Animationen gar keine Auswahl mehr.
 */
export function pickDeath(options: PickDeathOptions): DeathMeta {
  const all = options.pool ?? DEATH_CATALOG;
  if (all.length === 0) throw new Error('Der Death-Katalog ist leer.');

  const allowMiracles = options.miracles ?? true;
  const miracles = all.filter((meta) => meta.zone === 'miracle');

  if (allowMiracles && miracles.length > 0 && options.rng.chance(MIRACLE_CHANCE)) {
    return options.rng.weighted(miracles, (meta) => meta.weight);
  }

  let candidates: DeathMeta[] = all.filter((meta) => meta.zone !== 'miracle');
  if (candidates.length === 0) candidates = [...all];

  if (candidates.length >= DEATH_NO_REPEAT_MIN_POOL) {
    const blocked = new Set((options.recent ?? []).slice(-DEATH_NO_REPEAT_WINDOW));
    const fresh = candidates.filter((meta) => !blocked.has(meta.id));
    if (fresh.length > 0) candidates = fresh;
  }

  return options.rng.weighted(candidates, (meta) => meta.weight);
}

/** Hält die zuletzt gespielten IDs für das No-Repeat-Fenster. */
export function pushRecent(recent: readonly DeathId[], id: DeathId): DeathId[] {
  return [...recent, id].slice(-DEATH_NO_REPEAT_WINDOW);
}
