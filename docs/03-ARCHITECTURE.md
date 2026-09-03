# DRINKSHOT — Technische Architektur

> Version 1.0 · Für Claude Code verbindlich. Abweichungen nur mit kurzer Begründung in `docs/DECISIONS.md` (ADR-Stil, 5 Zeilen reichen).

---

## 1. Stack-Entscheidung

| Schicht         | Wahl                                                                                               | Begründung                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Build           | **Vite 6** + TypeScript 5 (strict)                                                                 | Schnellster Dev-Loop, tree-shaking, PWA-Plugin vorhanden.                                               |
| Rendering Arena | **PixiJS v8**                                                                                      | WebGL/WebGPU-2D, Batch-Rendering, Filter (Shockwave, RGB-Split), Sprite-Atlas, sehr gut auf Mobile.     |
| Tweens/Timeline | **GSAP 3** (Core, kostenlos)                                                                       | Beste Timeline-API für choreografierte Todesanimationen, `ticker`-Sync mit PIXI möglich.                |
| UI-Screens      | **Vanilla TS + HTML/CSS** (Web Components leichtgewichtig, kein Framework)                         | 7 Screens rechtfertigen kein React. Weniger Bundle, weniger Overhead, volle Kontrolle über Transitions. |
| State           | Eigener **Store** (typisiert, event-basiert, ~80 Zeilen) + **XState-ähnliche FSM** handgeschrieben | Spielzustand ist eine kleine, klare State Machine. Keine Lib nötig.                                     |
| Audio           | **howler.js** (Audio-Sprites)                                                                      | iOS-Unlock, Sprite-Sheets, Fallbacks — gelöst.                                                          |
| Zufall          | `crypto.getRandomValues` + **seedbarer PRNG** (mulberry32) für Choreografie                        | Ziehung sicher; Show reproduzierbar (Debugging, Replays).                                               |
| Noise           | `simplex-noise` (klein)                                                                            | Reticle-Atem-Wobble.                                                                                    |
| PWA             | `vite-plugin-pwa` (Workbox)                                                                        | Offline, Install-Prompt.                                                                                |
| Tests           | **Vitest** (Unit) + **Playwright** (E2E, Mobile-Emulation)                                         | Ziehung/FSM/Timeline unit-testbar; Screens E2E.                                                         |
| Lint/Format     | ESLint (typescript-eslint) + Prettier                                                              | Konsistenz.                                                                                             |
| Deploy          | **GitHub Pages** (Default) via GitHub Actions; alternativ Netlify/Vercel (Config beiliegend)       | Statisch, kostenlos, ein Klick.                                                                         |

Bundle-Ziel: **≤ 450 KB JS gzip** (PIXI ~ 180 KB, GSAP ~ 25 KB, howler ~ 10 KB, Rest App), Assets initial ≤ 1 MB.

---

## 2. Ordnerstruktur

