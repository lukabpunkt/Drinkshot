/**
 * Audio.
 *
 * **Platzhalter-Sounds werden zur Laufzeit synthetisiert** (Web Audio), nicht aus Dateien
 * geladen — siehe ADR-20. Gründe: die Toolchain hat keinen Encoder für OGG/MP3, die Cues
 * liegen dadurch exakt auf der Zeitachse der Show (Audit A3 fordert ± 50 ms), es kostet
 * kein einziges Byte Bundle und funktioniert offline ab dem ersten Start.
 *
 * Die öffentliche API ist bewusst die, die ein howler-Sprite ebenfalls bedienen würde
 * (`play(cue)`, `startHeartbeat`, `duckMusic`, …). In M6 tauscht man den Klangerzeuger
 * hinter dieser Fassade aus, ohne einen Aufrufer anzufassen.
 *
 * iOS erlaubt Audio erst nach einer echten Nutzergeste — `unlockAudio()` läuft synchron
 * im ersten Tap (GDD §7).
 */

import { HEARTBEAT } from '@/config/choreo';

/** Alle Cues aus GDD §7. Nicht jeder klingt in M3 schon eigenständig. */
export type AudioCue =
  | 'ui_tap'
  | 'ui_confirm'
  | 'pass_whoosh'
  | 'scope_open'
  | 'reticle_move'
  | 'lock_tick'
  | 'lock_engage'
  | 'gunshot'
  | 'hit_stop_thud'
  | 'ice_crack'
  | 'xray_zap'
  | 'star_twinkle'
  | 'balloon_deflate'
  | 'tree_fall'
  | 'rocket'
  | 'rip_pop'
  | 'crowd_ooh'
  | 'crowd_laugh'
  | 'fanfare_result'
  | 'miracle_choir';

type Wave = OscillatorType;

interface CueSpec {
  /** Grundfrequenz in Hz. */
  freq: number;
  /** Zielfrequenz für einen Sweep; ohne Angabe konstant. */
  sweepTo?: number;
  durationMs: number;
  wave: Wave;
  gain: number;
  /** Rauschanteil 0…1 — für Knall, Aufprall, Zischen. */
  noise?: number;
  /** Tiefpass in Hz. */
  lowpass?: number;
}

/**
 * Klangrezepte. Bewusst kurz und knackig: Party-Umgebung, kleines Handy-Lautsprecher.
 */
