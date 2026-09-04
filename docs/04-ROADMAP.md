# DRINKSHOT — Roadmap: Meilensteine, Schritte, Audits

> Version 1.0 · Jeder Meilenstein endet mit einem **Audit** (siehe `05-AUDITS.md`) und einem Git-Tag. Claude Code arbeitet **einen Meilenstein pro Auftrag** ab und aktualisiert `docs/PROGRESS.md`. Nächster Meilenstein erst nach bestandenem Audit.

**Arbeitsweise mit Claude Code (Empfehlung für Luka):**

1. Pro Meilenstein einen Prompt: _"Lies CLAUDE.md und docs/. Setze Milestone M{n} aus docs/04-ROADMAP.md vollständig um. Halte dich an die Definition of Done. Führe danach das Audit A{n} aus docs/05-AUDITS.md durch und schreibe das Ergebnis nach docs/PROGRESS.md."_
2. Nach jedem Meilenstein: `npm run dev` öffnen, **auf dem Handy testen** (Vite `--host`, gleiche WLAN, QR-Code), Feedback als Issues/Notizen zurückgeben.
3. Erst wenn das Audit grün ist: Tag setzen, nächster Meilenstein.

Geschätzter Gesamtaufwand mit Claude Code: **7 Meilensteine, jeweils 1–3 Sessions.**

---

## M0 — Projekt-Setup & Skelett (Tag `v0.0.1`)

**Ziel:** Leeres, aber vollständig konfiguriertes Projekt, das auf dem Handy eine schwarze Seite mit "DRINKSHOT" zeigt und als PWA installierbar ist.

Schritte:

1. `npm create vite@latest` (vanilla-ts), Vite 6, TS strict, Pfad-Alias `@/`.
2. Dependencies: `pixi.js@^8`, `gsap`, `howler`, `simplex-noise`, `vite-plugin-pwa`; Dev: `vitest`, `@playwright/test`, `eslint`, `prettier`, `sharp`, `free-tex-packer-core`.
3. Ordnerstruktur exakt wie `03-ARCHITECTURE.md §2` anlegen (leere Dateien mit TODO-Header sind ok).
4. `src/config/theme.ts`, `rules.ts`, `choreo.ts` mit den Werten aus GDD/Art Direction befüllen.
5. `styles/tokens.css` aus den Farb-/Motion-Tokens generieren; Fonts self-hosten (woff2 in `public/fonts`, `@font-face`).
6. `index.html` mit Meta (viewport-fit=cover, theme-color, CSP), `#app`-Root, Portrait-Frame-Logik für Desktop (§8 Architektur), Landscape-Overlay.
7. `core/store.ts`, `core/fsm.ts` implementieren (alle States, noch ohne Screens — nur Logging), Unit-Tests für FSM-Übergänge.
8. `core/rng.ts` + `core/lottery.ts` implementieren, **Unit-Test: 100 000 Ziehungen, Abweichung < 1 %**, Edge-Cases (2 Spieler, alle gleich, ein Spieler 10/andere 1).
9. `i18n` mit `de.json`/`en.json` und `t()`-Helper.
10. PWA-Manifest, Icons-Platzhalter, Service Worker (Workbox `generateSW`).
11. GitHub Actions: `ci.yml` (lint, typecheck, unit-tests), `deploy.yml` (Pages).
12. `docs/PROGRESS.md` und `docs/DECISIONS.md` anlegen; `README.md` mit Dev-Befehlen.

**Definition of Done:** `npm run dev --host` zeigt auf Handy + Desktop den Titel; `npm test` grün; `npm run build` < 200 KB gzip (noch ohne Assets); Lighthouse PWA-Check "installable".

→ **Audit A0** (Setup-Audit)

---

## M1 — UI-Flow komplett (ohne Arena) (Tag `v0.1.0`)

**Ziel:** Der gesamte Spielablauf ist mit DOM-Screens durchspielbar. Statt der Arena gibt es einen Platzhalter-Screen "SHOT! → {Opfer}" nach 3 s. Ab hier kann man das Spiel bereits "auf dem Papier" spielen.

