/**
 * Spielregeln — abgeleitet aus `docs/01-GDD.md §3`.
 * Bei Widersprüchen gewinnt das GDD.
 */

/* ------------------------------------------------------------------ */
/* Spieler & Einsatz (GDD §3.1 / §3.2)                                 */
/* ------------------------------------------------------------------ */

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

/** Einsatz 1..10; 0 ist bewusst verboten ("Skin in the game", GDD §3.2). */
export const MIN_BET = 1;
export const MAX_BET = 10;
export const DEFAULT_BET = 3;

export const MAX_NAME_LENGTH = 12;

/** Runden-History im localStorage (Architektur §4). */
export const MAX_ROUND_HISTORY = 50;

/** Risiko-Ampel unter der Bet-Zahl (Art Direction §4.3). */
export const RISK_TIERS = [
  { maxBet: 3, id: 'careful' },
  { maxBet: 6, id: 'bold' },
  { maxBet: MAX_BET, id: 'insane' },
] as const;

export type RiskTierId = (typeof RISK_TIERS)[number]['id'];

export function riskTier(bet: number): RiskTierId {
  for (const tier of RISK_TIERS) {
    if (bet <= tier.maxBet) return tier.id;
  }
  return 'insane';
}

/* ------------------------------------------------------------------ */
/* Modi (GDD §3.6)                                                     */
/* ------------------------------------------------------------------ */

export const GAME_MODES = ['classic', 'distributor', 'suddenDeath', 'doubleTap'] as const;
export type GameMode = (typeof GAME_MODES)[number];

/** ADR-3: Klassik ist Default. */
export const DEFAULT_MODE: GameMode = 'classic';

export interface ModeSpec {
  id: GameMode;
  /** Anzahl Opfer pro Runde. */
  victims: number;
  /** Getroffener scheidet fuer die Session aus. */
  eliminates: boolean;
  /** Empfohlene Mindest-Spielerzahl (nur UI-Hinweis, keine Sperre). */
  recommendedMinPlayers: number;
}

export const MODE_SPECS: Record<GameMode, ModeSpec> = {
  classic: { id: 'classic', victims: 1, eliminates: false, recommendedMinPlayers: MIN_PLAYERS },
  distributor: { id: 'distributor', victims: 1, eliminates: false, recommendedMinPlayers: MIN_PLAYERS },
  suddenDeath: { id: 'suddenDeath', victims: 1, eliminates: true, recommendedMinPlayers: 5 },
  doubleTap: { id: 'doubleTap', victims: 2, eliminates: false, recommendedMinPlayers: 6 },
};

/* ------------------------------------------------------------------ */
/* Dauer-Presets (GDD §3.5)                                            */
/* ------------------------------------------------------------------ */

export const DURATION_PRESETS = ['short', 'normal', 'long'] as const;
export type DurationPreset = (typeof DURATION_PRESETS)[number];

export const DEFAULT_DURATION: DurationPreset = 'normal';

/** Gesamtdauer der Arena-Phase in ms (10 / 15 / 22 s). */
export const DURATION_MS: Record<DurationPreset, number> = {
  short: 10_000,
  normal: 15_000,
  long: 22_000,
};

/* ------------------------------------------------------------------ */
/* Sonstige Regeln                                                     */
/* ------------------------------------------------------------------ */

/** Miracle-Rate: 1 von 40 Runden (GDD §4.1). */
export const MIRACLE_CHANCE = 1 / 40;

/** Eine DeathId darf sich in 4 aufeinanderfolgenden Runden nicht wiederholen. */
export const DEATH_NO_REPEAT_WINDOW = 4;

/** No-Repeat greift nur, solange genug Sequenzen registriert sind. */
export const DEATH_NO_REPEAT_MIN_POOL = 8;

/** Tap-Sperre auf dem Pass-Screen gegen Doppeltaps (GDD §6). */
export const PASS_TAP_LOCK_MS = 800;

/** Long-Press-Auto-Repeat im Bet-Stepper (Art Direction §4.3). */
export const STEPPER_REPEAT_MS = { initial: 300, interval: 90 } as const;

/** Blind-Bet: Einsatz wird zugelost statt gewaehlt (GDD §3.2, optional). */
export const BLIND_BET_DEFAULT = false;

/* ------------------------------------------------------------------ */
/* Default-Settings (Architektur §4)                                   */
/* ------------------------------------------------------------------ */

export type Locale = 'de' | 'en';

export interface Settings {
  mode: GameMode;
  duration: DurationPreset;
  sound: boolean;
  music: number;
  haptics: boolean;
  miracles: boolean;
  lowEffects: boolean;
  blindBet: boolean;
  locale: Locale;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: DEFAULT_MODE,
  duration: DEFAULT_DURATION,
  sound: true,
  music: 0.5,
  haptics: true,
  miracles: true,
  lowEffects: false,
  blindBet: BLIND_BET_DEFAULT,
  locale: 'de',
};

/** localStorage-Key fuer die Session (Architektur §4). */
export const STORAGE_KEY = 'drinkshot.session.v1';

/** localStorage-Key fuer den einmaligen 18+-Hinweis (Roadmap M1). */
export const STORAGE_KEY_DISCLAIMER = 'drinkshot.disclaimer.v1';

/** Praefix der Onboarding-Flags — je Hinweis ein Eintrag (Roadmap M5.8). */
export const STORAGE_KEY_ONBOARDING = 'drinkshot.onboarding.v1';

/** Wie lange ein Coachmark stehen bleibt, wenn niemand ihn wegtippt. */
export const COACHMARK_MS = 5200;
