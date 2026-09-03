import { createRequire } from 'node:module';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const require = createRequire(import.meta.url);
const pkg = require('./package.json') as { version: string };

/**
 * Vite-Konfiguration.
 * `base` = '/Drinkshot/' wegen GitHub Pages (Architektur §11).
 * Für lokale Netzwerk-Tests (`npm run dev`) laeuft der Dev-Server ueber `--host`.
 */
export default defineConfig({
  base: process.env.DRINKSHOT_BASE ?? '/Drinkshot/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    reportCompressedSize: true,
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      strategies: 'generateSW',
      injectRegister: null,
      manifest: false, // wir liefern public/manifest.webmanifest selbst aus
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,json,webmanifest,ogg,mp3}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
