/**
 * Performance-Test der Arena (docs/03-ARCHITECTURE.md §12).
 *
 * Faellt fehl, wenn im Normal-Modus bei 8 Spielern und CPU-Throttling 4x:
 *   p50 Frame-Time > 20 ms  ·  p95 > 40 ms  ·  > 2 Long-Tasks (> 50 ms) waehrend der Death-Sequenz
 *
 * TODO(M3): aktivieren, sobald die Arena existiert (Audit A3).
 */

import { test } from '@playwright/test';

test.fixme('Arena mit 8 Shotlings: p50 ≤ 20 ms, p95 ≤ 40 ms bei CPU-Throttle 4x', async () => {
  // Umsetzung in M3: CDP `Emulation.setCPUThrottlingRate`, 10 s rAF-Sampling im Dev-Panel.
});