```
Drinkshot/
├─ CLAUDE.md                     # Arbeitsanweisungen für Claude Code (Regeln, Befehle, Prioritäten)
├─ README.md
├─ docs/
│  ├─ 01-GDD.md
│  ├─ 02-ART-DIRECTION.md
│  ├─ 03-ARCHITECTURE.md
│  ├─ 04-ROADMAP.md
│  ├─ 05-AUDITS.md
│  ├─ DECISIONS.md               # ADR-Log (wird von Claude Code gepflegt)
│  └─ PROGRESS.md                # Meilenstein-Status (wird von Claude Code gepflegt)
├─ index.html
├─ vite.config.ts
├─ tsconfig.json
├─ package.json
├─ public/
│  ├─ manifest.webmanifest
│  ├─ icons/                     # PWA-Icons
│  └─ fonts/                     # woff2 self-hosted
├─ assets-src/                   # Quellen (SVG), NICHT im Bundle
│  ├─ svg/shotling/…
│  ├─ svg/props/…
│  ├─ svg/scope/…
│  └─ audio-src/…
├─ scripts/
│  ├─ build-atlas.mjs            # SVG → PNG-Atlas (@1x,@2x)
│  └─ build-audio-sprite.mjs     # einzelne Sounds → Sprite + JSON
├─ src/
│  ├─ main.ts                    # Bootstrap: Store, Router, Audio-Unlock
│  ├─ config/
│  │  ├─ theme.ts                # Farb-/Motion-Tokens (aus Art Direction)
│  │  ├─ rules.ts                # Spielregeln: min/max Bet, Modi, Dauer-Presets
│  │  └─ choreo.ts               # Timing-Presets der Scope-Show
│  ├─ core/
│  │  ├─ store.ts                # typisierter Event-Store
│  │  ├─ fsm.ts                  # Game-State-Machine
│  │  ├─ rng.ts                  # secureRandom + seeded PRNG
│  │  ├─ lottery.ts              # pickVictim, computeOdds
│  │  ├─ choreographer.ts        # generiert Target-Script (Reticle-Timeline) aus Seed + Opfer
│  │  ├─ session.ts              # Spieler, Runden, Scoreboard, Persistenz (localStorage)
│  │  └─ i18n.ts
│  ├─ ui/                        # DOM-Screens
│  │  ├─ router.ts               # Screen-Wechsel + Wipes
│  │  ├─ components/             # button, badge, stepper, sheet, toast
│  │  └─ screens/
│  │     ├─ TitleScreen.ts
│  │     ├─ LobbyScreen.ts
│  │     ├─ PassScreen.ts
│  │     ├─ BetScreen.ts
│  │     ├─ ArenaScreen.ts       # hostet das PIXI-Canvas
│  │     ├─ ResultScreen.ts
│  │     ├─ SettingsSheet.ts
│  │     └─ RulesSheet.ts
│  ├─ game/                      # PIXI-Welt
│  │  ├─ ArenaApp.ts             # PIXI.Application-Lifecycle, Resize, Ticker
│  │  ├─ Arena.ts                # Boden, Props, Laufzone
│  │  ├─ Shotling.ts             # gerigged Charakter (Container + Parts + Tint + Face/Hat)
│  │  ├─ ShotlingBrain.ts        # Wander-Steering, Reaktion auf Reticle
│  │  ├─ Scope.ts                # Vignette, Reticle, Lock-UI, Filter
│  │  ├─ Camera.ts               # Zoom/Shake/Parallax/Slow-Mo
│  │  ├─ ShowDirector.ts         # spielt das Target-Script ab, triggert Shot + Death
│  │  ├─ fx/
│  │  │  ├─ ParticlePool.ts
│  │  │  ├─ MuzzleFlash.ts
│  │  │  ├─ SpeechBubble.ts
│  │  │  └─ Tombstone.ts
│  │  └─ deaths/
│  │     ├─ DeathSequence.ts     # Interface + Registry + Auswahl (Zone, No-Repeat)
│  │     ├─ head/HelmetSpin.ts, HatLaunch.ts, Xray.ts
│  │     ├─ body/Dramatic.ts, Deflate.ts, FreezeShatter.ts
│  │     ├─ leg/Hop.ts, Spin.ts
│  │     ├─ butt/Rocket.ts, Hotfoot.ts
│  │     ├─ miss/MissThenHit.ts
│  │     └─ miracle/Dodge.ts
│  ├─ audio/
│  │  ├─ AudioManager.ts         # howler-Wrapper, Unlock, Sprite-Map, Musik-Ducking
│  │  └─ sprite.json
│  ├─ i18n/
│  │  ├─ de.json
│  │  └─ en.json
│  └─ styles/
│     ├─ tokens.css
│     ├─ base.css
│     └─ components.css
├─ tests/
│  ├─ unit/lottery.test.ts, fsm.test.ts, choreographer.test.ts, deathRegistry.test.ts
│  └─ e2e/flow.spec.ts, perf.spec.ts
└─ .github/workflows/ci.yml, deploy.yml
```

---

## 3. Game-State-Machine