const CUES: Record<AudioCue, CueSpec> = {
  ui_tap: { freq: 660, durationMs: 45, wave: 'triangle', gain: 0.18 },
  ui_confirm: { freq: 520, sweepTo: 880, durationMs: 120, wave: 'triangle', gain: 0.22 },
  pass_whoosh: { freq: 300, sweepTo: 120, durationMs: 260, wave: 'sine', gain: 0.16, noise: 0.5, lowpass: 1200 },
  scope_open: { freq: 180, sweepTo: 640, durationMs: 520, wave: 'sawtooth', gain: 0.14, lowpass: 2200 },
  reticle_move: { freq: 900, sweepTo: 1250, durationMs: 60, wave: 'square', gain: 0.08 },
  lock_tick: { freq: 1500, durationMs: 28, wave: 'square', gain: 0.1 },
  lock_engage: { freq: 220, sweepTo: 90, durationMs: 320, wave: 'sawtooth', gain: 0.2, lowpass: 900 },
  gunshot: { freq: 90, sweepTo: 40, durationMs: 300, wave: 'sawtooth', gain: 0.5, noise: 0.9, lowpass: 2600 },
  hit_stop_thud: { freq: 130, sweepTo: 60, durationMs: 160, wave: 'sine', gain: 0.34, noise: 0.25, lowpass: 700 },
  ice_crack: { freq: 2400, sweepTo: 900, durationMs: 240, wave: 'square', gain: 0.2, noise: 0.75, lowpass: 6000 },
  xray_zap: { freq: 1200, sweepTo: 3200, durationMs: 180, wave: 'sawtooth', gain: 0.18, noise: 0.35 },
  star_twinkle: { freq: 1760, sweepTo: 2640, durationMs: 200, wave: 'sine', gain: 0.12 },
  balloon_deflate: { freq: 800, sweepTo: 240, durationMs: 900, wave: 'sawtooth', gain: 0.16, noise: 0.7, lowpass: 3000 },
  tree_fall: { freq: 260, sweepTo: 70, durationMs: 620, wave: 'sawtooth', gain: 0.24, noise: 0.35, lowpass: 1100 },
  rocket: { freq: 200, sweepTo: 1400, durationMs: 700, wave: 'sawtooth', gain: 0.2, noise: 0.6, lowpass: 4000 },
  rip_pop: { freq: 420, sweepTo: 900, durationMs: 140, wave: 'triangle', gain: 0.24 },
  crowd_ooh: { freq: 300, sweepTo: 380, durationMs: 700, wave: 'sine', gain: 0.14, noise: 0.2, lowpass: 900 },
  crowd_laugh: { freq: 340, sweepTo: 300, durationMs: 620, wave: 'triangle', gain: 0.15, noise: 0.3, lowpass: 1400 },
  fanfare_result: { freq: 523, sweepTo: 1046, durationMs: 520, wave: 'square', gain: 0.2 },
  miracle_choir: { freq: 392, sweepTo: 784, durationMs: 1200, wave: 'sine', gain: 0.22 },
};

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | undefined {
  const scope = globalThis as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

let context: AudioContext | undefined;
let master: GainNode | undefined;
let musicBus: GainNode | undefined;
let noiseBuffer: AudioBuffer | undefined;
let unlocked = false;
let enabled = true;
let musicVolume = 0.5;

/** Entsperrt den AudioContext. Muss synchron aus einem Nutzer-Event laufen (iOS). */
export function unlockAudio(): void {
  if (unlocked) return;
  const Ctor = audioContextCtor();
  if (!Ctor) return;
  try {
    context ??= new Ctor();
    master = context.createGain();
    master.gain.value = 1;
    master.connect(context.destination);

    musicBus = context.createGain();
    musicBus.gain.value = musicVolume;
    musicBus.connect(master);

    // Ein Sekundenpuffer weissen Rauschens, den sich alle Cues teilen.
    const frames = context.sampleRate;
    noiseBuffer = context.createBuffer(1, frames, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    void context.resume();
    unlocked = true;
  } catch {
    // Kein Audio verfügbar — das Spiel ist stumm zu 100 % spielbar (GDD §7).
  }
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

export function setAudioEnabled(value: boolean): void {
  enabled = value;
  if (!value) stopHeartbeat();
}

export function isAudioEnabled(): boolean {
  return enabled;
}

export function setMusicVolume(value: number): void {
  musicVolume = Math.min(1, Math.max(0, value));
  if (musicBus && context) musicBus.gain.setTargetAtTime(musicVolume, context.currentTime, 0.05);
}

function ready(): boolean {
  return enabled && unlocked && context !== undefined && master !== undefined;
}

/**
 * Spielt einen Cue. `when` ist ein Offset in Sekunden auf der AudioContext-Uhr — so
 * lassen sich Ticks exakt vorplanen, statt sie im Frame-Loop zu triggern.
 */
export function play(cue: AudioCue, when = 0, detune = 0): void {
  if (!ready()) return;
  const ctx = context!;
  const spec = CUES[cue];
  const start = ctx.currentTime + when;
  const duration = spec.durationMs / 1000;

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(spec.gain, start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  let sink: AudioNode = envelope;
  if (spec.lowpass) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(spec.lowpass, start);
    envelope.connect(filter);
    filter.connect(master!);
    sink = envelope;
  } else {
    envelope.connect(master!);
  }
  void sink;

  const oscillator = ctx.createOscillator();
  oscillator.type = spec.wave;
  const freq = spec.freq * Math.pow(2, detune / 12);
  oscillator.frequency.setValueAtTime(freq, start);
  if (spec.sweepTo !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, spec.sweepTo * Math.pow(2, detune / 12)),
      start + duration
    );
  }
  oscillator.connect(envelope);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);

  if (spec.noise && noiseBuffer) {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = spec.noise;
    source.connect(noiseGain);
    noiseGain.connect(envelope);
    source.start(start);
    source.stop(start + duration + 0.02);
  }
}

/* ------------------------------------------------------------------ */
/* Herzschlag                                                          */
/* ------------------------------------------------------------------ */

let heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
let heartbeatBpm = HEARTBEAT.bpm[0];

/**
 * Herzschlag-Loop mit steigendem Tempo (GDD §3.5). Jeder Schlag plant sich selbst neu,
 * damit `setBpm()` sofort wirkt statt erst nach dem nächsten Zyklus.
 */
export function startHeartbeat(bpm = HEARTBEAT.bpm[0]): void {
  stopHeartbeat();
  heartbeatBpm = bpm;

  const beat = (): void => {
    if (!ready()) return;
    play('hit_stop_thud', 0, -8);
    play('hit_stop_thud', 0.14, -10);
    heartbeatTimer = globalThis.setTimeout(beat, (60 / heartbeatBpm) * 1000);
  };

  beat();
}

export function setHeartbeatBpm(bpm: number): void {
  heartbeatBpm = Math.max(30, bpm);
}

export function stopHeartbeat(): void {
  if (heartbeatTimer !== undefined) clearTimeout(heartbeatTimer);
  heartbeatTimer = undefined;
}

/* ------------------------------------------------------------------ */
/* Musik-Ducking                                                       */
/* ------------------------------------------------------------------ */

/** Senkt die Musik beim Lock ab (GDD §3.5), damit der Herzschlag trägt. */
export function duckMusic(to = HEARTBEAT.duckTo, ms = HEARTBEAT.duckMs): void {
  if (!context || !musicBus) return;
  musicBus.gain.setTargetAtTime(musicVolume * to, context.currentTime, ms / 3000);
}

export function unduckMusic(ms = HEARTBEAT.duckMs): void {
  if (!context || !musicBus) return;
  musicBus.gain.setTargetAtTime(musicVolume, context.currentTime, ms / 3000);
}

/** Pausiert alles (Tab-Wechsel). */
export function suspendAudio(): void {
  stopHeartbeat();
  void context?.suspend();
}

export function resumeAudio(): void {
  if (unlocked) void context?.resume();
}

/** Testhilfe: alle Cue-Namen. */
export const AUDIO_CUES = Object.keys(CUES) as AudioCue[];