Schritte:

1. `ui/router.ts`: Screen-Mount/Unmount, Wipe-Transitions (Farb-Wipe diagonal, 320 ms), Richtung vorwärts/zurück, `prefers-reduced-motion`.
2. Komponenten: `Button` (Sticker-Look, 4 Varianten, Press-State), `PlayerBadge`, `BetStepper` (+/–, Long-Press, Punch-Animation, Risiko-Ampel), `BottomSheet`, `Toast`.
3. `TitleScreen`: Logo (CSS-Wobble), Spielen / Regeln / Settings, Sound-Toggle, Audio-Unlock beim ersten Tap, einmaliger 18+-Hinweis (localStorage-Flag).
4. `LobbyScreen`: Spieler hinzufügen/entfernen/umbenennen (2–8), Farben automatisch, Modus-Chip, Dauer-Chip, Validierung ("mind. 2 Spieler"), Persistenz.
5. `PassScreen`: Vollfläche in Farbe, Streifen-Muster, 800 ms Tap-Sperre.
6. `BetScreen`: Stepper 1–10, Bestätigen-Animation ("Zahl verschwindet im Tresor"), danach zurück zu PASS bzw. drawVictim → ARENA.
7. `ArenaScreen` **Platzhalter**: schwarzer Screen, Countdown 3 s, dann "SHOT!" + Opfer-Name (nutzt bereits `RoundSetup` aus der FSM).
8. `ResultScreen`: Reveal-Layout (Badge, "X trinkt N!", Trefferzone-Icon Platzhalter), Einsatz-Tabelle mit Chancen, Session-Scoreboard (Balken), Buttons Nächste Runde / Spieler ändern / Modus ändern, Konfetti (CSS), Haptik.
9. `SettingsSheet` + `RulesSheet` (4 Cards, Swipe).
10. Alle 4 Modi in `core/session.ts` implementieren (Drinker-Berechnung), Unit-Tests pro Modus.
11. Back-Button-Handling, Wake-Lock-Stub (wird in M3 aktiv).
12. Playwright E2E: kompletter Flow mit 4 Spielern, 2 Runden, Mobile-Emulation (iPhone 12, Pixel 5).

**Definition of Done:** Man kann eine Party-Runde komplett spielen (mit Platzhalter-Shot), Namen bleiben nach Reload, alle Strings aus i18n, E2E grün, keine Console-Errors, Touch-Ziele ≥ 48 px.

→ **Audit A1** (UX-/Flow-Audit)

---

## M2 — Shotlings & Arena (Rendering-Fundament) (Tag `v0.2.0`)

**Ziel:** Die Arena lebt. Männchen laufen in Spielerfarben herum, blinzeln, tragen Hüte, weichen sich aus. Noch kein Scope, kein Schuss.

Schritte:

1. Asset-Pipeline: `assets-src/svg/shotling/*.svg` nach Rig-Spec zeichnen (Kopf, Torso, Arm, Bein, Fuß, Schatten, 9 Gesichter, 7 Hüte, 8 Symbole), `scripts/build-atlas.mjs` → `public/atlas/shotlings@1x|2x.{png,json}`. Props-Atlas (Fass, Strohballen, Zielscheibe, Kaktus, Bierkiste, 2 Schilder, 3 Grasbüschel).
2. `game/ArenaApp.ts`: PIXI-App-Singleton, Resize auf Host, logische 1000×1000-Welt, Ticker treibt GSAP (eine Uhr), `visibilitychange`.
3. `game/Arena.ts`: Kreisboden (cacheAsTexture), Ring, Grasbüschel, 3–4 Props am Rand, Laufzone-Kreis.
4. `game/Shotling.ts`: Rig-Container, Tint, Gesicht/Hut-Slots, Blob-Shadow, Walk-Cycle prozedural (Bein-Pendel, Torso-Squash, Arm-Schwung), Blinzeln, `setFace()`, `setHat()`, `lookAt(camera)`, Zustände `idle|walk|panic|aimed|dead`.
5. `game/ShotlingBrain.ts`: Wander-Steering, Separation, Rand-Umkehr, Speed-Multiplikator, Idle-Gags (stolpern, winken, hinter Fass verstecken).
6. Preload-Strategie: Arena-Assets im Hintergrund während PASS/BET laden.
7. `ArenaScreen` bindet das Canvas ein; Debug-Panel (`?dev=1`) mit FPS-Overlay, Spieleranzahl-Slider, Speed-Slider.
8. Low-Effects-Auto-Detect (`deviceMemory`, Frame-Median) + manueller Toggle.
9. Unit-Tests: Brain bleibt in der Laufzone (1000 Steps), Separation hält Mindestabstand.

