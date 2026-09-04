/**
 * Referenz-Hash aller Show-Skripte.
 *
 * Die anderen Choreografie-Tests prüfen **Eigenschaften** — Fairness, Dauer,
 * Anti-Vorhersagbarkeit. Eine verschobene, aber immer noch faire Choreografie würden sie
 * durchwinken. Beim Umbau auf Segmente (Showdown-Kaskade) muss das Skript für die
 * bestehenden Modi aber **byte-identisch** bleiben, sonst sieht jede Runde anders aus als
 * vorher, ohne dass es jemand merkt.
 *
 * Ändert sich der Hash, ist das kein Testfehler, sondern eine Aussage: Die Show hat sich
 * geändert. Dann entweder die Änderung zurücknehmen — oder sie war beabsichtigt, dann
 * gehört der neue Hash hier rein **und** die Begründung in `docs/DECISIONS.md`.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DURATION_PRESETS } from '@/config/rules';
import { buildShowScript } from '@/core/choreographer';

const SEEDS = 500;

function hashAllScripts(): { count: number; digest: string } {
  const hash = createHash('sha256');
  let count = 0;

  for (let players = 2; players <= 8; players++) {
    const ids = Array.from({ length: players }, (_, index) => `p${index + 1}`);
    for (const preset of DURATION_PRESETS) {
      for (let seed = 0; seed < SEEDS; seed++) {
        // Opfer rotieren, damit jede Position einmal drankommt.
        const script = buildShowScript({
          players: ids,
          victimId: ids[seed % players]!,
          seed,
          durationPreset: preset,
          deathId: 'basic_fall',
        });
        hash.update(JSON.stringify(script));
        count += 1;
      }
    }
  }

  return { count, digest: hash.digest('hex') };
}

describe('Choreographer — Referenz-Hash', () => {
  it('erzeugt für 10.500 Kombinationen dasselbe Skript wie vor dem Segment-Umbau', () => {
    const { count, digest } = hashAllScripts();
    expect(count).toBe(7 * DURATION_PRESETS.length * SEEDS);
    expect(digest).toBe('6d60f55ff3496435a7fa4835ae2a7f6697eba770e0bde7e3489bbe4c396e1b2c');
  });
});
