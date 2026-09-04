/**
 * Design-Tokens — abgeleitet aus `docs/02-ART-DIRECTION.md`.
 * Einzige Quelle fuer Farben, Motion und Typo-Skala im TS-Code.
 * Das CSS-Pendant liegt in `src/styles/tokens.css` und muss synchron bleiben.
 */

/* ------------------------------------------------------------------ */
/* Spielerfarben (Art Direction §2.1 / GDD §3.1) — unveraenderlich     */
/* ------------------------------------------------------------------ */

export const PLAYER_COLORS = [
  { id: 'red', hex: 0xff4757, shade: 0xc0392b, symbol: 'circle', nickname: 'Rudi' },
  { id: 'blue', hex: 0x3b82f6, shade: 0x1e5bb8, symbol: 'triangle', nickname: 'Blue' },
  { id: 'green', hex: 0x2ed573, shade: 0x1e9e52, symbol: 'square', nickname: 'Gustav' },
  { id: 'yellow', hex: 0xffd32a, shade: 0xd4a800, symbol: 'star', nickname: 'Yoshi' },
  { id: 'purple', hex: 0xa55eea, shade: 0x7b3fbf, symbol: 'diamond', nickname: 'Lilo' },
  { id: 'orange', hex: 0xff7f50, shade: 0xcc5a2e, symbol: 'heart', nickname: 'Olli' },
  { id: 'pink', hex: 0xff6b9d, shade: 0xc94a78, symbol: 'bolt', nickname: 'Pinky' },
  { id: 'cyan', hex: 0x18dcff, shade: 0x0fa6c2, symbol: 'cross', nickname: 'Turbo' },
] as const;

export type ColorId = (typeof PLAYER_COLORS)[number]['id'];
export type SymbolId = (typeof PLAYER_COLORS)[number]['symbol'];

export const COLOR_IDS = PLAYER_COLORS.map((c) => c.id) as readonly ColorId[];

const COLOR_BY_ID = new Map<ColorId, (typeof PLAYER_COLORS)[number]>(PLAYER_COLORS.map((c) => [c.id, c]));

export function colorById(id: ColorId): (typeof PLAYER_COLORS)[number] {
  const found = COLOR_BY_ID.get(id);
  if (!found) throw new Error(`Unbekannte ColorId: ${id}`);
  return found;
}

/**
 * Weisser Text auf Gelb/Cyan ist laut Art Direction §2.2 verboten.
 * Diese Farben bekommen `ink` als Vordergrund.
 */
const DARK_TEXT_COLORS: readonly ColorId[] = ['yellow', 'cyan', 'green'];

export function textColorOn(id: ColorId): number {
  return DARK_TEXT_COLORS.includes(id) ? UI_COLORS.ink : UI_COLORS.paper;
}

/* ------------------------------------------------------------------ */
/* UI-Farben (Art Direction §2.2)                                      */
/* ------------------------------------------------------------------ */

export const UI_COLORS = {
  bgDeep: 0x0f0e1a,
  bgPanel: 0x1c1b2e,
  bgPanelRaised: 0x27263d,
  ink: 0x1a1024,
  paper: 0xfff8e7,
  accent: 0xffb800,
  accentShade: 0xd18e00,
  danger: 0xff2d55,
  success: 0x2ed573,
  arenaGrass: 0x6bcb5c,
  arenaGrassDark: 0x4ea544,
  arenaSand: 0xe8c874,
  scopeVignette: 0x05040a,
  scopeGlass: 0x8fd3ff,
} as const;