```
             ┌──────────┐
             │  TITLE   │
             └────┬─────┘
                  │ start
             ┌────▼─────┐   editPlayers/settings
   ┌────────►│  LOBBY   │◄─────────────────────┐
   │         └────┬─────┘                      │
   │              │ begin (players ≥ 2)        │
   │         ┌────▼─────┐                      │
   │         │  PASS    │  (playerIndex i)     │
   │         └────┬─────┘                      │
   │              │ tap                        │
   │         ┌────▼─────┐                      │
   │         │  BET     │                      │
   │         └────┬─────┘                      │
   │   confirm    │  i < n-1 → PASS(i+1)       │
   │              │  i = n-1 → drawVictim()    │
   │         ┌────▼─────┐                      │
   │         │  ARENA   │  ShowDirector läuft  │
   │         └────┬─────┘                      │
   │              │ showFinished                │
   │         ┌────▼─────┐                      │
   │         │  RESULT  │──────────────────────┘
   │         └────┬─────┘   changePlayers
   │              │ nextRound → PASS(0)
   └──────────────┘ (via LOBBY nur bei changePlayers)
```

**Übergangsregeln:**

- `drawVictim()` wird **genau einmal** beim Übergang BET→ARENA aufgerufen und legt `round.victimId`, `round.deathId`, `round.seed` fest. ARENA liest nur, entscheidet nichts.
- `RESULT` schreibt Runde ins Session-Log (localStorage), erhöht Scoreboard.
- Jeder State hat `enter/exit`-Hooks (Audio, Wake-Lock, Screen-Mount/Unmount).
- Browser-Back-Button: In PASS/BET/ARENA abgefangen ("Runde abbrechen?"-Dialog), sonst normale Navigation.

---

## 4. Datenmodell

```ts
type PlayerId = string;

interface Player {
  id: PlayerId;
  name: string; // max 12
  colorId: ColorId; // 'red' | 'blue' | …
  hatId?: HatId; // pro Runde neu gewürfelt
}

interface Bet {
  playerId: PlayerId;
  sips: number;
} // 1..10

interface RoundSetup {
  seed: number; // für Choreo + Death-Auswahl (nicht für die Ziehung!)
  bets: Bet[];
  victimId: PlayerId; // Ergebnis der sicheren Ziehung
  deathId: DeathId; // gewählte Todesanimation
  mode: GameMode;
  durationPreset: 'short' | 'normal' | 'long';
}

interface RoundResult extends RoundSetup {
  drinkers: { playerId: PlayerId; sips: number }[]; // aus Modus abgeleitet
  odds: Record<PlayerId, number>; // p_i, für Reveal-Tabelle
  finishedAt: number;
}

interface Session {
  players: Player[];
  rounds: RoundResult[];
  settings: Settings;
}

interface Settings {
  mode: GameMode; // 'classic' | 'distributor' | 'suddenDeath' | 'doubleTap'
  duration: 'short' | 'normal' | 'long';
  sound: boolean;
  music: number;
  haptics: boolean;
  miracles: boolean;
  lowEffects: boolean; // auto-detect + manuell
  locale: 'de' | 'en';
}
```

Persistenz: `localStorage['drinkshot.session.v1']` (Spieler, Settings, Scoreboard). Runden-History max. 50 Einträge.

---

## 5. Choreographer (Target-Script)

**Input:** `players[]`, `victimId`, `seed`, `durationPreset`, `deathId`
**Output:** `ShowScript`

```ts
interface ShowScript {
  totalMs: number;
  beats: Beat[];
}
type Beat =
  | { t: number; type: 'intro' }
  | { t: number; type: 'aim'; target: PlayerId; holdMs: number; style: 'smooth' | 'snap' }
  | { t: number; type: 'fakeLock'; target: PlayerId; holdMs: number }
  | { t: number; type: 'lock'; target: PlayerId; holdMs: number }
  | { t: number; type: 'shot' }
  | { t: number; type: 'death'; deathId: DeathId }
  | { t: number; type: 'outro' };
```

