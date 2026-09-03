/**
 * Bootstrap.
 *
 * M0: Tokens/Styles laden, i18n initialisieren, Store und FSM aufsetzen (nur Logging,
 * noch keine Screens), Boot-Screen mit dem Titel rendern, Service Worker registrieren.
 *
 * TODO(M1): Router einhaengen (`ui/router.ts`), Audio-Unlock beim ersten Tap,
 *           Screens an die FSM-Hooks binden.
 */

import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/components.css';

import { DEFAULT_SETTINGS } from '@/config/rules';
import { detectLocale, setLocale, t } from '@/core/i18n';
import { createFsm, type Transition } from '@/core/fsm';
import { createStore } from '@/core/store';
import { loadSession, type Session } from '@/core/session';

/* ------------------------------------------------------------------ */
/* App-Store                                                           */
/* ------------------------------------------------------------------ */

interface AppState {
  session: Session;
  /** Dev-Panel via `?dev=1` (Architektur §9). */
  dev: boolean;
}

const params = new URLSearchParams(globalThis.location?.search ?? '');

const session = loadSession();
export const store = createStore<AppState>({
  session,
  dev: params.get('dev') === '1',
});

/* ------------------------------------------------------------------ */
/* i18n                                                                */
/* ------------------------------------------------------------------ */

// Gespeicherte Sprache gewinnt, sonst Browser-Sprache, sonst DE (GDD §8).
setLocale(session.settings.locale ?? detectLocale() ?? DEFAULT_SETTINGS.locale);

/** Fuellt alle `[data-i18n]`-Knoten — kein UI-String steht im HTML. */
function applyStaticTranslations(root: ParentNode = document): void {
  for (const node of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = node.dataset.i18n;
    if (key) node.textContent = t(key);
  }
}

/* ------------------------------------------------------------------ */
/* FSM (M0: nur Logging)                                               */
/* ------------------------------------------------------------------ */

export const fsm = createFsm({
  players: session.players.map((player) => player.id),
  mode: session.settings.mode,
  durationPreset: session.settings.duration,
  onTransition: ({ from, to, event }: Transition) => {
    if (!store.get().dev) return;
    console.info(`[fsm] ${from} --${event.type}--> ${to}`);
  },
});

/* ------------------------------------------------------------------ */
/* Boot-Screen                                                         */
/* ------------------------------------------------------------------ */

function renderBootScreen(host: HTMLElement): void {
  host.replaceChildren();

  const wrapper = document.createElement('div');
  wrapper.className = 'boot';

  const logo = document.createElement('h1');
  logo.className = 'boot__logo';
  logo.textContent = t('app.name').toUpperCase();

  const tagline = document.createElement('p');
  tagline.className = 'boot__tagline';
  tagline.textContent = t('app.tagline');

  const version = document.createElement('p');
  version.className = 'boot__version';
  version.textContent = `v${__APP_VERSION__} · ${fsm.state}`;

  wrapper.append(logo, tagline, version);
  host.append(wrapper);
}

/* ------------------------------------------------------------------ */
/* Service Worker                                                      */
/* ------------------------------------------------------------------ */

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const { registerSW } = await import('virtual:pwa-register');
    registerSW({
      immediate: true,
      // TODO(M6): Update-Toast statt stillem Reload (`pwa.updateAvailable`).
      onNeedRefresh: () => console.info('[pwa]', t('pwa.updateAvailable')),
      onOfflineReady: () => console.info('[pwa]', t('pwa.offlineReady')),
    });
  } catch (error) {
    console.warn('[pwa] Registrierung fehlgeschlagen', error);
  }
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

function boot(): void {
  const host = document.querySelector<HTMLElement>('#app');
  if (!host) throw new Error('#app fehlt in index.html');

  applyStaticTranslations();
  renderBootScreen(host);
  void registerServiceWorker();
}

boot();
