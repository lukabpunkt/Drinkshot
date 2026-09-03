/**
 * Arena-Screen — hostet das PIXI-Canvas und startet die Show (Roadmap M3).
 *
 * Der Screen liest nur: Opfer, Seed und Todesanimation stehen seit dem Übergang
 * BET→ARENA fest (ADR-2). Hier wird das `ShowScript` daraus erzeugt und abgespielt.
 */

import { ARENA, shotlingHeightFor } from '@/config/theme';
import { buildShowScript } from '@/core/choreographer';
import { createSeededRng } from '@/core/rng';
import { t } from '@/core/i18n';
import type { PlayerId } from '@/core/lottery';
import * as audio from '@/audio/AudioManager';
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
import { Camera } from '@/game/Camera';
import { Scope } from '@/game/Scope';
import { Shotling } from '@/game/Shotling';
import { resolveOverlaps, ShotlingBrain } from '@/game/ShotlingBrain';
import { ShowDirector } from '@/game/ShowDirector';
import { ParticlePool } from '@/game/fx/ParticlePool';
import { registerAllDeaths } from '@/game/deaths';
import { createDevPanel, type DevPanel } from '@/ui/components/devPanel';

/** `?dev=1&hold=1` hält die Arena offen, damit `perf.spec.ts` messen kann. */
function isHoldMode(dev: boolean): boolean {
  if (!dev) return false;
  return new URLSearchParams(globalThis.location?.search ?? '').get('hold') === '1';
}

/**
 * Wake-Lock während der Arena-Phase (GDD §6): 10–22 s ohne Eingabe reichen sonst, damit
 * das Display ausgeht. Nicht jedes Gerät kann das — Fehler bleiben still.
 */
function requestWakeLock(): () => void {
  let sentinel: WakeLockSentinel | undefined;
  let released = false;

  const acquire = async (): Promise<void> => {
    try {
      sentinel = await navigator.wakeLock?.request('screen');
    } catch {
      // Kein Wake-Lock verfügbar (iOS < 16.4, Akkusparmodus) — kein Fehlerfall.
    }
  };

  // Nach einem Tab-Wechsel gibt das Betriebssystem den Lock frei; dann neu anfordern.
  const onVisible = (): void => {
    if (!released && document.visibilityState === 'visible') void acquire();
  };
  document.addEventListener('visibilitychange', onVisible);
  void acquire();

  return () => {
    released = true;
    document.removeEventListener('visibilitychange', onVisible);
    void sentinel?.release().catch(() => undefined);
  };
}

