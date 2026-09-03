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
    {
      name: 'Pixel 5',
      use: {
        ...devices['Pixel 5'],
        launchOptions: {
          /*
           * Ohne diese Flags rendert Headless-Chromium per SwiftShader in Software.
           * Die Arena läuft dann mit 30 statt 60 fps — eine Eigenschaft des Testrechners,
           * nicht des Spiels. `perf.spec.ts` erkennt den Software-Fall und sagt es.
           */
          args: ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist'],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/Drinkshot/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