**Definition of Done:** 8 Shotlings laufen 60 s ohne Frame-Drops auf dem Referenz-Handy (p50 ≤ 16.7 ms), sehen cartoony und "lebendig" aus, jede Farbe ist im Scope-Dunkel unterscheidbar, Atlas ≤ 2 Draw-Batches.

→ **Audit A2** (Render-/Performance-Audit + Look-Check)

---

## M3 — Scope, Choreographie & der Schuss (Tag `v0.3.0`)

**Ziel:** Die Spannungsmaschine. Vom Iris-Wipe über Scan → Panik → Fake-Locks → Lock → Slow-Mo → Schuss. Der Tod ist noch ein simples "Umfallen" (Platzhalter-DeathSequence `basic_fall`).

Schritte:

1. `game/Scope.ts`: Vignette mit Blur-Fade, Reticle-Linien + Mil-Dots, Eckklammern, HUD-Zeile, Lens-Dirt/Glanz (Low-Mode aus), Atem-Wobble (simplex-noise), `aimAt(shotling, ms, style)`, `fakeLock()`, `lock()`, `flash()`.
2. `game/Camera.ts`: Zoom (Lock +15 %), Parallax bei Reticle-Sprung, Screen-Shake (250 ms, decay), Slow-Mo via `timeline.timeScale` + Brain-Speed.
3. `core/choreographer.ts`: Target-Script-Generator nach §5 Architektur, Unit-Tests: Fairness (Opfer-Verweilzeit ≤ 1/n + 5 %), letzter Fake ≠ Opfer, 2-Spieler-Minimum, Deterministisch bei Seed.
4. `game/ShowDirector.ts`: spielt `ShowScript` als GSAP-Timeline ab; Beats → Scope/Camera/Brain/Audio; `shot` → MuzzleFlash + Shockwave + Shake + Hit-Stop; danach `DeathSequence.build()`; `outro` → Event `showFinished`.
5. `game/fx/MuzzleFlash.ts`, `ParticlePool.ts` (Sterne, Staub, Rauch, Erde), `SpeechBubble.ts` (BitmapText), `Tombstone.ts`.
6. Shotling-Reaktionen: `aimed` → Gesicht `scared`, guckt zur Kamera, zappelt; nach Reticle-Wechsel → rennt weg (Speed-Burst 300 ms).
7. `deaths/DeathSequence.ts` Interface + Registry + gewichtete Auswahl + No-Repeat-Fenster; `basic_fall` als erster Eintrag.
8. Audio: `AudioManager` mit howler-Sprite, alle UI-/Scope-Sounds (Platzhalter-Sounds generiert oder CC0), Herzschlag-Loop mit Tempo-Anstieg, Musik-Ducking beim Lock, Arena-Spannungs-Loop.
9. Wake-Lock in ARENA aktiv. "Tap zum Überspringen" nach dem Schuss.
10. Dev-Panel: Seed-Eingabe + "Play Show", Slow-Mo-Faktor, Filter-Toggle.
11. Playwright-Perf-Test (`perf.spec.ts`) nach §12 Architektur.

**Definition of Done:** Die Show erzeugt bei Testspielern nachweislich Spannung (Fake-Lock lässt jemanden "Neeein" rufen), Timing-Presets funktionieren, Perf-Test grün, Ergebnis stimmt zu 100 % mit `victimId` überein, Sound optional (stumm voll spielbar).

→ **Audit A3** (Spannungs-Audit + Fairness-Audit + Performance)

---