**Algorithmus (deterministisch bei Seed):**

1. Phase-Budget aus Preset (`choreo.ts`): intro 10 %, scan 30 %, panic 33 %, lock 17 %, rest death.
2. Scan: Permutation aller Spieler (Fisher-Yates, seeded), jeder 1× mit `holdMs ∈ [600,1200]`.
3. Panic: `k` Beats mit `holdMs ∈ [300,700]`, Ziel zufällig, aber **nie zweimal hintereinander gleich** und **Opfer-Anteil ≤ 1/n + 5 %** (Fairness-Check im Unit-Test).
4. Fake-Locks: 1 (short) / 2 (normal/long), Ziel ≠ Opfer, das letzte Fake ist der letzte Beat vor dem Lock.
5. Lock auf Opfer, dann `shot`, dann `death` (bei Leg-/Miss-Deaths enthält die DeathSequence selbst den zweiten Schuss).
6. Bei 2 Spielern: min. 4 Aim-Beats in Panic erzwingen.

Der `ShowDirector` spielt das Skript mit einer **GSAP-Timeline** ab (ein Timeline-Objekt, `timeScale` für Slow-Mo, `pause/resume` bei Tab-Wechsel → `visibilitychange`).

---

## 6. DeathSequence-Interface

```ts
interface DeathContext {
  victim: Shotling;
  others: Shotling[];
  scope: Scope;
  camera: Camera;
  fx: FxKit;
  audio: AudioManager;
  rng: SeededRng;
  arena: Arena;
}

interface DeathSequence {
  id: DeathId;
  zone: 'head' | 'body' | 'leg' | 'butt' | 'miss' | 'miracle';
  weight: number; // Auswahl-Gewicht (miracle sehr klein)
  needsSecondShot: boolean;
  build(ctx: DeathContext): gsap.core.Timeline; // liefert fertige Timeline inkl. Sound-Cues
}
```

- Registry: `deaths/index.ts` exportiert alle. Auswahl: gewichtete Zufallswahl mit `SeededRng`, **No-Repeat-Fenster 4** (die letzten 4 Deaths der Session sind ausgeschlossen, solange ≥ 8 verfügbar).
- Jede Sequenz bekommt einen **Unit-Test**, der `build()` aufruft und prüft: Timeline-Dauer innerhalb 1.5–4.5 s, endet mit `victim.state === 'dead'` (außer miracle), keine Exceptions.
- Jede Sequenz hat einen **Dev-Preview-Eintrag** (siehe 9. Dev-Tools), damit man sie einzeln ansehen kann.

---

## 7. Performance-Regeln (verbindlich)

1. **Ein** PIXI.Application, wird beim ersten Betreten der ARENA erzeugt und danach **wiederverwendet** (nicht pro Runde neu). Zwischen Runden `stage` leeren, Pools behalten.
2. `resolution = Math.min(devicePixelRatio, 2)`, `autoDensity: true`, `antialias: false` (Outlines sind ohnehin im Sprite), `powerPreference: 'high-performance'`.
3. Alle Sprites aus **einem Atlas** je Kategorie → ≤ 3 Draw-Calls-Batches in der Arena-Szene. Keine `Graphics`-Objekte im Frame-Loop (nur einmalig beim Setup, dann `cacheAsTexture`).
4. Filter (Shockwave, RGBSplit) nur auf dem **Scope-Container**, nie auf der ganzen Stage, und nur während sie aktiv sind (`filters = null` danach).
5. Partikel aus Pools; `ParticleContainer` für Konfetti/Staub.
6. Text im Canvas nur via `BitmapText` (Font-Atlas aus Luckiest Guy generiert); DOM für alles andere.
7. Ticker: PIXI-Ticker treibt GSAP (`gsap.ticker.remove(gsap.updateRoot)`, manuelles `gsap.updateRoot(time)` im PIXI-Ticker) → eine Uhr, kein Doppel-RAF.
8. `visibilitychange` → Ticker stoppen, Audio pausieren, Timeline pausieren.
9. **Low-Effects-Modus** automatisch, wenn: `deviceMemory ≤ 3` oder `hardwareConcurrency ≤ 4` oder gemessener Frame-Median in den ersten 2 s der Arena > 22 ms. Low-Mode: Filter aus, Partikel halbiert, Wobble aus, resolution = 1.
10. Budget pro Frame: Update ≤ 4 ms, Render ≤ 8 ms auf Referenzgerät (Pixel 4a).
11. Keine Allokationen im Loop (keine Closures/Arrays pro Frame in `update()`); Vektoren wiederverwenden.
12. Assets: Preload aller Arena-Assets **während der Betting-Phase** (die dauert ohnehin ≥ 10 s) mit `PIXI.Assets.backgroundLoad`.

