/**
 * Spielt das `ShowScript` ab (Architektur §5, Roadmap M3.4).
 *
 * **Eine** GSAP-Timeline für die ganze Show. Das ist keine Stilfrage: Slow-Mo läuft über
 * `timeScale`, Hit-Stop über eine Pause, der Tab-Wechsel über `pause()`/`resume()` — und
 * das funktioniert nur, wenn Reticle, Kamera, Männchen und Sound an derselben Zeitachse
 * hängen.
 *
 * Der Director **entscheidet nichts**. Opfer und Todesanimation stehen seit BET→ARENA
 * fest (ADR-2); hier wird nur inszeniert.
 */

import gsap from 'gsap';
import { CHOREO, HEARTBEAT } from '@/config/choreo';
import { ARENA } from '@/config/theme';
import type { ShowScript } from '@/core/choreographer';
import type { PlayerId } from '@/core/lottery';
import * as audio from '@/audio/AudioManager';
import type { Arena } from './Arena';
import type { Camera } from './Camera';
import type { Scope } from './Scope';
import type { Shotling } from './Shotling';
import type { ParticlePool } from './fx/ParticlePool';
import { getDeath } from './deaths/DeathSequence';
import type { SeededRng } from '@/core/rng';

export interface ShowDirectorOptions {
  script: ShowScript;
  scope: Scope;
  camera: Camera;
  arena: Arena;
  particles: ParticlePool;
  rng: SeededRng;
  /** Alle Männchen, nach PlayerId. */
  shotlings: Map<PlayerId, Shotling>;
  /** Wird nach dem Outro gerufen — die FSM schaltet dann auf RESULT. */
  onFinished: () => void;
  /**
   * Ein Schuss ist gefallen. `final` sagt, ob es der letzte der Runde war — im Showdown
   * fallen mehrere, und der Skip-Knopf darf nicht schon nach dem ersten erscheinen
   * (sonst wären 80 % der Runde überspringbar).
   */
  onShotFired?: (info: { index: number; total: number; final: boolean }) => void;
  /**
   * Der Lock rastet ein. Die Haptik hängt sich hier ein — sie muss auch dann pulsieren,
   * wenn der Ton aus ist, und darf deshalb nicht am Audio-Herzschlag hängen (Roadmap M5.4).
   */
  onLockEngaged?: (holdMs: number) => void;
}

/** Wie lange ein Männchen nach dem Reticle-Wechsel wegsprintet (Roadmap M3.6). */
const FLEE_BURST_MS = 300;

export class ShowDirector {
  private readonly timeline: gsap.core.Timeline;
  private readonly options: ShowDirectorOptions;
  private aimedId: PlayerId | undefined;
  /**
   * Die Todesanimationen laufen als eigene Timelines neben der Show — im Showdown mehrere
   * überlappend. Deshalb eine Liste: Ein einzelnes Feld hätte die vorherige überschrieben
   * und die Show nur auf die letzte gewartet.
   */
  private readonly deathTimelines: gsap.core.Timeline[] = [];

  constructor(options: ShowDirectorOptions) {
    this.options = options;
    this.timeline = gsap.timeline({ paused: true, onComplete: () => this.handleComplete() });
    this.build();
  }

  /**
   * Das Drehbuch räumt der Todesanimation 10 % der Dauer ein; eine Sequenz darf laut
   * Architektur §6 aber bis 4.5 s laufen. Deshalb endet die Show erst, wenn beides durch
   * ist — sonst schneidet der Result-Screen den Tod ab.
   */
  private handleComplete(): void {
    /*
     * Über die **Restlaufzeit** warten, nicht über `eventCallback('onComplete')`: Das
     * würde einen Callback überschreiben, den die Sequenz selbst gesetzt hat.
     */
    const remainingMs = this.deathTimelines.reduce((max, timeline) => {
      if (!timeline.isActive()) return max;
      return Math.max(max, timeline.totalDuration() - timeline.totalTime());
    }, 0);

    if (remainingMs <= 0) {
      this.options.onFinished();
      return;
    }
    gsap.delayedCall(remainingMs, () => this.options.onFinished());
  }

  private shotlingOf(id: PlayerId): Shotling | undefined {
    return this.options.shotlings.get(id);
  }

