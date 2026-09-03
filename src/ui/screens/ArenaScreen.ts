/**
 * Arena-Screen — hostet das PIXI-Canvas (Roadmap M2.7).
 *
 * M2 zeigt die lebendige Welt: Shotlings laufen, blinzeln, weichen sich aus. Es gibt noch
 * kein Scope und keinen Schuss — nach einer festen Vorführdauer meldet der Screen
 * `showFinished`, damit der Flow aus M1 weiterläuft.
 *
 * TODO(M3): ShowDirector, Scope, Choreografie, echter Schuss; Wake-Lock scharf schalten.
 */

import { ARENA, colorById, hex, shotlingHeightFor } from '@/config/theme';
import { createSeededRng } from '@/core/rng';
import { t } from '@/core/i18n';
import { showToast } from '@/ui/components/toast';
import { vibrate } from '@/ui/haptics';
import type { ScreenContext, ScreenInstance } from '@/ui/router';
import { Arena } from '@/game/Arena';
import {
  areArenaAssetsReady,
  detectLowEffects,
  getArenaApp,
  loadArenaAssets,
  measureLowEffects,
  type ArenaAppHandle,
} from '@/game/ArenaApp';
import { Shotling } from '@/game/Shotling';
import { resolveOverlaps, ShotlingBrain } from '@/game/ShotlingBrain';
import { createDevPanel, type DevPanel } from '@/ui/components/devPanel';

/** Wie lange die Vorführung in M2 läuft, bis es weitergeht. */
const SHOW_MS = 6000;
const SHOT_HOLD_MS = 1400;

/**
 * `?dev=1&hold=1` hält die Arena offen, statt nach der Vorführung weiterzuschalten.
 * Nur so kann `perf.spec.ts` über 10 s messen (Architektur §12).
 */
function isHoldMode(dev: boolean): boolean {
  if (!dev) return false;
  return new URLSearchParams(globalThis.location?.search ?? '').get('hold') === '1';
}

/**
 * Wake-Lock-Stub (GDD §6). Wird in M3 scharf geschaltet, wenn die Show wirklich
 * 10–22 s ohne Eingabe läuft. Hier schon gekapselt, damit M3 nur noch aufrufen muss.
 */
function requestWakeLock(): () => void {
  // TODO(M3): navigator.wakeLock.request('screen') anfordern und nach `visibilitychange` erneuern.
  return () => {
    /* noop bis M3 */
  };
}