---

## 8. Layout & Responsiveness

- Root-Container `#app` = 100dvh, `overflow: hidden`, `touch-action: manipulation`, `user-select: none`, `overscroll-behavior: none`.
- Safe-Areas: `padding: env(safe-area-inset-*)`.
- Mobile: Screens füllen den Viewport. Desktop (≥ 768 px Breite): `#app` wird zu einem 9:16-Frame (max 480 × 854), zentriert, mit animiertem Hintergrund (langsam wandernde Reticle-Muster in `bg.deep`), Ecken 32 px radius — der "Handy-im-Browser"-Look.
- Landscape auf Mobile: Overlay "Bitte Handy drehen" (nicht blockierend auf Desktop).
- PIXI-Canvas: `resizeTo` = Arena-Host-Element, Weltkoordinaten in **logischen 1000 × 1000 Einheiten** (Kreis-Arena Ø 900), Skalierung per Stage-Scale → Layout ist auflösungsunabhängig.

---

## 9. Dev-Tools (für die Audits unverzichtbar)

- `?dev=1` in der URL aktiviert ein Debug-Panel (lil-gui oder eigenes Mini-Panel):
  - Death-Preview: Dropdown aller `DeathId`s + "Play" (spielt Sequenz direkt in der Arena, ohne Betting).
  - Choreo-Preview: Seed-Eingabe, Spieleranzahl, "Play Show".
  - FPS/Frame-Time-Overlay (PIXI-Stats).
  - Toggles: Low-Effects, Slow-Mo-Faktor, Filter an/aus.
  - "Simulate 10 000 draws" → zeigt Verteilung vs. Erwartung.
- `npm run preview:deaths` öffnet die App direkt in der Death-Preview.

---

## 10. Sicherheit / Datenschutz

- Keine Netzwerk-Calls nach dem Laden (außer SW-Update-Check). Keine Analytics. Keine Cookies.
- CSP im `index.html`: `default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'`.
- Namen bleiben lokal.

---

## 11. Deployment

- `deploy.yml`: bei Push auf `main` → `npm ci && npm run build && npm test` → GitHub Pages (`gh-pages`-Branch oder Pages-Artifact). `base` in Vite = `/Drinkshot/`.
- Optional Netlify: `netlify.toml` beiliegend (Build `npm run build`, Publish `dist`).
- Versionierung: SemVer, Tag pro Milestone (`v0.1.0` … `v1.0.0`), Changelog in `CHANGELOG.md`.

---

## 12. Definition "flüssig" (messbar)

Playwright-Perf-Test (`tests/e2e/perf.spec.ts`) startet die Arena mit 8 Spielern im Chromium-Mobile-Profil mit CPU-Throttling 4×, sammelt 10 s lang Frame-Zeiten via `requestAnimationFrame` und schlägt fehl, wenn:

- p50 Frame-Time > 20 ms (≈ 50 fps) im Normal-Modus
- p95 Frame-Time > 40 ms
- Long-Tasks > 50 ms während der Death-Sequenz: mehr als 2

Das ist der automatisierte Teil des Performance-Audits; der manuelle Teil steht in `05-AUDITS.md`.
