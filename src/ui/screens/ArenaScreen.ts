/**
 * Arena-Screen — hostet das PIXI-Canvas und startet die Show (Roadmap M3).
 *
 * Der Screen liest nur: Opfer, Seed und Todesanimation stehen seit dem Übergang
 * BET→ARENA fest (ADR-2). Hier wird das `ShowScript` daraus erzeugt und abgespielt.
 */

import gsap from 'gsap';
import { ARENA, shotlingHeightFor } from '@/config/theme';
import { HEARTBEAT } from '@/config/choreo';
import { buildShowScript } from '@/core/choreographer';
import { INTRO } from '@/config/choreo';
import { IntroSequence, type IntroMode } from '@/game/IntroSequence';
import { lineupPositions, warningShotPoint } from '@/game/introLineup';
import { createSeededRng } from '@/core/rng';
import { t } from '@/core/i18n';
import type { PlayerId } from '@/core/lottery';
import type { DeathId } from '@/core/session';
import * as audio from '@/audio/AudioManager';
import { prefersReducedMotion } from '@/ui/animate';
import { showToast } from '@/ui/components/toast';
import { vibrate } from '@/ui/haptics';
import type { ScreenContext, ScreenInstance } from '@/ui/router';
import { Arena } from '@/game/Arena';
import {
  areArenaAssetsReady,
  arenaLayout,
  arenaUpdateTimes,
  detectLowEffects,
  getArenaApp,
  loadArenaAssets,
  measureLowEffects,
  preloadArenaAssets,
  type ArenaAppHandle,
} from '@/game/ArenaApp';
import { Camera } from '@/game/Camera';
import { Scope } from '@/game/Scope';
import { Shotling } from '@/game/Shotling';
import { resolveOverlaps, ShotlingBrain } from '@/game/ShotlingBrain';
import { ShowDirector } from '@/game/ShowDirector';
import { ParticlePool } from '@/game/fx/ParticlePool';
import { clearDeathProps } from '@/game/fx/deathFinish';
import { registerAllDeaths } from '@/game/deaths';
import { allDeaths, getDeath } from '@/game/deaths/DeathSequence';
import { deathMeta } from '@/game/deaths/catalog';
import { createDevPanel, type DevPanel } from '@/ui/components/devPanel';

/** Hüte, die sich zum Wegschiessen eignen. */
const HATS_WITH_BRIM = ['cap', 'party', 'tophat', 'helmet', 'crown', 'beanie'] as const;

/** Pause vor dem zweiten Ladeversuch — lang genug für eine wiederkehrende Verbindung. */
const ASSET_RETRY_DELAY_MS = 600;
/** Wie lange der Fehler-Toast steht, bevor die Runde ohne Show ins Result geht. */
const ERROR_TOAST_MS = 6000;
/** Abstand der Haptik-Pulse im Lock — dasselbe Tempo wie der Herzschlag am Ende. */
const LOCK_PULSE_MS = Math.round(60_000 / HEARTBEAT.bpm[1]);

/** `?dev=1&hold=1` hält die Arena offen, damit `perf.spec.ts` messen kann. */
function isHoldMode(dev: boolean): boolean {
  if (!dev) return false;
  const params = new URLSearchParams(globalThis.location?.search ?? '');
  // Die Death-Preview hält die Arena immer offen — sonst wäre sie nach einer Sequenz weg.
  return params.get('hold') === '1' || isDeathPreview(dev);
}

/**
 * `?dev=1&panel=deaths`: Nur die Arena, **ohne** die automatische Show. Sonst liefen zwei
 * Todesanimationen gleichzeitig — die des Drehbuchs und die aus dem Dropdown — und man
 * beurteilte die falsche.
 */