## M4 — Todesanimationen (das Herzstück) (Tag `v0.4.0`)

**Ziel:** Alle 12 Tode aus GDD §4 implementiert, jeder ein kleiner Gag mit Sound-Sync, Hit-Stop, Squash & Stretch. Dies ist der **größte** Meilenstein — in 2–3 Sessions splitten (4a: Kopf+Brust, 4b: Bein+Po+Miss, 4c: Miracle+Polish).

Schritte:

1. Für **jede** Sequenz: Datei in `deaths/<zone>/`, `build()` liefert GSAP-Timeline, Sound-Cues als `timeline.call()`, Unit-Test (Dauer, Endzustand), Dev-Preview-Eintrag.
2. Reihenfolge: `head_helmet_spin`, `head_hat_launch`, `head_xray`, `body_dramatic`, `body_deflate`, `body_freeze_shatter`, `leg_hop` (mit 2. Schuss + Reticle-Verfolgung), `leg_spin`, `butt_rocket`, `butt_hotfoot`, `miss_then_hit`, `miracle_dodge`.
3. Zusätzliche Assets: Skelett-Silhouette (Xray), Eis-Overlay + 8 Scherben, Federn, Raketen-Rauch-Trail, Loch-Sprite, Grabstein, Sprechblasen-Hintergrund, "LOCK"-BitmapFont.
4. Gemeinsame Bausteine in `fx/` extrahieren, sobald sie zweimal gebraucht werden (Impact-Sterne, Rauch-Puff, Nachbeben-Zoom, "andere gucken hin + einer klatscht").
5. Zonen-Icons für den Result-Screen (Kopf/Brust/Bein/Po/Miss/Miracle) + Trefferzone-Text ("Kopfschuss!", "Ins Bein… und nochmal!").
6. Miracle-Regel im Session-Modul (niemand trinkt / Verteiler: alle 1), Result-Screen feiert es groß (Gold-Konfetti, Chor).
7. Spezial-Sounds: Ballon-Zischen, Baum-Fallen, Rakete, Eis-Crack, Chor.
8. `deathRegistry.test.ts`: No-Repeat-Fenster, Gewichte, alle IDs registriert, Zonen-Icons vorhanden.

**Definition of Done:** 12 Tode, jeder liest sich auf dem Handy auf einen Blick, keiner dauert > 4.5 s, alle in Dev-Preview abspielbar, Result-Screen zeigt korrekte Zone, Perf-Test während jeder Death-Sequenz grün (max. 2 Long-Tasks).

→ **Audit A4** (Animations-Qualitäts-Audit — der wichtigste)

---

## M5 — Polish, Modi, Juice & Accessibility (Tag `v0.5.0`)

**Ziel:** Von "funktioniert" zu "fühlt sich fertig an".

Schritte:

1. Titel-Screen: laufendes Männchen wird im Loop erschossen — **als Inline-SVG mit CSS-Keyframes**, nicht als Arena-Mini-Instanz: die würde den Renderer beim Start laden und das Code-Splitting aus Schritt 10 aufheben (ADR-38). Logo-Wobble. Musik-Loop **verschoben** — es gibt keinen Musik-Track, der Ton ist prozedural (ADR-20); gehört zu M6, falls Musik dazukommt.
2. Modi finalisieren und im UI erklären (Modus-Chip mit 1-Satz-Beschreibung), Sudden-Death-Ausscheiden visualisiert (Grabstein-Badge in der Lobby), Double-Tap (2 Opfer, Show verlängert).
3. Result-Screen-Juice: Number-Punch, Kamera-Nachbeben ins Standbild, "Alle Einsätze"-Tabelle mit Count-Up, Scoreboard-Animationen, "Legend"-Badge bei Miracle.
4. Haptik-Muster (Lock: kurze Pulse im Herzschlag-Takt, Shot: 60 ms, Reveal: doppelt).
5. ~~Arena-Themen (Wiese/Wüste/Nacht/Schnee) als Boden-Tint + Prop-Sets~~ — **nicht gebaut.** Nice-to-have, das Atlas-Fläche kostet und kein Problem löst, das im Playtest aufgefallen wäre. Entscheidung neu bewerten, wenn A6 sagt, dass die Arena eintönig wirkt.
6. Accessibility: Fokus-Reihenfolge, `aria-live` für Result, Farbenblind-Symbole überall sichtbar, Reduced-Motion, Kontrast-Check aller Texte.
7. i18n EN komplett, Sprach-Toggle.
8. Onboarding: Erste Runde zeigt 2 Tooltips — **Bet-Screen** ("Mehr Einsatz, mehr Risiko") und **Pass-Screen** ("Reich das Handy weiter"). Der zweite wanderte von der Arena zum Pass: In der Arena schaut man ohnehin nur zu, dort erklärt sich alles von selbst; beim Weitergeben entscheidet sich dagegen, ob das Spiel funktioniert.
9. Error-Resilience: WebGL-Fail → Canvas-Fallback (PIXI macht das) oder Hinweis; Atlas-Load-Fail → Retry + Toast.
10. Bundle-Analyse (`rollup-plugin-visualizer`), Code-Splitting: Arena-Chunk lazy laden während LOBBY.

