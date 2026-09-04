/**
 * Katalog der Todesanimationen — **ohne** ihre Implementierungen.
 *
 * Die Ziehung braucht nur zu wissen, *welche* Sequenzen es gibt, mit welchem Gewicht und
 * in welcher Zone. Die Animationen selbst ziehen PIXI, GSAP und den halben Renderer nach
 * sich; lägen sie im selben Modul, müsste jeder Spieler das komplette Rendering-Paket
 * laden, bevor er auch nur den Titelbildschirm sieht (Roadmap M5.10).
 *
 * Damit Katalog und Registry nicht auseinanderlaufen, holt sich **jede** Sequenz ihre
 * Metadaten von hier — und ein Unit-Test prüft, dass beide Seiten deckungsgleich sind.
 */

import type { DeathId, DeathZone } from '@/core/session';

export interface DeathMeta {
  id: DeathId;
  zone: DeathZone;
  /** Auswahl-Gewicht innerhalb der normalen Tode. */
  weight: number;
  /** Braucht die Sequenz einen zweiten Schuss (Bein, Miss)? */
  needsSecondShot: boolean;
  /**
   * Setzt die Sequenz einen Hut voraus? `head_hat_launch` schiesst ihn weg — ohne Hut
   * gäbe es nichts zu sehen. Statt die Sequenz auszuschliessen, bekommt das Opfer in
   * dieser Runde einen (ADR-34): Hüte sind ohnehin reine Zierde und werden pro Runde neu
   * gewürfelt.
   */
  requiresHat?: boolean;
}

export const DEATH_CATALOG: readonly DeathMeta[] = [
  { id: 'head_helmet_spin', zone: 'head', weight: 10, needsSecondShot: false },
  { id: 'head_hat_launch', zone: 'head', weight: 10, needsSecondShot: false, requiresHat: true },
  { id: 'head_xray', zone: 'head', weight: 9, needsSecondShot: false },
  { id: 'body_dramatic', zone: 'body', weight: 10, needsSecondShot: false },
  { id: 'body_deflate', zone: 'body', weight: 9, needsSecondShot: false },
  { id: 'body_freeze_shatter', zone: 'body', weight: 9, needsSecondShot: false },
  { id: 'leg_hop', zone: 'leg', weight: 10, needsSecondShot: true },
  { id: 'leg_spin', zone: 'leg', weight: 9, needsSecondShot: true },
  { id: 'butt_rocket', zone: 'butt', weight: 10, needsSecondShot: false },
  { id: 'butt_hotfoot', zone: 'butt', weight: 9, needsSecondShot: false },
  { id: 'miss_then_hit', zone: 'miss', weight: 8, needsSecondShot: true },
  { id: 'miracle_dodge', zone: 'miracle', weight: 1, needsSecondShot: false },
  /* Der schlichte Umfaller bleibt als ruhiger Kontrast zwischen den grösseren Gags. */
  { id: 'basic_fall', zone: 'body', weight: 3, needsSecondShot: false },
] as const;

const BY_ID = new Map(DEATH_CATALOG.map((meta) => [meta.id, meta]));

export function deathMeta(id: DeathId): DeathMeta {
  const meta = BY_ID.get(id);
  if (!meta) throw new Error(`Keine Katalog-Daten für "${id}".`);
  return meta;
}
