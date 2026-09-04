# DRINKSHOT — Art Direction & Design-System

> Version 1.0 · Dieses Dokument definiert, wie das Spiel **aussieht und sich anfühlt**. Claude Code hält sich an die Tokens in `src/config/theme.ts`, die aus diesem Dokument abgeleitet werden.

---

## 1. Stil-Statement

**"Saturday-Morning-Cartoon trifft Looney-Tunes-Slapstick, gefilmt durch ein Spionage-Zielfernrohr."**

- **Formensprache:** Runde, weiche Silhouetten. Dicke, dunkle Outlines (3–4 px bei 1×), leicht ungleichmäßig (Hand-drawn-Feeling). Keine harten 90°-Ecken an Charakteren.
- **Proportionen Männchen:** Chibi. Kopf = 45 % der Körperhöhe, riesige Augen, kleine Stummelarme/-beine, keine Finger. Höhe im Spiel ~ 90 px bei 1× Portrait 390 px Breite.
- **Farben:** Satt, hoher Kontrast, flächig mit **einem** Schattenton pro Fläche (Cel-Shading, 2 Stufen). Keine Verläufe auf Charakteren; Verläufe nur für Himmel/Boden/UI-Glow.
- **Licht:** Sonniges Tageslicht (Standard-Arena), leichter warmer Tint. Schatten der Männchen = weiche Ellipse (Blob-Shadow), keine Ray-Cast-Schatten.
- **Ton:** Nie brutal, nie realistisch. Alles, was ein 8-Jähriger im Samstagmorgen-Cartoon sehen dürfte. Kein Blut, kein Gewehr sichtbar.

**Referenz-Vibes (nur als Stimmung, nichts kopieren):** Fall Guys (Rundheit, Comedy-Ragdoll), Cuphead (Outline-Charakter, Bounce), Worms (Team-Farben, kleine Männchen, Slapstick-Tode), Among-Us-Farbcodierung (Farbe = Identität).

---

## 2. Farb-Tokens

### 2.1 Spielerfarben (identisch zum GDD, unveränderlich)

```ts
export const PLAYER_COLORS = [
  { id: 'red', hex: 0xff4757, shade: 0xc0392b, symbol: 'circle' },
  { id: 'blue', hex: 0x3b82f6, shade: 0x1e5bb8, symbol: 'triangle' },
  { id: 'green', hex: 0x2ed573, shade: 0x1e9e52, symbol: 'square' },
  { id: 'yellow', hex: 0xffd32a, shade: 0xd4a800, symbol: 'star' },
  { id: 'purple', hex: 0xaf73ee, shade: 0x7b3fbf, symbol: 'diamond' },
  { id: 'orange', hex: 0xff7f50, shade: 0xcc5a2e, symbol: 'heart' },
  { id: 'pink', hex: 0xff6b9d, shade: 0xc94a78, symbol: 'bolt' },
  { id: 'cyan', hex: 0x18dcff, shade: 0x0fa6c2, symbol: 'cross' },
] as const;
```

### 2.2 UI-Farben

| Token             | Hex       | Verwendung                                         |
| ----------------- | --------- | -------------------------------------------------- |
| `bg.deep`         | `#0F0E1A` | App-Hintergrund (Nacht-Indigo), Scope-Außenbereich |
| `bg.panel`        | `#1C1B2E` | Cards, Bottom-Sheets                               |
| `bg.panelRaised`  | `#27263D` | Buttons secondary, Chips                           |
| `ink`             | `#1A1024` | Outlines, Text auf hellen Flächen                  |
| `paper`           | `#FFF8E7` | Primärtext auf dunklem Hintergrund, Sprechblasen   |
| `accent`          | `#FFB800` | Primary CTA ("Spielen", "Los geht's"), Highlights  |
| `accentShade`     | `#D18E00` | CTA-Schatten (3D-Button-Kante)                     |
| `danger`          | `#FF2D55` | Reticle im Lock, "trinkt"-Zeile                    |
| `success`         | `#2ED573` | Miracle, Bestätigt-States                          |
| `arena.grass`     | `#6BCB5C` | Arena-Boden hell                                   |
| `arena.grassDark` | `#4EA544` | Arena-Boden Muster / Ring                          |
| `arena.sand`      | `#E8C874` | Alternative / Requisiten-Boden                     |
| `scope.vignette`  | `#05040A` | Vignette außen, Alpha 0.92                         |
| `scope.glass`     | `#8FD3FF` | Leichter Glas-Tint 6 % über der Arena              |