**Definition of Done:** Lighthouse Mobile Perf ≥ 90, A11y ≥ 90, Bundle-Budget eingehalten, alle Modi spielbar, EN vollständig.

**Erreicht (2026-09-04):** Perf 100 · A11y 96 · Best Practices 100 · JS 249 KB gzip (Einstieg 21 KB) · alle vier Modi spielbar, Double Tap erschiesst jetzt tatsächlich beide Opfer (ADR-37) · EN deckungsgleich mit 127 Schlüsseln. Bericht in `PROGRESS.md`.

→ **Audit A5** (Polish-, Accessibility- & Bundle-Audit)

---

## M6 — Playtest, Fairness-Beweis & Release 1.0 (Tag `v1.0.0`)

**Ziel:** Echt getestet, öffentlich, installierbar.

Schritte:

1. Commit-Reveal-Seed (optional): Vor der Ziehung Hash anzeigen (klein, im Scope-HUD), auf Result-Screen "Fairness ✓" aufklappbar mit Seed + Erklärung.
2. Playtest-Protokoll (siehe `05-AUDITS.md A6`) mit einer echten Gruppe durchführen; Luka trägt Beobachtungen in `docs/PLAYTEST-01.md` ein; Claude Code priorisiert und behebt Top-5-Findings.
3. Geräte-Matrix manuell: iPhone (Safari), Android (Chrome), iPad, Desktop Chrome/Firefox/Safari.
4. PWA-Feinschliff: Install-Prompt-Banner nach 2. Runde ("Zum Homescreen?"), Offline-Test (Flugmodus), Update-Toast bei neuem SW.
5. Share: "Ergebnis teilen" (Web Share API, Text: "Rudi hat 5 Schlücke kassiert 🎯 drinkshot.app"), optional Screenshot des Result-Screens (`canvas.toBlob` + DOM-to-Image ist heikel → Text reicht für v1).
6. README final (Screenshots/GIF, Regeln, Deploy), `CHANGELOG.md`, Lizenz (MIT für Code, Assets ggf. CC-BY).
7. Deploy auf GitHub Pages (+ optional eigene Domain), Tag `v1.0.0`.

**Definition of Done:** Alle DoD-Kriterien aus GDD §10 erfüllt; Live-URL läuft; Playtest-Findings Top-5 geschlossen.

→ **Audit A6** (Release-Audit)

---

## Nach 1.0 — Ideen-Backlog (nicht planen, nur merken)

- Weitere Tode (Ziel 20+): `head_bucket`, `body_spring`, `leg_banana`, `butt_bee`, `miss_ricochet_prop`.
- "Revanche"-Button: Opfer darf 1× "Nochmal!" rufen → Double-or-Nothing.
- Custom-Skins pro Spieler (Hut wählen).
- Multi-Device-Modus via WebRTC/Room-Code (Backend nötig — bewusst später).
- Statistik-Screen: "Unglücklichster Spieler des Abends".
- Sound-Packs.