function isDeathPreview(dev: boolean): boolean {
  if (!dev) return false;
  return new URLSearchParams(globalThis.location?.search ?? '').get('panel') === 'deaths';
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

/**
 * Lädt die Atlanten im Voraus. Wird aus `main.ts` beim Betreten von PASS gerufen — dann
 * ist der Arena-Chunk bereits da und kann die Assets anstossen.
 */
export function preloadArena(): void {
  registerAllDeaths();
  preloadArenaAssets();
}

/** Dev-Zugriff auf Messwerte und Geometrie, ohne dass `main.ts` PIXI importieren muss. */
export const arenaDevHandle = {
  updateTimes: (): readonly number[] => arenaUpdateTimes(),
  layout: (): ReturnType<typeof arenaLayout> => arenaLayout(),
};

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
  /** Notausgang ins Result, wenn die Arena nicht aufgebaut werden konnte. */
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
  /** Herzschlag-Puls der Haptik während des Locks. */
  let lockPulseTimer: ReturnType<typeof setInterval> | undefined;

  /**
   * Vibriert im Takt des Lock-Herzschlags (GDD §3.5, Roadmap M5.4).
   *
   * Eigener Timer statt Mitlaufen am Ton: Die Haptik soll auch bei stumm geschaltetem
   * Gerät spürbar sein — genau dann trägt sie die Spannung allein. Der Puls stoppt mit
   * dem Schuss, nicht am Ende des Locks: Der Schuss ist der Moment, in dem er aufhören
   * *muss*, sonst vibriert es in den Tod hinein.
   */
  function startLockPulse(): void {
    stopLockPulse();
    vibrate('lockPulse');
    lockPulseTimer = globalThis.setInterval(() => vibrate('lockPulse'), LOCK_PULSE_MS);
  }

  function stopLockPulse(): void {
    if (lockPulseTimer !== undefined) globalThis.clearInterval(lockPulseTimer);
    lockPulseTimer = undefined;
  }
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
  let intro: IntroSequence | undefined;
  let offIntroLayout: (() => void) | undefined;
  let onIntroTap: ((event: Event) => void) | undefined;
  /** Wohin der Warnschuss geht — steht erst nach der Aufstellung fest. */
  let warningShot = { x: 0, y: 0 };

  /*
   * Wie viel Auftakt? Die volle Inszenierung nur in der **ersten** Runde einer Session —
   * ein siebensekündiger Vorspann vor jeder Runde wäre am achten Abend nur Wartezeit.
   *
   * Der Auslöser ist `roundNumber`, bewusst **kein** persistentes Flag: Der E2E-Test
   * „Kurz vs. Lang" misst zweimal in derselben Seite und leert localStorage nur beim
   * ersten Laden — ein Flag gäbe der ersten Messung die volle Inszenierung und der
   * zweiten nur den Kurzteil, und die gemessene Differenz bräche ein.
   *
   * In den Dev-Modi bleibt der Auftakt ganz aus: `?hold=1` misst Draw-Calls und
   * Frame-Zeiten, `?panel=deaths` beurteilt einzelne Sequenzen — beides würde die
   * Inszenierung verfälschen.
   */
  const introMode: IntroMode | 'none' = isHoldMode(ctx.dev)
    ? 'none'
    : prefersReducedMotion() || ctx.fsm.context.roundNumber > 0
      ? 'short'
      : 'full';

  /**
   * Während der Inszenierung springt ein Tipp irgendwohin ans Ende — ohne sichtbaren
   * Knopf, der die Wirkung nähme.
   *
   * Wichtig: Er startet die **Show**, nicht das Ergebnis. Wer hier `finish()` auslöste,
   * landete im Result einer Runde, deren Show nie lief.
   */
  function armIntroSkip(skip: () => void): void {
    onIntroTap = (event) => {
      // Der Skip-Knopf der Show hat seinen eigenen Handler.
      if ((event.target as HTMLElement | null)?.closest('button')) return;
      skip();
    };
    el.addEventListener('pointerdown', onIntroTap);
  }

  function disarmIntroSkip(): void {
    if (onIntroTap) el.removeEventListener('pointerdown', onIntroTap);
    onIntroTap = undefined;
    offIntroLayout?.();
    offIntroLayout = undefined;
  }
  /*
   * Tab-Wechsel: pausieren statt weiterlaufen (Audit A3).
   *
   * Der Handler wird **sofort** registriert, nicht erst nach dem Aufbau des Directors:
   * Alles davor — Atlas laden, Arena bauen, die Intro-Inszenierung — liefe sonst im
   * Hintergrund ungebremst weiter, samt Ton.
   */
  const onVisibility = (): void => {
    if (document.hidden) {
      director?.pause();
      audio.suspendAudio();
    } else {
      audio.resumeAudio();
      director?.resume();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);


  const finish = (): void => {
    if (finished || disposed) return;
    finished = true;
    ctx.fsm.send({ type: 'showFinished' });
  };

  skip.addEventListener('click', () => {
    director?.skipToEnd();
    finish();
  });

  /**
   * Ein Ladeversuch darf an einem abgerissenen WLAN nicht die Runde kosten. Ein zweiter
   * Versuch nach kurzer Pause holt genau den Fall zurück, in dem die erste Anfrage
   * unterwegs verloren ging; scheitert auch der, entscheidet der Mensch (Roadmap M5.9).
   */
  async function loadAssetsWithRetry(): Promise<Awaited<ReturnType<typeof loadArenaAssets>>> {
    try {
      return await loadArenaAssets();
    } catch (first) {
      console.warn('[arena] Atlas-Ladefehler, zweiter Versuch', first);
      await new Promise((resolve) => globalThis.setTimeout(resolve, ASSET_RETRY_DELAY_MS));
      if (disposed) throw first;
      return await loadArenaAssets();
    }
  }

  /**
   * Meldet einen Fehler und bietet einen zweiten Anlauf an.
   *
   * Ohne den Knopf bliebe nur „neu laden" — und damit wäre die Session weg. Wer ablehnt
   * (oder nichts tut), landet nach kurzer Zeit im Result: Das Ergebnis steht ohnehin fest,
   * gezogen wurde beim Übergang BET→ARENA. Nur die Show fällt aus.
   */
  function failGracefully(message: string, error: unknown, retry: boolean): void {
    console.error('[arena]', message, error);
    showToast(t(message), {
      variant: 'danger',
      durationMs: ERROR_TOAST_MS,
      ...(retry
        ? {
            action: {
              label: t('error.retry'),
              onClick: () => {
                if (fallbackTimer !== undefined) globalThis.clearTimeout(fallbackTimer);
                el.classList.add('is-loading');
                void build().then(() => el.classList.remove('is-loading'));
              },
            },
          }
        : {}),
    });
    fallbackTimer = globalThis.setTimeout(finish, ERROR_TOAST_MS);
  }

  async function build(): Promise<void> {
    /*
     * `failGracefully` bietet einen zweiten Anlauf an — der ruft `build()` erneut. Ohne
     * dieses Aufräumen bliebe die alte `tickerFn` für immer im PIXI-Ticker: Zwei
     * Simulationen liefen dann parallel über dieselben Männchen, und die Todes-Timelines
     * des ersten Aufbaus liefen weiter, obwohl ihre Sprites längst aus der Welt entfernt
     * sind.
     */
    if (handle && tickerFn) handle.app.ticker.remove(tickerFn);
    tickerFn = undefined;
    disarmIntroSkip();
    intro?.destroy();
    intro = undefined;
    director?.destroy();
    director = undefined;
    scope?.destroy();
    scope = undefined;
    particles?.destroy();
    particles = undefined;
    camera?.reset();
    offLayout?.();
    offLayout = undefined;

    let assets;
    try {
      assets = await loadAssetsWithRetry();
    } catch (error) {
      // Ein Atlas-Fehler darf die Runde nicht kosten — das Ergebnis steht ohnehin fest.
      failGracefully('error.assets', error, true);
      return;
    }
    if (disposed) return;

    registerAllDeaths();

    try {
      handle = await getArenaApp();
    } catch (error) {
      /*
       * Kein WebGL — alter Browser, deaktivierte Hardwarebeschleunigung, Software-Blocklist.
       * Ein zweiter Versuch würde daran nichts ändern, deshalb kein Retry-Knopf.
       */
      failGracefully('error.webgl', error, false);
      return;
    }
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

    /*
     * Die Aufstellung vor dem Warnschuss (GDD §3.5): Sie stehen aufgereiht und rühren
     * sich nicht. `frozen` statt `speedMultiplier = 0`, weil `resolveOverlaps` die enge
     * Reihe sonst jeden Frame auseinanderdrückte.
     */
    if (introMode !== 'none') {
      const lineup = lineupPositions({
        count: brains.length,
        height,
        centerX: arena.centerX,
        centerY: arena.centerY,
        walkRadius: arena.walkRadius,
      });
      brains.forEach((brain, index) => {
        const point = lineup[index];
        if (!point) return;
        brain.x = point.x;
        brain.y = point.y;
        brain.frozen = true;
      });
      warningShot = warningShotPoint(lineup, height);
      for (const shotling of shotlings.values()) shotling.update(0);
    }

    /*
     * Braucht die gewürfelte Sequenz einen Hut (`head_hat_launch` schiesst ihn weg), setzt
     * die Arena dem Opfer einen auf. Hüte sind reine Zierde und werden pro Runde neu
     * gewürfelt — so bleibt die Sequenz im Pool, statt sich bei 40 % der Opfer selbst
     * auszuschliessen (ADR-34).
     */
    if (round) {
      // Jede Sequenz mit Hut-Bedarf bekommt einen — auch die des zweiten Double-Tap-Opfers.
      const needsHat: [PlayerId, DeathId][] = [
        [round.victimId, round.deathId],
        ...round.extraVictimIds.map(
          (id, index): [PlayerId, DeathId] => [id, round.extraDeaths[index]?.deathId ?? round.deathId]
        ),
      ];
      for (const [playerId, deathId] of needsHat) {
        if (!deathMeta(deathId).requiresHat) continue;
        const target = shotlings.get(playerId);
        if (target && target.getHat() === 'none') target.setHat(rng.pick(HATS_WITH_BRIM));
      }
    }

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

    /*
     * Zwei Dramaturgien, zwei Felder: Double Tap hängt einen kurzen Nachschlag an, der
     * Showdown baut für jedes weitere Opfer neu auf. `exactOptionalPropertyTypes` erlaubt
     * kein `undefined`, deshalb wird das Feld nur gesetzt, wenn es Opfer gibt.
     */
    const victimList = round.extraVictimIds.map((victimId, index) => ({
      victimId,
      deathId: round.extraDeaths[index]?.deathId ?? round.deathId,
    }));
    const followUps =
      victimList.length === 0
        ? {}
        : round.mode === 'showdown'
          ? { cascade: victimList }
          : { extraVictims: victimList };

    const script = buildShowScript({
      players: playerIds,
      victimId: round.victimId,
      seed: round.seed,
      durationPreset: round.durationPreset,
      deathId: round.deathId,
      ...followUps,
    });

    director = new ShowDirector({
      script,
      scope,
      camera,
      arena,
      particles,
      rng,
      shotlings,
      onFinished: () => {
        if (!isHoldMode(ctx.dev)) finish();
      },
      onShotFired: ({ final }) => {
        stopLockPulse();
        vibrate('shot');
        lockLabel.hidden = true;
        // Erst nach dem letzten Schuss: Im Showdown fallen mehrere, und wer nach dem
        // ersten überspringen darf, verpasst den Rest der Runde.
        if (final) skip.hidden = false;
      },
      // Die Blende hat den Sound schon gespielt — der Beat würde ihn sonst wiederholen.
      playIntroCue: introMode === 'none',
      onLockEngaged: () => {
        startLockPulse();
        /*
         * Das LOCK-Schild hängt jetzt am Beat statt an einem `setTimeout` auf die
         * Wanduhr: Das driftete beim Tab-Wechsel gegen die Show und erschien nur beim
         * ersten Lock. In der Death-Preview läuft keine Show, also auch kein Schild.
         */
        if (!isDeathPreview(ctx.dev)) lockLabel.hidden = false;
      },
    });

    if (ctx.dev) {
      /**
       * Death-Preview (Architektur §9): baut die gewählte Sequenz auf dem Opfer neu auf.
       * Vorher wird das Rig zurückgesetzt — sonst stapeln sich zwei Animationen auf
       * demselben Körper, und man sieht nicht mehr, welche man gerade beurteilt.
       */
      const playDeath = (id: string): void => {
        const sequence = getDeath(id);
        // Immer dasselbe Opfer, damit sich zwei Durchläufe vergleichen lassen.
        const target = [...shotlings.values()][0];
        if (!sequence || !target || !scope || !camera || !particles) return;

        gsap.killTweensOf(target.view);
        target.reset();
        particles.clear();
        clearDeathProps(arena.actorLayer);

        const rest = [...shotlings.values()].filter((other) => other !== target);
        for (const other of rest) other.reset();

        /*
         * Bühne freiräumen: Das Opfer in die Mitte, die anderen an den Rand. Sonst steht
         * die Sequenz, die man beurteilen will, hinter einem anderen Männchen.
         */
        target.brain.x = arena.centerX;
        target.brain.y = arena.centerY;
        target.brain.stop();
        rest.forEach((other, index) => {
          const angle = Math.PI * 0.5 + (index / Math.max(1, rest.length)) * Math.PI * 1.5;
          other.brain.x = arena.centerX + Math.cos(angle) * arena.walkRadius * 0.85;
          other.brain.y = arena.centerY + Math.sin(angle) * arena.walkRadius * 0.85;
          other.brain.stop();
          other.update(0);
        });
        target.update(0);
        scope.snapTo(target.aimPoint);

        sequence
          .build({
            victim: target,
            others: rest,
            scope,
            camera,
            fx: { particles, overlay: arena.actorLayer },
            audio: { play: (cue, when, detune) => audio.play(cue as audio.AudioCue, when, detune) },
            rng: createSeededRng(round.seed),
            arena,
          })
          .play();
      };

      devPanel = createDevPanel({
        host: el,
        app: handle,
        initialCount: shotlings.size,
        lowEffects,
        seed: round.seed,
        deathIds: allDeaths().map((sequence) => sequence.id),
        onPlayDeath: playDeath,
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

    // In der Death-Preview startet nichts von allein — das Dropdown gibt den Takt vor.
    if (isDeathPreview(ctx.dev)) return;

    const show = director;
    let started = false;
    const startShow = (): void => {
      if (started || disposed) return;
      started = true;
      disarmIntroSkip();
      intro?.destroy();
      intro = undefined;
      show.play();
    };

    if (introMode === 'none') {
      startShow();
      return;
    }

    intro = new IntroSequence({
      overlay: handle.overlay,
      sheet: assets.shotlings,
      scope,
      camera,
      particles,
      warningShot,
      lowEffects,
      reducedMotion: prefersReducedMotion(),
      onScatter: () => {
        for (const brain of brains) {
          brain.frozen = false;
          brain.burst(INTRO.scatterMs);
        }
      },
    });

    const sequence = intro;
    offIntroLayout = handle.onLayout(() => sequence.resize());
    armIntroSkip(() => {
      sequence.skip();
      startShow();
    });

    sequence.build(introMode).eventCallback('onComplete', startShow);
    sequence.play();
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
      stopLockPulse();
      disarmIntroSkip();
      intro?.destroy();
      intro = undefined;
      if (fallbackTimer !== undefined) globalThis.clearTimeout(fallbackTimer);
      document.removeEventListener('visibilitychange', onVisibility);
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