Kontrast: Jeder Text ≥ 4.5:1 gegen seinen Hintergrund (WCAG AA). `accent` auf `bg.deep` = 9.8:1 ✔. Weiße Texte auf Spielerfarbe Gelb/Cyan sind **verboten** → dort `ink` verwenden.

### 2.3 Dark-only

Das Spiel ist **immer dunkel** (Party-Umgebung, Scope-Ästhetik). Kein Light-Mode. `color-scheme: dark` im Root, `theme-color` Meta = `#0F0E1A`.

---

## 3. Typografie

- **Display / Headlines:** _Luckiest Guy_ (Google Fonts) — dick, cartoony, schräg. Für Logo, "trinkt N Schlücke", Zahlen im Bet-Screen, Sprechblasen-Text.
- **UI / Body:** _Nunito_ (Google Fonts, Weights 600/800) — rund, freundlich, sehr gut lesbar auf Mobile.
- Fonts werden **self-hosted** (woff2 im Bundle), nicht von Google geladen → offline-fähig, kein FOUT bei schlechtem WLAN. Beide via `font-display: swap`, Subset Latin.
- Größen-Skala (Mobile, rem-basiert, root 16 px): `xs 12`, `sm 14`, `md 16`, `lg 20`, `xl 28`, `2xl 40`, `hero 64` (Bet-Zahl), `mega 96` (Result-Zahl).
- Zahlen in Display-Font bekommen immer einen **Outline-Stroke** (`-webkit-text-stroke` bzw. PIXI `stroke`) in `ink`, 4 px, plus Drop-Shadow 0/4/0 `ink`. Das ist der "Sticker-Look".

---

## 4. UI-Komponenten (HTML/CSS-Layer)

Die Menü-Screens sind **DOM** (HTML/CSS), die Arena ist **PixiJS-Canvas**. Grund: DOM ist für Text, Buttons, Scrolling, Accessibility und i18n besser; Canvas nur dort, wo es um Bewegung geht.

### 4.1 Button "Sticker"

- Höhe 64 px (Touch-Ziel), Border-Radius 20 px, Fläche `accent`, 3 px `ink`-Outline, **6 px Bottom-Kante** in `accentShade` (3D-Look).
- Press-State: translateY(4px), Kante 2 px → fühlt sich wie ein echter Knopf an. 90 ms.
- Hover (Desktop): scale(1.03), Idle-Wobble alle 4 s (± 1.5°) beim Primary-CTA.
- Varianten: `primary` (accent), `secondary` (bg.panelRaised, paper-Text), `danger`, `ghost`.

### 4.2 Player-Badge

- Kreis 56 px in Spielerfarbe, `ink`-Outline 3 px, Symbol in `ink` zentriert, Name darunter in Nunito 800.
- In der Lobby: kleines Männchen-Portrait (Kopf) statt reinem Kreis — die Spieler sollen "ihr" Männchen sehen.

### 4.3 Bet-Stepper

- Zahl `hero` in Luckiest Guy in Spielerfarbe mit Outline. Beim Ändern: Scale-Punch 1.0 → 1.25 → 1.0 (180 ms, back-out) und die Zahl "springt" (translateY −8 px).
- +/– Buttons je 72 px, rund. Long-Press = Auto-Repeat (300 ms initial, dann 90 ms).
- Unter der Zahl eine **Risiko-Ampel** (nur relativ: "Vorsichtig / Mutig / Wahnsinnig" für 1–3 / 4–6 / 7–10), damit Neulinge den Einsatz einordnen.

### 4.4 Pass-Screen

- Vollfläche in Spielerfarbe, diagonales, langsam wanderndes Streifenmuster (10 % dunkler), großes Männchen der Farbe in Idle-Animation (atmet, blinzelt), Text in `ink` oder `paper` je nach Kontrast.
- Instruktion: "Gib das Handy an" (sm) / "**{Name}**" (2xl) / "Tippe, wenn nur du aufs Display schaust" (sm).
- Tap → Wipe in Spielerfarbe von unten nach oben zum Bet-Screen.

### 4.5 Bottom-Sheet (Regeln, Settings)

- `bg.panel`, Radius 28 px oben, Drag-Handle, Slide-up 260 ms `cubic-bezier(.2,.9,.3,1.2)`.

### 4.6 Transitions zwischen Screens

