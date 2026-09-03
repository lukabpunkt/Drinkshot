import { defineConfig, devices } from '@playwright/test';

/**
 * Mobile-Emulation ist Pflicht (CLAUDE.md "Mobile First").
 * Ab M1 laeuft `flow.spec.ts`, ab M3 `perf.spec.ts` (Architektur §12).
 */
export default defineConfig({
  testDir: './tests/e2e',
  /*
   * Bewusst **nicht** parallel: Ein grosser Teil der Tests spielt eine 10–22 s lange Show
   * in Echtzeit ab und misst dabei Wartezeiten. Laufen zwei davon gleichzeitig, nehmen
   * sie sich die CPU weg — die leichten Tests werden dadurch flaky und die Zeitmessungen
   * falsch. Ein Testlauf dauert so ein paar Minuten länger und ist dafür verlässlich.
   */
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
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
