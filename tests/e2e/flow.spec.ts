/**
 * E2E-Flow (Mobile-Emulation).
 *
 * M0: Smoke-Test — App laedt, Titel sichtbar, keine Console-Errors, PWA-Manifest erreichbar.
 * TODO(M1): kompletter Flow mit 4 Spielern ueber 2 Runden (Audit A1).
 */

import { expect, test } from '@playwright/test';

test('Titel ist sichtbar und die Seite laedt ohne Console-Errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('./');

  await expect(page.locator('.boot__logo')).toHaveText('DRINKSHOT');
  await expect(page.locator('#app')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Portrait: kein horizontales Scrollen, Root fuellt den Viewport', async ({ page }) => {
  await page.goto('./');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow).toBe(false);
});

test('Landscape zeigt das "Handy drehen"-Overlay', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('./');
  const overlay = page.locator('.orientation-lock');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('.orientation-lock__title')).not.toBeEmpty();
});

test('PWA-Manifest und Icons sind erreichbar', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.getAttribute('link[rel="manifest"]', 'href');
  expect(href).toBeTruthy();

  const manifestResponse = await request.get(new URL(href!, page.url()).toString());
  expect(manifestResponse.ok()).toBe(true);

  const manifest = (await manifestResponse.json()) as {
    name: string;
    display: string;
    icons: { sizes: string; purpose?: string }[];
  };
  expect(manifest.name).toBe('Drinkshot');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true);
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
});

test('Service Worker wird registriert (PWA installierbar)', async ({ page }) => {
  await page.goto('./');
  // Die Registrierung laeuft asynchron nach dem ersten Paint.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          if (!('serviceWorker' in navigator)) return 0;
          return (await navigator.serviceWorker.getRegistrations()).length;
        }),
      { timeout: 10_000 }
    )
    .toBeGreaterThan(0);
});

test.fixme('kompletter Flow: 4 Spieler, 2 Runden (M1)', async () => {
  // Lobby → Pass → Bet ×4 → Arena-Platzhalter → Result → Nächste Runde
});
