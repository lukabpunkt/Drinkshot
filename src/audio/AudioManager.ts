/**
 * Audio.
 *
 * M1 liefert nur den **Unlock**: iOS startet den AudioContext erst nach einer echten
 * Nutzergeste (GDD §7). Der erste Tap auf "Spielen" ruft `unlockAudio()`.
 *
 * TODO(M3): howler-Sprite laden (`audio/sprite.json`), `play()`/`stop()`, Musik-Ducking
 *           beim Lock, Herzschlag-Loop mit Tempo-Anstieg.
 */

let context: AudioContext | undefined;
let unlocked = false;
let enabled = true;

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | undefined {
  const scope = globalThis as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

/**
 * Entsperrt den AudioContext. Muss synchron aus einem Nutzer-Event heraus laufen,
 * sonst lehnt iOS ab. Mehrfachaufrufe sind unschaedlich.
 */
export function unlockAudio(): void {
  if (unlocked) return;
  const Ctor = audioContextCtor();
  if (!Ctor) return;
  try {
    context ??= new Ctor();
    void context.resume();
    unlocked = true;
  } catch {
    // Kein Audio verfuegbar — das Spiel ist stumm voll spielbar (GDD §7).
  }
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

export function setAudioEnabled(value: boolean): void {
  enabled = value;
}

export function isAudioEnabled(): boolean {
  return enabled;
}

/** TODO(M3): spielt einen Sprite-Cue. Bis dahin bewusst ein No-Op. */
export function play(_cue: string): void {
  // absichtlich leer bis M3
}
