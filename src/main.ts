/**
 * Bootstrap.
 *
 * Verdrahtet Session-Store, FSM und Router. Die FSM entscheidet, der Router zeigt an —
 * Screens senden nur Events und lesen den Zustand. Die Ziehung passiert ausschliesslich
 * in der FSM beim letzten `confirm` (ADR-2); dieser Bootstrap fasst sie nicht an.
 */

import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/components.css';

import { setAudioEnabled } from '@/audio/AudioManager';
import { colorById, hex, UI_COLORS } from '@/config/theme';
import { detectLocale, setLocale, t } from '@/core/i18n';
import { createFsm, type GameState, type Transition } from '@/core/fsm';
import { createRoundSetup, createSessionStore, resolveRound } from '@/core/session';
import { DEATH_CATALOG, deathMeta, type DeathMeta } from '@/game/deaths/catalog';
import { pickDeath } from '@/game/deaths/DeathSequence';
import { confirmSheet } from '@/ui/components/sheet';
import { showToast } from '@/ui/components/toast';
import { setHapticsEnabled } from '@/ui/haptics';
import { createRouter, type ScreenContext, type ScreenId, type ScreenInstance } from '@/ui/router';
// Nur als Typ — der Import wird beim Bauen entfernt, das Modul kommt zur Laufzeit.
import type * as ArenaScreenModule from '@/ui/screens/ArenaScreen';
import { createBetScreen } from '@/ui/screens/BetScreen';
import { createLobbyScreen } from '@/ui/screens/LobbyScreen';
import { createPassScreen } from '@/ui/screens/PassScreen';
import { createResultScreen } from '@/ui/screens/ResultScreen';
import { createTitleScreen } from '@/ui/screens/TitleScreen';

const params = new URLSearchParams(globalThis.location?.search ?? '');
const dev = params.get('dev') === '1';

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

const session = createSessionStore();
const settings = session.state.settings;

// Gespeicherte Sprache gewinnt, sonst Browser-Sprache, sonst DE (GDD §8).
setLocale(settings.locale ?? detectLocale());
setAudioEnabled(settings.sound);
setHapticsEnabled(settings.haptics);

/* ------------------------------------------------------------------ */
/* FSM                                                                 */
/* ------------------------------------------------------------------ */

const fsm = createFsm({
  players: session.activePlayers().map((player) => player.id),
  mode: settings.mode,
  durationPreset: settings.duration,

  /**
   * Die Ziehung des Opfers bleibt in `lottery.ts` (ADR-2). Hier kommt nur die
   * **Inszenierung** dazu: welche Todesanimation gespielt wird. Sie hängt am Seed der
   * Runde, nicht am sicheren Zufall — die Show soll reproduzierbar sein.
   */
  drawRound: (bets, mode, duration) =>
    createRoundSetup(bets, mode, duration, (rng) => {
      /*
       * `?dev=1&death=<id>` erzwingt eine bestimmte Sequenz. Gebraucht wird das für
       * Tests und für den Blick auf seltene Ausgänge: Auf das Wunder müsste man sonst
       * im Schnitt vierzig Runden warten.
       */
      const forcedId = dev ? params.get('death') : null;
      const forced: DeathMeta | undefined =
        forcedId && DEATH_CATALOG.some((meta) => meta.id === forcedId)
          ? deathMeta(forcedId)
          : undefined;

      const meta =
        forced ??
        pickDeath({
          rng,
          recent: session.state.rounds.slice(-4).map((round) => round.deathId),
          miracles: session.state.settings.miracles,
        });
      return { deathId: meta.id, zone: meta.zone };
    }),
  ...(dev
    ? {
        onTransition: ({ from, to, event }: Transition) => {
          console.info(`[fsm] ${from} --${event.type}--> ${to}`);
        },
      }
    : {}),
});

/**
 * ARENA → RESULT: Hier wird die Runde abgerechnet. `resolveRound` wendet nur die
 * Modus-Regeln an (GDD §3.6) — das Opfer steht seit BET→ARENA fest.
 * Als `enter`-Hook registriert, damit die Runde im Store steht, bevor der
 * Result-Screen gemountet wird.
 */
fsm.on('RESULT', {
  enter: (context) => {
    if (!context.round) return;
    session.recordRound(resolveRound(context.round));
  },
});

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