  /**
   * Markiert, wer gerade im Fadenkreuz hängt: Angst-Gesicht, Blick zur Kamera.
   * Das vorherige Ziel rennt weg — dadurch sieht man immer, wer „dran" ist (GDD §5.1).
   */
  private setAimed(id: PlayerId | undefined): void {
    if (this.aimedId === id) return;

    /*
     * `isDriven()` ist der entscheidende Teil der Bedingung: Eine Sequenz setzt
     * `setState('dead')` erst an ihrem **Ende**. Ein Männchen, dessen Todesanimation noch
     * läuft, ist also nicht `'dead'` — ohne diesen Guard bekäme es hier `panic` + `burst`
     * und liefe los, während GSAP sein Rig animiert.
     */
    const previous = this.aimedId ? this.shotlingOf(this.aimedId) : undefined;
    if (previous && previous.getState() !== 'dead' && !previous.isDriven()) {
      previous.setState('panic');
      previous.resetHead();
      previous.brain.burst(FLEE_BURST_MS);
    }

    this.aimedId = id;
    const next = id ? this.shotlingOf(id) : undefined;
    if (next && next.getState() !== 'dead' && !next.isDriven()) {
      next.setState('aimed');
      next.lookAt(this.options.scope.centerX, this.options.scope.centerY);
    }
  }

