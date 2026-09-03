import { defineConfig, devices } from '@playwright/test';

/**
 * Mobile-Emulation ist Pflicht (CLAUDE.md "Mobile First").
 * Ab M1 laeuft `flow.spec.ts`, ab M3 `perf.spec.ts` (Architektur §12).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:4173/Drinkshot/',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'iPhone 12', use: { ...devices['iPhone 12'] } },
    { name: 'Pixel 5', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/Drinkshot/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