- **Farb-Wipe** (Spielerfarbe oder `accent`), diagonal, 320 ms. Nie Cross-Fade — Wipes sind cartooniger.
- Screen-Reihenfolge bestimmt Richtung (vorwärts: von rechts, zurück: von links).

---

## 5. Die Männchen ("Shotlings")

Interner Name der Charaktere: **Shotlings**.

### 5.1 Rig (Sprite-Teile, alle weiß mit `ink`-Outline, Tint = Spielerfarbe)

```
shotling/
  head.png        (128×128)  – runder Kopf, Ohren-Bumps
  torso.png       (96×96)    – Bohnenform
  arm.png         (32×64)    – Stummel, Pivot oben
  leg.png         (32×56)    – Stummel, Pivot oben
  foot.png        (44×24)    – Schuh, immer `ink`
  shadow.png      (128×48)   – weiche Ellipse, Alpha 0.35
  faces/          – neutral, blink, scared, panic, x_eyes, spiral, happy, ouch, wave (jeweils 96×64, NICHT getintet)
  hats/           – none, cap, party, tophat, helmet, crown, beanie (Zufall pro Runde, ~60 % tragen einen)
  symbols/        – circle, triangle, square, star, diamond, heart, bolt, cross (auf dem Torso, `ink`)
```

- Hierarchie in PIXI: `Container(root) > shadow, legL, legR, torso(+symbol), armL, armR, head(+face, +hat)`.
- Standardpose: leichtes Squash-and-Stretch beim Laufen (Torso scaleY 0.94↔1.06 im Takt der Schritte, 6 Schritte/s bei Speed 1).
- Blinzeln alle 2–5 s (face → blink → face, 120 ms).
- Alle Sprites in **einem Atlas** (`shotlings.json` + `shotlings.png`, 2048×2048 @2×), generiert per TexturePacker-CLI oder `@pixi/assetpack`.

### 5.2 Animations-Prinzipien (verbindlich für alle Tode)

1. **Anticipation** — Vor jeder großen Bewegung 2–4 Frames Gegenbewegung (Kopf zieht sich ein, bevor er wegfliegt).
2. **Squash & Stretch** — Beim Aufprall Torso scaleX 1.3 / scaleY 0.7 für 60 ms.
3. **Overshoot** — Alle Easings für Comedy: `back.out(2.5)` / `elastic.out(1, 0.4)`, nie linear.
4. **Hit-Stop** — 80 ms Freeze beim Treffer, dann Explosion der Bewegung.
5. **Follow-Through** — Hut/Arme kommen 100–150 ms nach dem Körper an.
6. **Lesbarkeit** — Silhouette muss in jedem Key-Frame eindeutig sein; der Spieler darf nie fragen "was ist da gerade passiert?".
7. **Sound-Sync** — Jeder Key-Frame hat einen Sound-Cue in derselben Timeline.

---

## 6. Scope-Overlay (das "Objektiv")

- Rundes Sichtfenster, Durchmesser = min(viewportWidth − 16, viewportHeight × 0.62). Außenbereich `scope.vignette` (Alpha 0.92) mit **radialem Blur-Fade** 24 px am Rand (statt harter Kante).
- Innen: dünne **Reticle-Linien** (1.5 px `paper`, Alpha 0.7) horizontal + vertikal mit Mil-Dot-Markierungen; Zentrum frei (Kreis Ø 36 px), damit das Männchen nicht verdeckt wird.
- **Das Reticle folgt dem Ziel**, nicht die Welt dem Reticle: Die Arena bleibt stabil, ein separater Reticle-Container tweent von Männchen zu Männchen (300–600 ms, `power3.inOut`), mit leichtem **Overshoot** und **Atem-Wobble** (Perlin/Simplex-Noise, ± 3 px, 0.4 Hz).
- Glas-Effekte (WebGL, abschaltbar im Low-Mode): leichter chromatischer Rand (`RGBSplitFilter` 1 px), Lens-Dirt-Sprite (Alpha 0.06), Glanz-Bogen oben links.
- **Lock-State:** Reticle wechselt Farbe `paper → danger`, die 4 Eckklammern schnappen zusammen (200 ms), am Rand blinkt "LOCK" in Luckiest Guy, Vignette pulsiert im Herzschlag-Takt (Alpha 0.92 ↔ 0.97).
- **Fake-Lock:** Gleiche Animation bis 70 % der Klammern-Schließung, dann abrupt abbrechen + Reticle springt weg (`power4.in`, 220 ms).
- **Shot:** 2 Frames Vollbild `paper`, dann `ShockwaveFilter` vom Zentrum (350 ms), Screen-Shake, Vignette-Flash rot 120 ms.
- Oben im Scope: dezente HUD-Zeile "ROUND 3 · 4 TARGETS" (Mono-Feeling via Nunito 800 Uppercase, Letter-Spacing 0.12 em) — reine Deko, aber sie verkauft die Fiktion.