  private setPhaseSpeed(multiplier: number): void {
    for (const shotling of this.options.shotlings.values()) {
      shotling.brain.speedMultiplier = multiplier;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Aufbau der Timeline                                                 */
  /* ------------------------------------------------------------------ */

  private build(): void {
    const { script, scope, camera, particles, shotlings } = this.options;

    /*
     * Wie viele Schüsse fallen und der wievielte gerade dran ist. Der Skip-Knopf hängt
     * daran: Im Showdown darf er erst nach dem letzten erscheinen.
     */
    const shotCount = script.beats.filter((beat) => beat.type === 'shot').length;
    let shotIndex = 0;
    const timeline = this.timeline;

    for (const beat of script.beats) {
      const at = beat.t / 1000;

      switch (beat.type) {
        case 'intro':
          timeline.call(
            () => {
              audio.play('scope_open');
              this.setPhaseSpeed(ARENA.speed.scan);
              const first = [...shotlings.values()][0];
              if (first) scope.snapTo(first.aimPoint);
            },
            undefined,
            at
          );
          break;

        case 'aim': {
          const target = beat.target;
          const holdMs = beat.holdMs;
          const style = beat.style;
          timeline.call(
            () => {
              const shotling = this.shotlingOf(target);
              if (!shotling) return;

              // Parallax in die Gegenrichtung des Sprungs (Art Direction §7).
              camera.parallaxNudge(shotling.brain.x - scope.centerX, shotling.brain.y - scope.centerY);

              const hopMs = style === 'smooth' ? CHOREO.hopMs[1] : CHOREO.hopMs[0];
              scope.aimAt(shotling.aimPoint, Math.min(hopMs, holdMs * 0.6), style);
              audio.play('reticle_move');
              audio.play('lock_tick', Math.min(hopMs, holdMs * 0.6) / 1000);
              this.setAimed(target);
            },
            undefined,
            at
          );
          break;
        }

        case 'fakeLock': {
          const target = beat.target;
          const holdMs = beat.holdMs;
          timeline.call(
            () => {
              const shotling = this.shotlingOf(target);
              if (!shotling) return;
              scope.aimAt(shotling.aimPoint, CHOREO.hopMs[0], 'snap');
              this.setAimed(target);
              audio.play('lock_engage');
              // Der Fake läuft in derselben Uhr wie alles andere.
              scope.fakeLock(holdMs);
            },
            undefined,
            at
          );
          break;
        }

        case 'lock': {
          const holdMs = beat.holdMs;
          // Das Ziel steht im Beat. Vorher stand hier `options.victimId` — der zweite
          // Double-Tap-Lock fuhr damit auf das bereits tote erste Opfer zurück.
          const lockTarget = beat.target;
          timeline.call(
            () => {
              const victim = this.shotlingOf(lockTarget);
              if (!victim) return;

              scope.aimAt(victim.aimPoint, CHOREO.hopMs[0], 'snap');
              this.setAimed(lockTarget);

              audio.play('lock_engage');
              audio.duckMusic();
              audio.setHeartbeatBpm(HEARTBEAT.bpm[1]);

              scope.lock(holdMs);
              void scope.applyGlassSplit();
              camera.zoomIn(holdMs * 0.8);
              // Slow-Mo läuft über `camera.timeScale`; das Phasen-Tempo bleibt bei 1,
              // sonst würde beides multipliziert (0.4 × 0.4).
              camera.slowMotion(CHOREO.slowMoScale);
              this.setPhaseSpeed(1);
              this.options.onLockEngaged?.(holdMs);
            },
            undefined,
            at
          );
          break;
        }

        case 'shot': {
          shotIndex += 1;
          const currentShot = shotIndex;
          const isFinalShot = shotIndex === shotCount;
          timeline.call(
            () => {
              // Slow-Mo bricht mit dem Knall ab (GDD §3.5).
              camera.resetTime();
              audio.stopHeartbeat();
              audio.play('gunshot');
              scope.flash();
              camera.shakeScreen();
              this.setPhaseSpeed(0);
              this.options.onShotFired?.({
                index: currentShot,
                total: shotCount,
                final: isFinalShot,
              });
            },
            undefined,
            at
          );
          break;
        }

        case 'death': {
          const deathId = beat.deathId;
          const deathVictimId = beat.victim;
          timeline.call(
            () => {
              const victim = this.shotlingOf(deathVictimId);
              const sequence = getDeath(deathId);
              if (!victim || !sequence) return;

              // Wer schon liegt, schaut nicht mehr zu (Double Tap: das erste Opfer).
              const others = [...shotlings.values()].filter((s) => s !== victim && !s.isDead);
              const sub = sequence.build({
                victim,
                others,
                scope,
                camera,
                fx: { particles, overlay: this.options.arena.actorLayer },
                audio: {
                  play: (cue, when, detune) =>
                    audio.play(cue as audio.AudioCue, when, detune),
                },
                rng: this.options.rng,
                arena: this.options.arena,
              });
              this.deathTimelines.push(sub);

              // Die anderen bleiben stehen und schauen hin (GDD §4.2, Nachbeben).
              for (const other of others) {
                other.setState('idle');
                other.brain.stop();
                other.lookAt(victim.brain.x, victim.brain.y);
              }
              audio.play('crowd_ooh', 0.4);
            },
            undefined,
            at
          );
          break;
        }

        case 'outro':
          timeline.call(
            () => {
              scope.release();
              audio.unduckMusic();
              audio.stopHeartbeat();
            },
            undefined,
            at
          );
          break;
      }
    }

    // Herzschlag startet mit der Panik-Phase.
    const panicStart = script.beats.find((beat) => beat.type === 'aim' && beat.style === 'snap');
    if (panicStart) {
      timeline.call(
        () => {
          audio.startHeartbeat(HEARTBEAT.bpm[0]);
          this.setPhaseSpeed(ARENA.speed.panic);
        },
        undefined,
        panicStart.t / 1000
      );
    }

    // Die Timeline muss mindestens so lang sein wie das Skript, sonst endet sie zu früh.
    timeline.to({}, { duration: script.totalMs / 1000 }, 0);
  }

  /* ------------------------------------------------------------------ */
  /* Steuerung                                                           */
  /* ------------------------------------------------------------------ */

  play(): void {
    this.timeline.play(0);
  }

  pause(): void {
    this.timeline.pause();
    audio.suspendAudio();
  }

  resume(): void {
    audio.resumeAudio();
    this.timeline.resume();
  }

  /**
   * Springt ans Ende — „Tap zum Überspringen" nach dem Schuss (GDD §6.4).
   *
   * `progress(1)` allein würde alle übersprungenen `call()`s **synchron** nachfeuern: Im
   * Showdown wären das bis zu sieben Todesanimationen auf einmal. Deshalb `suppressEvents`
   * und die laufenden Sequenzen abräumen.
   */
  skipToEnd(): void {
    this.timeline.progress(1, true);
    for (const timeline of this.deathTimelines) timeline.kill();
    this.deathTimelines.length = 0;
  }

  get progress(): number {
    return this.timeline.progress();
  }

  destroy(): void {
    this.timeline.kill();
    for (const timeline of this.deathTimelines) timeline.kill();
    this.deathTimelines.length = 0;
    audio.stopHeartbeat();
    audio.unduckMusic();
  }
}