export const SCOPE = {
  /** Alpha der Vignette ausserhalb des Sichtfensters. */
  vignetteAlpha: 0.92,
  /** Alpha-Puls im Lock (Herzschlag-Takt). */
  vignetteAlphaLocked: 0.97,
  /** Weicher Rand statt harter Kante, in px. */
  edgeBlurPx: 24,
  /** Freier Kreis in der Mitte, damit das Maennchen nicht verdeckt wird. */
  centerClearDiameterPx: 36,
  /** Glas-Tint ueber der Arena. */
  glassAlpha: 0.06,
  lensDirtAlpha: 0.06,
  /** Atem-Wobble: Amplitude px / Frequenz Hz (simplex-noise). */
  breathAmplitudePx: 3,
  breathFrequencyHz: 0.4,
  /** Zoom beim Lock. */
  lockZoom: 1.15,
} as const;

/* ------------------------------------------------------------------ */
/* Typografie (Art Direction §3)                                       */
/* ------------------------------------------------------------------ */

export const FONTS = {
  display: '"Luckiest Guy", "Comic Sans MS", system-ui, sans-serif',
  body: '"Nunito", system-ui, -apple-system, "Segoe UI", sans-serif',
} as const;

/** Groessen-Skala in px (root 16). */
export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  '2xl': 40,
  hero: 64,
  mega: 96,
} as const;

/** Sticker-Look: Outline-Stroke + Drop-Shadow fuer Display-Zahlen. */
export const STICKER = {
  strokeWidthPx: 4,
  strokeColor: UI_COLORS.ink,
  shadowOffsetYPx: 4,
  shadowColor: UI_COLORS.ink,
} as const;

/* ------------------------------------------------------------------ */
/* Motion (Art Direction §9)                                           */
/* ------------------------------------------------------------------ */

export const MOTION = {
  fast: 120, // Tap-Feedback
  base: 260, // Screen-Elemente
  slow: 420, // Wipes, grosse Panels
  reticleHop: [300, 600] as const, // ms, random in range
  easeOvershoot: 'back.out(2.5)',
  easeSnappy: 'power3.inOut',
  easeDrop: 'bounce.out',
  easeElastic: 'elastic.out(1, 0.4)',
  /** Screen-Wipe zwischen den Screens (Art Direction §4.6). */
  wipeMs: 320,
  /** Bottom-Sheet Slide-up (§4.5). */
  sheetMs: 260,
  sheetEase: 'cubic-bezier(.2,.9,.3,1.2)',

  /** Result: Zahlen zaehlen hoch, Balken wachsen (Roadmap M5.3). */
  countUpMs: 620,
  /** Versatz zwischen zwei Scoreboard-Zeilen — die Tabelle baut sich von oben auf. */
  staggerMs: 70,
} as const;

/** Alias fuer die DOM-Helfer in `ui/animate.ts` — dieselben Werte, sprechender Name. */
export const UI_TIMING = MOTION;

/* ------------------------------------------------------------------ */
/* Animations-Konstanten fuer Tode (Art Direction §5.2)                */
/* ------------------------------------------------------------------ */

export const ANIM: {
  hitStopMs: number;
  squashScaleX: number;
  squashScaleY: number;
  squashMs: number;
  followThroughMs: readonly [number, number];
  shakeMs: number;
  shakeAmplitudePx: number;
  deathMinMs: number;
  deathMaxMs: number;
} = {
  /** Hit-Stop beim Treffer. */
  hitStopMs: 80,
  /** Squash & Stretch beim Aufprall. */
  squashScaleX: 1.3,
  squashScaleY: 0.7,
  squashMs: 60,
  /** Follow-Through: Hut/Arme kommen spaeter an. */
  followThroughMs: [100, 150] as const,
  /** Screen-Shake (GDD §4.2). */
  shakeMs: 250,
  shakeAmplitudePx: 12,
  /** Erlaubte Dauer einer DeathSequence (Architektur §6). */
  deathMinMs: 1500,
  deathMaxMs: 4500,
} as const;

/* ------------------------------------------------------------------ */
/* Partikel-Budget (Art Direction §8)                                  */
/* ------------------------------------------------------------------ */

