/**
 * Choreographer — erzeugt aus (players, victimId, seed, durationPreset, deathId)
 * das deterministische `ShowScript` fuer den ShowDirector.
 *
 * **Er inszeniert nur.** Das Opfer steht bereits fest (ADR-2); der Choreographer
 * darf es niemals aendern und nutzt ausschliesslich den seedbaren PRNG aus `rng.ts`.
 *
 * TODO(M3): Algorithmus nach docs/03-ARCHITECTURE.md §5 implementieren
 *           (Phasen-Budget, seeded Fisher-Yates-Scan, Panik-Beats, Fake-Locks, Lock).
 *           Unit-Tests: Fairness ueber 10 000 Seeds, letzter Fake != Opfer,
 *           2-Spieler-Minimum, Determinismus bei gleichem Seed.
 */

import type { DurationPreset } from '@/config/rules';
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

export function buildShowScript(_input: ChoreographyInput): ShowScript {
  throw new Error('buildShowScript wird in M3 implementiert (docs/04-ROADMAP.md).');
}