const host = document.querySelector<HTMLElement>('#app');
if (!host) throw new Error('#app fehlt in index.html');

const router = createRouter({ host, context: { fsm, session, dev } });

router.register('title', createTitleScreen);
router.register('lobby', createLobbyScreen);
router.register('pass', createPassScreen);
router.register('bet', createBetScreen);
/*
 * Die Arena wird **nachgeladen**: PIXI, GSAP, die Filter und alle dreizehn
 * Todesanimationen machen den grössten Teil des Codes aus, werden aber erst gebraucht,
 * wenn die Runde läuft. Bis dahin lädt niemand mehr als die Menüs (Roadmap M5.10).
 */
router.register('arena', createLazyArenaScreen);
router.register('result', createResultScreen);

/**
 * Platzhalter-Screen, der den echten Arena-Screen nachlädt.
 *
 * Der Router mountet synchron; der Arena-Code kommt asynchron. Der Platzhalter zeigt
 * währenddessen den schwarzen Hintergrund, den die Arena ohnehin hat — man sieht keinen
 * Übergang. In der Praxis ist das Modul längst da, weil es beim Betreten der Lobby
 * vorgeladen wird.
 */
function createLazyArenaScreen(context: ScreenContext): ScreenInstance {
  const el = document.createElement('section');
  el.className = 'screen screen--arena is-loading';

  let inner: ScreenInstance | undefined;
  let disposed = false;

  void loadArenaScreen()
    .then(({ createArenaScreen }) => {
      if (disposed) return;
      inner = createArenaScreen(context);
      el.replaceWith(inner.el);
      inner.el.dataset.screen = 'arena';
      inner.activate?.();
    })
    .catch((error) => {
      console.error('[arena] Modul konnte nicht geladen werden', error);
      showToast(t('error.generic'), { variant: 'danger' });
      context.fsm.send({ type: 'showFinished' });
    });

  return {
    el,
    destroy() {
      disposed = true;
      inner?.destroy?.();
    },
  };
}

/** Ein Modul-Handle, damit Vite daraus einen eigenen Chunk schneidet. */
type ArenaModule = typeof ArenaScreenModule;

function loadArenaScreen(): Promise<ArenaModule> {
  return import('@/ui/screens/ArenaScreen');
}

const SCREEN_FOR_STATE: Record<GameState, ScreenId> = {
  TITLE: 'title',
  LOBBY: 'lobby',
  PASS: 'pass',
  BET: 'bet',
  ARENA: 'arena',
  RESULT: 'result',
};

/** Die Wipe-Farbe traegt Bedeutung: in PASS/BET die Spielerfarbe, im Reveal die des Opfers. */
function wipeColor(state: GameState): string {
  const context = fsm.context;

  if (state === 'PASS' || state === 'BET') {
    const playerId = context.players[context.playerIndex];
    const player = playerId ? session.playerById(playerId) : undefined;
    if (player) return hex(colorById(player.colorId).hex);
  }

  if (state === 'RESULT') {
    const rounds = session.state.rounds;
    const victimId = rounds[rounds.length - 1]?.victimId;
    const victim = victimId ? session.playerById(victimId) : undefined;
    if (victim) return hex(colorById(victim.colorId).hex);
  }

  return hex(UI_COLORS.accent);
}

const BACK_EVENTS = new Set(['cancel', 'changePlayers']);

/**
 * Vorladen in zwei Stufen (Architektur §7.12, Roadmap M5.10):
 *
 * - **Lobby**: der Arena-*Code*. Dort steht man mindestens ein paar Sekunden, und der
 *   Chunk ist damit da, bevor die erste Runde beginnt.
 * - **Pass**: die *Atlanten*. Die Betting-Phase dauert ohnehin ≥ 10 s — beim Betreten der
 *   Arena darf nichts mehr nachgeladen werden.
 */
fsm.on('LOBBY', {
  enter: () => {
    void loadArenaScreen().catch(() => undefined);
  },
});

fsm.on('PASS', {
  enter: () => {
    void loadArenaScreen()
      .then((module) => module.preloadArena())
      .catch(() => undefined);
  },
});

fsm.subscribe(({ to, event }) => {
  void router.go(SCREEN_FOR_STATE[to], {
    direction: BACK_EVENTS.has(event.type) ? 'back' : 'forward',
    color: wipeColor(to),
  });
  updateHistoryGuard(to);
});