export const PARTICLE_BUDGET = {
  impactStars: { max: 8, lifeMs: 900 },
  runDust: { maxPerShotling: 2, lifeMs: 400 },
  smokePuff: { max: 6, lifeMs: 500 },
  confetti: { max: 80, lifeMs: 2500 },
  dirtFountain: { max: 14, lifeMs: 600 },
  feathersShards: { max: 8, lifeMs: 1200 },
  /** Harte Obergrenze aktiver Sprites in der Arena. */
  maxActiveSprites: 150 as number,
} as const;

/* ------------------------------------------------------------------ */
/* Arena / Rendering (Architektur §7 + §8)                             */
/* ------------------------------------------------------------------ */

export const ARENA = {
  /** Logische Weltgroesse, aufloesungsunabhaengig. */
  worldSize: 1000,
  /** Kreis-Arena Durchmesser in Welteinheiten. */
  circleDiameter: 900,
  /**
   * Shotling-Hoehe in Welteinheiten, abhaengig von der Spielerzahl (ADR-13):
   * zu zweit ist Platz, zu acht muss jeder trotzdem einzeln lesbar bleiben.
   */
  shotlingHeight: { min: 200, max: 250 } as const,
  /** Kopf = 45 % der Koerperhoehe (Chibi-Proportion). */
  headRatio: 0.45,
  maxProps: 4,
  /** Anteil des Bodenradius, in dem die Maennchen laufen duerfen. */
  walkRadiusFactor: 0.78,
  /** Mindestabstand zweier Shotlings als Anteil ihrer Hoehe (etwas mehr als eine Kopfbreite). */
  separationFactor: 0.66,
  /** Speed-Multiplikatoren je Phase (GDD §5.1). */
  speed: { scan: 1.0, panic: 1.6, lock: 0.4 } as const,
  /** Schritte pro Sekunde bei Speed 1. */
  stepsPerSecond: 6,
  /** Blinzeln alle 2-5 s, Dauer 120 ms. */
  blinkIntervalMs: [2000, 5000] as const,
  blinkDurationMs: 120,
} as const;

export const RENDER = {
  maxResolution: 2,
  antialias: false,
  powerPreference: 'high-performance',
  /** Low-Effects-Auto-Detect-Schwellen (Architektur §7.9). */
  lowEffects: {
    deviceMemoryMax: 3,
    hardwareConcurrencyMax: 4,
    frameMedianMaxMs: 22,
    probeDurationMs: 2000,
  },
  /** Frame-Budget auf dem Referenzgeraet (Architektur §7.10). */
  budgetMs: { update: 4, render: 8 },
} as const;

/** Alle 7 Hut-Varianten (Art Direction §5.1). */
export const HAT_IDS = ['none', 'cap', 'party', 'tophat', 'helmet', 'crown', 'beanie'] as const;
export type HatId = (typeof HAT_IDS)[number];

/** Wahrscheinlichkeit, dass ein Shotling einen Hut traegt. */
export const HAT_CHANCE = 0.6;

/** Alle 9 Gesichter (Art Direction §5.1). */
export const FACE_IDS = [
  'neutral',
  'blink',
  'scared',
  'panic',
  'x_eyes',
  'spiral',
  'happy',
  'ouch',
  'wave',
] as const;
export type FaceId = (typeof FACE_IDS)[number];

/**
 * Shotling-Hoehe fuer eine Spielerzahl. Zwischen 2 und 8 Spielern linear interpoliert,
 * damit die Laufzone nie zugestopft wirkt und Duelle trotzdem gross aussehen.
 */
export function shotlingHeightFor(playerCount: number): number {
  const clamped = Math.min(8, Math.max(2, playerCount));
  const t = (clamped - 2) / 6;
  return ARENA.shotlingHeight.max + (ARENA.shotlingHeight.min - ARENA.shotlingHeight.max) * t;
}

/** Hex-Zahl -> CSS-Farbstring. */
export function hex(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}
