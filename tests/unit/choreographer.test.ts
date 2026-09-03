/**
 * Choreographer-Tests — werden in M3 mit dem Algorithmus geliefert
 * (docs/03-ARCHITECTURE.md §5, Audit A3).
 */

import { describe, expect, it } from 'vitest';
import { buildShowScript } from '@/core/choreographer';

describe('Choreographer (M3)', () => {
  it('ist in M0 noch nicht implementiert', () => {
    expect(() =>
      buildShowScript({
        players: ['p1', 'p2'],
        victimId: 'p1',
        seed: 1,
        durationPreset: 'normal',
        deathId: 'basic_fall',
      })
    ).toThrow(/M3/);
  });

  it.todo('Fairness: Opfer-Verweilzeit ≤ 1/n + 5 % über 10 000 Seeds');
  it.todo('der letzte Fake-Lock ist nie das Opfer');
  it.todo('bei 2 Spielern mindestens 4 Aim-Beats in der Panik-Phase');
  it.todo('gleicher Seed ⇒ identisches ShowScript');
  it.todo('nie zweimal hintereinander dasselbe Ziel');
  it.todo('Gesamtdauer entspricht dem Dauer-Preset ± 1 s');
});