/* ------------------------------------------------------------------ */
/* Zurück-Button (Roadmap M1.11)                                       */
/* ------------------------------------------------------------------ */

/** In diesen States kostet ein Zurück die laufende Runde — also erst fragen. */
const GUARDED: ReadonlySet<GameState> = new Set<GameState>(['PASS', 'BET', 'ARENA']);

let guarded = false;
let dialogOpen = false;

function pushGuard(): void {
  globalThis.history?.pushState({ drinkshot: 'round' }, '');
  guarded = true;
}

function updateHistoryGuard(state: GameState): void {
  if (GUARDED.has(state)) {
    if (!guarded) pushGuard();
  } else {
    guarded = false;
  }
}

globalThis.addEventListener('popstate', () => {
  const state = fsm.state;

  if (GUARDED.has(state)) {
    if (dialogOpen) return;
    // Erst den Eintrag zurücklegen, damit wir stehen bleiben, während gefragt wird.
    pushGuard();
    dialogOpen = true;
    void confirmSheet({
      title: t('arena.abortRound'),
      body: t('arena.abortBody'),
      confirmLabel: t('arena.abortConfirm'),
      cancelLabel: t('arena.abortCancel'),
    }).then((confirmed) => {
      dialogOpen = false;
      if (confirmed) {
        guarded = false;
        fsm.send({ type: 'cancel' });
      }
    });
    return;
  }

  if (state === 'RESULT') fsm.send({ type: 'changePlayers' });
});

/* ------------------------------------------------------------------ */
/* Statische Texte & Service Worker                                    */
/* ------------------------------------------------------------------ */

/** Fuellt alle `[data-i18n]`-Knoten — kein UI-String steht im HTML. */
function applyStaticTranslations(root: ParentNode = document): void {
  for (const node of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = node.dataset.i18n;
    if (key) node.textContent = t(key);
  }
}

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const { registerSW } = await import('virtual:pwa-register');
    const update = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        showToast(t('pwa.updateAvailable'), {
          durationMs: 8000,
          action: { label: t('pwa.reload'), onClick: () => void update(true) },
        });
      },
      onOfflineReady: () => {
        if (dev) console.info('[pwa]', t('pwa.offlineReady'));
      },
    });
  } catch (error) {
    console.warn('[pwa] Registrierung fehlgeschlagen', error);
  }
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

applyStaticTranslations();

/*
 * `npm run preview:deaths` öffnet `?dev=1&panel=deaths`. Damit man die Sequenzen ansehen
 * kann, ohne jedes Mal eine Runde durchzuklicken, springt die App dann direkt in die
 * Arena: zwei Spieler, feste Einsätze, Show im Hold-Modus.
 */
function startDeathPreview(): boolean {
  if (!dev || params.get('panel') !== 'deaths') return false;

  session.ensureMinimumPlayers((index) => t('lobby.defaultName', { index }));
  const players = session.activePlayers().map((player) => player.id);
  if (players.length < 2) return false;

  fsm.setPlayers(players);
  fsm.send({ type: 'start' });
  fsm.send({ type: 'begin' });
  for (let i = 0; i < players.length; i++) {
    fsm.send({ type: 'tap' });
    fsm.send({ type: 'confirm', sips: 3 });
  }
  return true;
}

if (!startDeathPreview()) {
  void router.go(SCREEN_FOR_STATE[fsm.state]);
}
void registerServiceWorker();

if (dev) {
  /*
   * Der Dev-Zugriff hängt am nachgeladenen Arena-Modul, damit `main.ts` selbst kein PIXI
   * importiert. Solange die Arena noch nicht geladen ist, gibt es eben nichts zu messen.
   */
  let arenaModule: ArenaModule | undefined;
  void loadArenaScreen().then((module) => {
    arenaModule = module;
  });

  Object.assign(globalThis, {
    drinkshot: {
      fsm,
      session,
      router,
      /** Von `perf.spec.ts` gelesen: reine JS-Zeit pro Frame (Architektur §7.10). */
      arenaUpdateTimes: () => arenaModule?.arenaDevHandle.updateTimes() ?? [],
      /** Aktuelle Arena-Geometrie — Werkzeuge schneiden Screenshots daraus zu. */
      arenaLayout: () => arenaModule?.arenaDevHandle.layout(),
    },
  });
}