---

## 7. Arena-Look

- Kreisförmige Wiese mit dunklerem Außenring (`arena.grassDark`), leichte Grasbüschel-Sprites (3 Varianten, zufällig verteilt, `zIndex` unter Männchen).
- Requisiten (Atlas `props`): Fass, Strohballen, Zielscheibe, Kaktus, Bierkiste, Schild "DANGER", Schild "BAR →". Max. 4 pro Arena, entlang des Rings, nie in der Laufzone.
- Himmel/Umgebung außerhalb des Kreises ist ohnehin durch die Vignette abgedeckt → wir zeichnen **nichts** dort (Performance!).
- Parallax: Beim Reticle-Sprung verschiebt sich die Arena um 4 % in Gegenrichtung (`power2.out`), das gibt das Gefühl, das Gewehr schwenkt.

---

## 8. Partikel & Effekte (Budget)

| Effekt             | Max. Partikel | Lebensdauer | Technik                                                              |
| ------------------ | ------------- | ----------- | -------------------------------------------------------------------- |
| Impact-Sterne      | 8             | 900 ms      | Sprite-Pool, kreisende Bahn                                          |
| Staub beim Laufen  | 2 / Männchen  | 400 ms      | Sprite-Pool                                                          |
| Rauch-Puff         | 6             | 500 ms      | Sprite-Pool, scale up + fade                                         |
| Konfetti (Result)  | 80            | 2.5 s       | `@pixi/particle-emitter` oder DOM-CSS (auf Result-Screen ist DOM ok) |
| Erd-Fontäne (Miss) | 14            | 600 ms      | Sprite-Pool, Gravity                                                 |
| Federn / Scherben  | 8             | 1.2 s       | Sprite-Pool, Rotation                                                |

**Regel:** Gesamt ≤ 150 aktive Sprites in der Arena zu jedem Zeitpunkt. Alle Partikel aus **Object-Pools**, nie `new Sprite()` im Loop.

---

## 9. Motion-Tokens

```ts
export const MOTION = {
  fast: 120, // Tap-Feedback
  base: 260, // Screen-Elemente
  slow: 420, // Wipes, große Panels
  reticleHop: [300, 600], // ms, random in range
  easeOvershoot: 'back.out(2.5)',
  easeSnappy: 'power3.inOut',
  easeDrop: 'bounce.out',
};
```

`prefers-reduced-motion`: Wipes werden zu Fades, Screen-Shake aus, Slow-Mo bleibt (ist Gameplay), Wobble aus.

---

## 10. Asset-Pipeline (für Claude Code)

- **Alle Grafiken werden als SVG gezeichnet** (`assets-src/svg/`), dann per Script (`scripts/build-atlas.mjs` mit `sharp` + `free-tex-packer-core`) in PNG-Atlanten @1×/@2× gerendert. So kann Claude Code die Charaktere **selbst erstellen** (SVG-Code ist textbasiert), und Luka kann sie später in Figma/Illustrator verfeinern, ohne dass die Pipeline bricht.
- Claude Code zeichnet die Shotlings in **Milestone 2** als SVG nach der Rig-Spezifikation oben. Es gilt: lieber einfach und sauber (Kreise, Bohnen, dicke Outlines) als detailliert und wackelig.
- Icons (Settings, Sound, Zurück): Inline-SVG im DOM, 2.5 px Stroke, `paper`.
- App-Icon/PWA: Männchen-Kopf mit Fadenkreuz über dem Auge, 512×512, maskable.

---

## 11. UX-Copy-Ton (DE)

- Kurz, frech, du-Form. Ausrufezeichen erlaubt, aber max. 1 pro Screen.
- Beispiele: "Los geht's!", "Handy weitergeben.", "Mutig.", "Rudi trinkt 5!", "Niemand trinkt. Wunder passieren.", "Nochmal?".
- Fehler (z. B. zu wenig Spieler): "Zu zweit ist's ein Duell, allein ist's traurig. Füge noch jemanden hinzu."
- Alle Strings in `src/i18n/de.json` und `en.json`; **kein hardcodierter Text** im Code.
