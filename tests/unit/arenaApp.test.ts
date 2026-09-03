/**
 * Tests der Low-Effects-Erkennung (Architektur §7.9, Roadmap M2.8).
 *
 * Der Browser-Teil des A2-Checks (CPU-Drossel 6×) schlägt in M2 nicht an, weil die
 * Szene selbst gedrosselt bei ~16.7 ms bleibt. Getestet wird deshalb der Mechanismus:
 * Geräte-Schwellen und Frame-Median.
 */

import { describe, expect, it } from 'vitest';
import { RENDER } from '@/config/theme';
import { detectLowEffects, frameMedian } from '@/game/ArenaApp';

describe('detectLowEffects — Geräte-Schwellen', () => {
  it('greift bei wenig Arbeitsspeicher', () => {
    expect(detectLowEffects({ deviceMemory: RENDER.lowEffects.deviceMemoryMax })).toBe(true);
    expect(detectLowEffects({ deviceMemory: RENDER.lowEffects.deviceMemoryMax + 1 })).toBe(false);
  });

  it('greift bei wenigen Kernen', () => {
    expect(detectLowEffects({ hardwareConcurrency: RENDER.lowEffects.hardwareConcurrencyMax })).toBe(
      true
    );
    expect(
      detectLowEffects({ hardwareConcurrency: RENDER.lowEffects.hardwareConcurrencyMax + 1 })
    ).toBe(false);
  });

  it('bleibt aus, wenn das Gerät nichts meldet', () => {
    expect(detectLowEffects({})).toBe(false);
  });

  it('reicht ein erfülltes Kriterium', () => {
    expect(detectLowEffects({ deviceMemory: 8, hardwareConcurrency: 2 })).toBe(true);
    expect(detectLowEffects({ deviceMemory: 2, hardwareConcurrency: 16 })).toBe(true);
  });
});

describe('frameMedian', () => {
  it('liefert 0 ohne Messwerte', () => {
    expect(frameMedian([])).toBe(0);
  });

  it('nimmt bei ungerader Anzahl den mittleren Wert', () => {
    expect(frameMedian([30, 10, 20])).toBe(20);
  });

  it('mittelt bei gerader Anzahl', () => {
    expect(frameMedian([10, 20, 30, 40])).toBe(25);
  });

  it('lässt die übergebene Liste unverändert', () => {
    const times = [30, 10, 20];
    frameMedian(times);
    expect(times).toEqual([30, 10, 20]);
  });

  it('trennt an der Schwelle aus §7.9 sauber', () => {
    const threshold = RENDER.lowEffects.frameMedianMaxMs;
    // 60 fps: weit unter der Schwelle.
    expect(frameMedian(Array.from({ length: 120 }, () => 16.7))).toBeLessThan(threshold);
    // ~30 fps: darüber, Low-Effects müsste greifen.
    expect(frameMedian(Array.from({ length: 120 }, () => 33.3))).toBeGreaterThan(threshold);
  });
});