export function createArenaScreen(ctx: ScreenContext): ScreenInstance {
  const round = ctx.fsm.context.round;
  const victim = round ? ctx.session.playerById(round.victimId) : undefined;

  const el = document.createElement('section');
  el.className = 'screen screen--arena';

  const hud = document.createElement('p');
  hud.className = 'arena__hud';
  hud.textContent = t('arena.hud', {
    round: ctx.fsm.context.roundNumber + 1,
    count: ctx.fsm.context.players.length,
  });

  /** Das PIXI-Canvas hängt hier drin und füllt den Screen. */
  const stage = document.createElement('div');
  stage.className = 'arena__canvas';

  const overlay = document.createElement('div');
  overlay.className = 'arena__overlay';

  const shot = document.createElement('p');
  shot.className = 'arena__shot';
  shot.textContent = t('arena.shot');
  shot.hidden = true;

  const victimName = document.createElement('p');
  victimName.className = 'arena__victim';
  victimName.hidden = true;
  if (victim) {
    victimName.textContent = victim.name;
    victimName.style.setProperty('--victim-color', hex(colorById(victim.colorId).hex));
  }

  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'arena__skip';
  skip.textContent = t('arena.skip');
  skip.hidden = true;

  overlay.append(shot, victimName);
  el.append(stage, hud, overlay, skip);

  /* ------------------------------------------------------------------ */

  const timers: ReturnType<typeof setTimeout>[] = [];
  let releaseWakeLock: (() => void) | undefined;
  let finished = false;
  let disposed = false;
  let handle: ArenaAppHandle | undefined;
  let devPanel: DevPanel | undefined;
  let tickerFn: ((ticker: { deltaMS: number }) => void) | undefined;

  const finish = (): void => {
    if (finished || disposed) return;
    finished = true;
    ctx.fsm.send({ type: 'showFinished' });
  };

  skip.addEventListener('click', finish);

  async function build(): Promise<void> {
    let assets;
    try {
      assets = await loadArenaAssets();
    } catch (error) {
      // Atlas-Fehler darf die Runde nicht killen — Ergebnis steht ohnehin schon fest.
      console.error('[arena] Atlas konnte nicht geladen werden', error);
      showToast(t('error.generic'), { variant: 'danger' });
      timers.push(globalThis.setTimeout(finish, 1200));
      return;
    }
    if (disposed) return;

    handle = await getArenaApp();
    if (disposed) return;

    handle.clearWorld();
    handle.attach(stage);

    const seed = round?.seed ?? 1;
    const rng = createSeededRng(seed);

    const arena = new Arena({ sheet: assets.props, rng });
    handle.world.addChild(arena.view);

    /* --- Ein Shotling je Spieler, in Spielerfarbe --- */
    const players = ctx.fsm.context.players.length
      ? ctx.fsm.context.players
      : ctx.session.activePlayers().map((player) => player.id);

    let lowEffects = ctx.session.state.settings.lowEffects || detectLowEffects();

    const shotlings: Shotling[] = [];
    const brains: ShotlingBrain[] = [];
    // Weniger Männchen = mehr Platz = größer zeichnen (ADR-13).
    let height = shotlingHeightFor(players.length);

    const spawn = (colorId: ReturnType<typeof colorById>['id'], slotCount: number): Shotling => {
      const brain = new ShotlingBrain({
        centerX: arena.centerX,
        centerY: arena.centerY,
        radius: arena.walkRadius,
        rng,
        separation: height * ARENA.separationFactor,
        slot: { index: shotlings.length, count: slotCount },
      });
      const shotling = new Shotling({
        sheet: assets.shotlings,
        colorId,
        brain,
        rng,
        lowEffects,
        height,
      });
      arena.actorLayer.addChild(shotling.view);
      shotlings.push(shotling);
      brains.push(brain);
      return shotling;
    };

    for (const playerId of players) {
      const player = ctx.session.playerById(playerId);
      spawn(player?.colorId ?? 'red', players.length);
    }
    resolveOverlaps(brains);

    /* --- Frame-Loop: keine Allokationen (Architektur §7.11) --- */
    tickerFn = (ticker) => {
      const dt = ticker.deltaMS;
      for (let i = 0; i < brains.length; i++) brains[i]!.update(dt, brains);
      // Zweiter Durchgang: garantiert den Mindestabstand, auch im Gedränge.
      resolveOverlaps(brains);
      for (let i = 0; i < shotlings.length; i++) shotlings[i]!.update(dt);
    };
    handle.app.ticker.add(tickerFn);

    /* --- Low-Effects nachmessen (Architektur §7.9) --- */
    void measureLowEffects(handle).then((slow) => {
      if (disposed || !slow || lowEffects) return;
      lowEffects = true;
      for (const shotling of shotlings) shotling.setLowEffects(true);
      devPanel?.setLowEffects(true);
    });

    /* --- Dev-Panel (Architektur §9) --- */
    if (ctx.dev && handle) {
      devPanel = createDevPanel({
        host: el,
        app: handle,
        initialCount: shotlings.length,
        lowEffects,
        onSpeedChange: (multiplier) => {
          for (const brain of brains) brain.speedMultiplier = multiplier;
        },
        onCountChange: (count) => {
          while (shotlings.length > count) {
            const removed = shotlings.pop();
            brains.pop();
            removed?.destroy();
          }
          height = shotlingHeightFor(count);
          while (shotlings.length < count) {
            spawn(colorById(COLOR_CYCLE[shotlings.length % COLOR_CYCLE.length]!).id, count);
          }
        },
        onLowEffectsChange: (value) => {
          lowEffects = value;
          for (const shotling of shotlings) shotling.setLowEffects(value);
        },
      });
    }

    /* --- Ablauf: kurze Vorführung, dann der Platzhalter-Schuss --- */
    if (isHoldMode(ctx.dev)) return; // Perf-Messung: Arena bleibt stehen

    timers.push(
      globalThis.setTimeout(() => {
        if (disposed) return;
        // Das Opfer steht seit BET→ARENA fest — hier wird es nur noch gezeigt (ADR-2).
        const victimIndex = players.indexOf(round?.victimId ?? '');
        shotlings[victimIndex]?.setState('dead');
        shot.hidden = false;
        victimName.hidden = false;
        skip.hidden = false;
        vibrate('shot');
        timers.push(globalThis.setTimeout(finish, SHOT_HOLD_MS));
      }, SHOW_MS)
    );
  }

  return {
    el,
    activate() {
      releaseWakeLock = requestWakeLock();
      if (!areArenaAssetsReady()) el.classList.add('is-loading');
      void build().then(() => el.classList.remove('is-loading'));
    },
    destroy() {
      disposed = true;
      for (const timer of timers) clearTimeout(timer);
      releaseWakeLock?.();
      devPanel?.destroy();
      if (handle && tickerFn) handle.app.ticker.remove(tickerFn);
      handle?.detach();
      handle?.clearWorld();
    },
  };
}

/** Farbfolge für zusätzliche Shotlings aus dem Dev-Panel. */
const COLOR_CYCLE = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'] as const;
