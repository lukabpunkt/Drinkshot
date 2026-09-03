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
import { createSessionStore, resolveRound } from '@/core/session';
import { arenaUpdateTimes, preloadArenaAssets } from '@/game/ArenaApp';
import { confirmSheet } from '@/ui/components/sheet';
import { showToast } from '@/ui/components/toast';
import { setHapticsEnabled } from '@/ui/haptics';
import { createRouter, type ScreenId } from '@/ui/router';
import { createArenaScreen } from '@/ui/screens/ArenaScreen';
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
router.register('arena', createArenaScreen);
router.register('result', createResultScreen);

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
 * Preload der Arena-Assets während der Betting-Phase (Architektur §7.12).
 * Die dauert ohnehin ≥ 10 s — beim Betreten der Arena darf nichts mehr nachladen.
 */
fsm.on('PASS', { enter: () => preloadArenaAssets() });

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
void router.go(SCREEN_FOR_STATE[fsm.state]);
void registerServiceWorker();

if (dev) {
  Object.assign(globalThis, {
    drinkshot: {
      fsm,
      session,
      router,
      /** Von `perf.spec.ts` gelesen: reine JS-Zeit pro Frame (Architektur §7.10). */
      arenaUpdateTimes: () => arenaUpdateTimes(),
    },
  });
}