export function createArenaScreen(ctx: ScreenContext): ScreenInstance {
  const round = ctx.fsm.context.round;

  const el = document.createElement('section');
  el.className = 'screen screen--arena';

  const stage = document.createElement('div');
  stage.className = 'arena__canvas';

  const hud = document.createElement('p');
  hud.className = 'arena__hud';
  hud.textContent = t('arena.hud', {
    round: ctx.fsm.context.roundNumber + 1,
    count: ctx.fsm.context.players.length,
  });

  /** Der LOCK-Schriftzug liegt im DOM: i18n, Kontrast und Screenreader inklusive. */
  const lockLabel = document.createElement('p');
  lockLabel.className = 'arena__lock';
  lockLabel.textContent = t('arena.lock');
  lockLabel.hidden = true;

  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'arena__skip';
  skip.textContent = t('arena.skip');
  skip.hidden = true;

  el.append(stage, hud, lockLabel, skip);

  /* ------------------------------------------------------------------ */

  let disposed = false;
  let finished = false;
  let handle: ArenaAppHandle | undefined;
  let director: ShowDirector | undefined;
  let scope: Scope | undefined;
  let camera: Camera | undefined;
  let particles: ParticlePool | undefined;
  let devPanel: DevPanel | undefined;
  let releaseWakeLock: (() => void) | undefined;
  let offLayout: (() => void) | undefined;
  let tickerFn: ((ticker: { deltaMS: number }) => void) | undefined;
  let onVisibility: (() => void) | undefined;

  const finish = (): void => {
    if (finished || disposed) return;
    finished = true;
    ctx.fsm.send({ type: 'showFinished' });
  };

  skip.addEventListener('click', () => {
    director?.skipToEnd();
    finish();
  });

  async function build(): Promise<void> {
    let assets;
    try {
      assets = await loadArenaAssets();
    } catch (error) {
      // Ein Atlas-Fehler darf die Runde nicht kosten — das Ergebnis steht ohnehin fest.
      console.error('[arena] Atlas konnte nicht geladen werden', error);
      showToast(t('error.generic'), { variant: 'danger' });
      globalThis.setTimeout(finish, 1200);
      return;
    }
    if (disposed) return;

    registerAllDeaths();

    handle = await getArenaApp();
    if (disposed) return;

    handle.clearWorld();
    handle.attach(stage);

    const seed = round?.seed ?? 1;
    const rng = createSeededRng(seed);

    const arena = new Arena({ sheet: assets.props, rng });
    handle.world.addChild(arena.view);

    particles = new ParticlePool();
    arena.view.addChild(particles.view);

    /* --- Ein Shotling je Spieler --- */
    const playerIds: PlayerId[] = ctx.fsm.context.players.length
      ? ctx.fsm.context.players
      : ctx.session.activePlayers().map((player) => player.id);

    let lowEffects = ctx.session.state.settings.lowEffects || detectLowEffects();
    const height = shotlingHeightFor(playerIds.length);

    const shotlings = new Map<PlayerId, Shotling>();
    const brains: ShotlingBrain[] = [];

    playerIds.forEach((playerId, index) => {
      const player = ctx.session.playerById(playerId);
      const brain = new ShotlingBrain({
        centerX: arena.centerX,
        centerY: arena.centerY,
        radius: arena.walkRadius,
        rng,
        separation: height * ARENA.separationFactor,
        slot: { index, count: playerIds.length },
      });
      const shotling = new Shotling({
        sheet: assets.shotlings,
        colorId: player?.colorId ?? 'red',
        brain,
        rng,
        lowEffects,
        height,
      });
      arena.actorLayer.addChild(shotling.view);
      shotlings.set(playerId, shotling);
      brains.push(brain);
    });
    resolveOverlaps(brains);

    /* --- Scope und Kamera --- */
    scope = new Scope({
      worldToScreen: (x, y, out) => handle!.worldToScreen(x, y, out),
      lowEffects,
    });
    handle.overlay.addChild(scope.view);

    camera = new Camera({
      world: handle.world,
      baseScale: handle.layout.scale,
      baseX: handle.layout.x,
      baseY: handle.layout.y,
    });

    offLayout = handle.onLayout((layout) => {
      scope?.resize(layout.width, layout.height);
      camera?.rebase(layout.scale, layout.x, layout.y);
    });

    /* --- Frame-Loop --- */
    tickerFn = (ticker) => {
      const started = performance.now();
      // Slow-Mo bremst die Welt, nicht das Drehbuch (siehe Camera.slowMotion).
      const dt = ticker.deltaMS * (camera?.timeScale ?? 1);
      for (let i = 0; i < brains.length; i++) brains[i]!.update(dt, brains);
      resolveOverlaps(brains);
      for (const shotling of shotlings.values()) shotling.update(dt);
      particles?.update(dt);
      scope?.update(ticker.deltaMS);
      handle?.recordUpdate(performance.now() - started);
    };
    handle.app.ticker.add(tickerFn);

    void measureLowEffects(handle).then((slow) => {
      if (disposed || !slow || lowEffects) return;
      lowEffects = true;
      for (const shotling of shotlings.values()) shotling.setLowEffects(true);
      scope?.setLowEffects(true);
      particles?.setLowEffects(true);
      devPanel?.setLowEffects(true);
    });

    /* --- Die Show --- */
    if (!round) {
      globalThis.setTimeout(finish, 800);
      return;
    }

    const script = buildShowScript({
      players: playerIds,
      victimId: round.victimId,
      seed: round.seed,
      durationPreset: round.durationPreset,
      deathId: round.deathId,
    });

    director = new ShowDirector({
      script,
      scope,
      camera,
      arena,
      particles,
      rng,
      shotlings,
      victimId: round.victimId,
      onFinished: () => {
        if (!isHoldMode(ctx.dev)) finish();
      },
      onShotFired: () => {
        vibrate('shot');
        skip.hidden = false;
        lockLabel.hidden = true;
      },
    });

    // LOCK-Schriftzug einblenden, wenn der Lock-Beat kommt.
    const lockBeat = script.beats.find((beat) => beat.type === 'lock');
    if (lockBeat) {
      globalThis.setTimeout(() => {
        if (!disposed && !finished) lockLabel.hidden = false;
      }, lockBeat.t);
    }

    /* --- Tab-Wechsel: pausieren statt weiterlaufen (Audit A3) --- */
    onVisibility = () => {
      if (document.hidden) director?.pause();
      else director?.resume();
    };
    document.addEventListener('visibilitychange', onVisibility);

    if (ctx.dev) {
      devPanel = createDevPanel({
        host: el,
        app: handle,
        initialCount: shotlings.size,
        lowEffects,
        seed: round.seed,
        onSpeedChange: (multiplier) => {
          for (const brain of brains) brain.speedMultiplier = multiplier;
        },
        onLowEffectsChange: (value) => {
          for (const shotling of shotlings.values()) shotling.setLowEffects(value);
          scope?.setLowEffects(value);
          particles?.setLowEffects(value);
        },
        onReplay: () => director?.play(),
        hasFilters: () => scope?.hasFilters ?? false,
      });
    }

    director.play();
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
      if (onVisibility) document.removeEventListener('visibilitychange', onVisibility);
      releaseWakeLock?.();
      offLayout?.();
      devPanel?.destroy();
      director?.destroy();
      scope?.destroy();
      camera?.reset();
      particles?.destroy();
      audio.stopHeartbeat();
      audio.unduckMusic();
      if (handle && tickerFn) handle.app.ticker.remove(tickerFn);
      handle?.detach();
      handle?.clearWorld();
    },
  };
}
