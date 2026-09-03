# Entscheidungen (ADR-Log)

Format: **ADR-{n} · {Datum} · {Titel}** — Kontext · Entscheidung · Konsequenz (max. 5 Zeilen).

## ADR-1 · 2026-09-03 · Stack: PixiJS statt Phaser/Canvas2D

Kontext: Partikel, Filter, viele Sprites auf Mobile bei 60 fps; UI ist textlastig. Entscheidung: PixiJS v8 nur für die Arena, DOM für Menüs, GSAP für Timelines. Konsequenz: Kein Framework-Overhead, eigene kleine FSM; Filter/Batching aus PIXI nutzbar.

## ADR-2 · 2026-09-03 · Opfer wird vor der Show gezogen

Kontext: Show soll dramaturgisch auf das Opfer hinführen, Fairness darf nicht leiden. Entscheidung: `pickVictim()` einmalig bei BET→ARENA mit `crypto.getRandomValues`; Choreographer inszeniert nur. Konsequenz: Show ist testbar/deterministisch per Seed, Fairness unit-testbar.

## ADR-3 · 2026-09-03 · Default-Modus "Klassik" (Opfer trinkt eigenen Einsatz)

Kontext: Pitch nennt "verteilen", was zu unklaren Anreizen führt. Entscheidung: Klassik als Default, "Verteiler" als Modus (Opfer verteilt posthum an alle anderen). Konsequenz: Regel in einem Satz erklärbar; Ursprungs-Idee bleibt als Modus erhalten.

## ADR-4 · 2026-09-03 · Prozedurale Tween-Animationen statt Frame-Sheets

Kontext: 12+ Tode, 8 Farben, Hüte — Frame-Sheets würden explodieren. Entscheidung: Gerigged Sprite-Parts + GSAP-Timelines, Tint für Farben. Konsequenz: Winzige Assets, unendliche Varianten, jede Sequenz als Code reviewbar/testbar.

## ADR-5 · 2026-09-03 · Tooling-Dateien ergänzen die Ordnerstruktur aus §2

Kontext: `03-ARCHITECTURE.md §2` listet Quellcode, aber keine Werkzeug-Konfiguration. Entscheidung: `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, `.prettierrc.json`, `src/vite-env.d.ts` und `netlify.toml` kommen im Repo-Root bzw. `src/` dazu; zusätzlich Unit-Tests für `rng`, `store`, `i18n`, `session` und `config` neben den in §2 genannten vier. Konsequenz: Struktur bleibt inhaltlich identisch, nur um Standard-Tooling und mehr Testabdeckung erweitert.

## ADR-6 · 2026-09-03 · Nunito als Variable Font, eine Datei für 600 und 800

Kontext: Art Direction §3 nennt Nunito in den Weights 600/800; Google Fonts liefert Nunito nur noch als Variable Font. Entscheidung: eine `nunito-var.woff2` (Latin-Subset, Weight-Range 200–1000) statt zwei statischer Schnitte, self-hosted in `public/fonts/`. Konsequenz: 39 KB statt zweier Dateien, beide Weights weiterhin verfügbar; `@font-face` deklariert `font-weight: 200 1000`.

## ADR-7 · 2026-09-03 · Datenmodell aus §4 lebt in `core/session.ts`

Kontext: Die Interfaces `Player`, `RoundSetup`, `RoundResult`, `Session` brauchen eine Heimat; §2 sieht keine `types.ts` vor. Entscheidung: Sie stehen in `core/session.ts`, dem Modul, das laut §2 ohnehin Spieler, Runden und Persistenz verantwortet. Konsequenz: Keine zusätzliche Datei, keine Zirkelbezüge — `fsm.ts` importiert aus `session.ts`, `session.ts` aus `lottery.ts`/`rng.ts`.

## ADR-8 · 2026-09-03 · `cancel` als expliziter FSM-Übergang aus PASS/BET/ARENA

Kontext: §3 fordert das Abfangen des Back-Buttons in PASS/BET/ARENA ("Runde abbrechen?"), nennt aber keinen Übergang. Entscheidung: Ein Event `cancel` führt aus diesen drei States nach LOBBY und verwirft Einsätze und Runde. Konsequenz: Der Abbrechen-Dialog (M1) sendet nur dieses Event; Fairness bleibt gewahrt, weil eine abgebrochene Runde keine Ziehung hinterlässt.

## ADR-9 · 2026-09-03 · `SessionStore` als geteilter Zustand der Screens
Kontext: Screens brauchen Spieler, Settings, Runden und Scoreboard, ohne dass jeder selbst in den localStorage greift. Entscheidung: `core/session.ts` exportiert einen `SessionStore` (Store + Aktionen + Persistenz bei jeder Änderung); der Router reicht ihn als `ScreenContext` durch. Konsequenz: Kein Typ-Zirkel über `main.ts`, Screens bleiben dumm, Persistenz passiert an genau einer Stelle.

## ADR-10 · 2026-09-03 · Sudden Death: der Letzte verteilt die Einsätze **der Schlussrunde**
Kontext: GDD §3.6 sagt "letzter Überlebender bekommt die Summe aller Einsätze zum Verteilen" — offen bleibt, ob damit die Runde oder die Session gemeint ist. Entscheidung: die Summe der Einsätze jener Runde, in der der Vorletzte ausscheidet (`sipsToDistribute`). Konsequenz: Am Tisch nachrechenbar, ohne die ganze Session zu addieren; die Zahl steht im `RoundResult` und ist unit-getestet.

## ADR-11 · 2026-09-03 · Ausgeschiedene werden aus der Runden-History abgeleitet
Kontext: Sudden Death braucht "wer ist raus", das Datenmodell in §4 kennt aber kein solches Feld. Entscheidung: `RoundResult.eliminatedIds` pro Runde speichern, `eliminatedPlayerIds(session)` leitet den Stand daraus ab. Konsequenz: Kein zusätzlicher Zustand, der auseinanderlaufen könnte; `resetRounds()` hebt das Ausscheiden automatisch auf.

## ADR-12 · 2026-09-03 · Haptik in `src/ui/haptics.ts`
Kontext: `navigator.vibrate` wird von Screens und Komponenten gebraucht, passt aber weder in `core/` (kein Spielzustand) noch in `audio/`. Entscheidung: eigenes Modul `src/ui/haptics.ts` mit benannten Mustern (`tap`, `confirm`, `shot`, `reveal`). Konsequenz: Eine Datei mehr als in §2 gelistet (siehe ADR-5); dafür schlägt Haptik auf iOS still fehl statt irgendwo zu werfen.

## ADR-13 · 2026-09-03 · Shotling-Größe skaliert mit der Spielerzahl
Kontext: Art Direction §5 nennt ~90 px Höhe; bei acht Männchen in der Laufzone wird daraus ein unlesbares Knäuel, bei zweien wirken sie verloren. Entscheidung: `shotlingHeightFor(n)` interpoliert linear zwischen 250 (2 Spieler) und 200 Welteinheiten (8 Spieler); der Mindestabstand folgt als Anteil der Höhe. Konsequenz: Duelle sehen groß aus, Achterrunden bleiben lesbar — jede Silhouette einzeln erkennbar (Audit A2).

## ADR-14 · 2026-09-03 · Cel-Shading als eingebackener Grauwert
Kontext: Art Direction §1 fordert zwei Cel-Stufen je Fläche, ein zweites Sprite je Körperteil würde die Draw-Calls verdoppeln. Entscheidung: Die Schattenstufe wird als Grau (`#D2D2D2`) ins weiße Sprite gezeichnet; PIXI multipliziert den Tint, also wird daraus automatisch die dunklere Spielerfarbe. Konsequenz: Zwei Stufen ohne ein einziges zusätzliches Sprite, funktioniert für alle acht Farben ohne Handarbeit.

## ADR-15 · 2026-09-03 · `pixi.js/unsafe-eval` statt CSP-Lockerung
Kontext: PIXI v8 baut Shader- und Uniform-Code per `new Function`; unsere CSP (Architektur §10) verbietet `unsafe-eval`, die Arena starb beim ersten Render. Entscheidung: den eval-freien Pfad importieren, statt die CSP aufzuweichen. Zusätzlich braucht `connect-src` ein `data:`, weil PIXI seine 1×1-Default-Textur als data-URL nachlädt. Konsequenz: CSP bleibt streng, minimal langsamerer Shader-Aufbau beim Start (einmalig, nicht messbar).

## ADR-16 · 2026-09-03 · Separation in zwei Stufen
Kontext: Weiche Steering-Kräfte heben sich im Knäuel gegenseitig auf — acht Männchen klumpten trotz Separation zusammen. Entscheidung: weiches Ausweichen in `update()` für natürliche Bewegung, plus `resolveOverlaps()` als harte Positionskorrektur mit vier Relaxations-Durchgängen nach dem Integrationsschritt. Konsequenz: Der Mindestabstand ist garantiert und unit-testbar (1 000 Schritte, 8 Männchen), die Bewegung wirkt trotzdem nicht mechanisch.

## ADR-17 · 2026-09-03 · Atlas meldet seine Auflösung selbst
Kontext: `free-tex-packer-core` schreibt immer `meta.scale: 1`. Auf Retina-Geräten lädt die App den @2x-Atlas — PIXI rechnete dessen Texturpixel dadurch 1:1 in Welteinheiten um und zeichnete **alles doppelt so groß**, lautlos und nur auf echten Geräten. Entscheidung: `build-atlas.mjs` schreibt `meta.scale` passend zum Faktor in die JSON. Konsequenz: @1x und @2x liefern identische Weltgrößen; der Fehler kann nicht zurückkommen, weil die Metadaten aus derselben Variable stammen wie das Rendering.

## ADR-18 · 2026-09-03 · Scan-Verweildauer weicht bei vielen Spielern nach unten ab
Kontext: GDD §3.5 nennt 0.6–1.2 s Verweildauer pro Spieler im Scan; acht Spieler in 4.5 s Scan-Budget ergeben rechnerisch 562 ms. Entscheidung: Passt das Budget nicht, bekommen **alle** gleich viel statt einzelne die volle Zeit. Konsequenz: Bei acht Spielern ist der Scan hektischer als geplant — dafür hängt niemand auffällig länger im Fadenkreuz, und genau das ist die wichtigere Regel.

## ADR-19 · 2026-09-03 · Frühe Fake-Locks dürfen das Opfer treffen
Kontext: Architektur §5.4 verlangt für **alle** Fakes ein Nicht-Opfer, GDD §3.5 nur für den letzten. Mit der strengen Lesart hing das Opfer messbar **kürzer** im Fadenkreuz als alle anderen (10.6 % statt 12.5 % bei acht Spielern) — auch das ist ein Muster. Entscheidung: Nur der letzte Fake schliesst das Opfer aus (maximale Fallhöhe); frühere dürfen es treffen. Konsequenz: Die Verweilzeiten gleichen sich an, und ein Fake auf dem Opfer, das dann wegspringt und später doch stirbt, ist die bessere Irreführung. Architektur §5.4 wird entsprechend nachgezogen.

## ADR-20 · 2026-09-03 · Platzhalter-Sounds werden zur Laufzeit synthetisiert
Kontext: GDD §7 sieht ein howler-Audio-Sprite vor; die Toolchain hat keinen OGG/MP3-Encoder, und die Roadmap erlaubt ausdrücklich generierte Platzhalter. Entscheidung: `AudioManager` erzeugt die Cues per Web Audio (Oszillator + Rauschen + Hüllkurve) hinter genau der API, die ein Sprite später ebenfalls bedient. Konsequenz: null Bytes Bundle, offline ab dem ersten Start, Cues liegen exakt auf der Audio-Uhr (A3 verlangt ± 50 ms). In M6 wird der Klangerzeuger hinter der Fassade getauscht, ohne einen Aufrufer anzufassen.

## ADR-21 · 2026-09-03 · Slow-Mo bremst die Welt, nicht das Drehbuch
Kontext: Die naheliegende Umsetzung über `gsap.globalTimeline.timeScale` verlangsamte auch die Show-Timeline — die Lock-Phase dehnte sich um den Faktor 2.5 und die Dauer-Presets (10/15/22 s) waren hinfällig. Entscheidung: Slow-Mo lebt in `Camera.timeScale` und skaliert den Zeitschritt von Männchen und Partikeln; die Show-Uhr läuft in Echtzeit weiter. Konsequenz: Die Presets halten auf ± 1 s, und die Zeitlupe fühlt sich trotzdem an — weil sich genau das bewegt, was man beobachtet.

## ADR-22 · 2026-09-03 · Verweilzeiten werden über die Haltezeiten ausgeglichen
Kontext: Die Ziele der Panik-Beats liegen weitgehend fest (kein Ziel zweimal hintereinander, bei zwei Spielern also strikte Abwechslung; der letzte Fake gehört dem Nicht-Opfer und hält doppelt so lange wie ein Panik-Beat). Über die Ziel-Auswahl allein blieb bei zwei Spielern eine Abweichung von 18 % stehen. Entscheidung: `balanceHolds()` streckt und staucht die Aim-Beats jedes Spielers innerhalb von [300, 700] ms, bis alle gleich lange im Fadenkreuz hingen; das Phasen-Budget bleibt unverändert. Konsequenz: Abweichung bei zwei Spielern von 18.3 % auf 1.7 %, bei acht auf 11 % — jeweils deutlich unter der Audit-Grenze.

## ADR-23 · 2026-09-03 · Perf-Tests brauchen eine GPU und sagen es sonst
Kontext: Headless-Chromium rendert ohne GPU per SwiftShader in Software; die Arena lief dort mit 30 statt 60 fps. Das misst den Testrechner, nicht das Spiel. Entscheidung: Playwright startet Chromium mit GPU-Flags; `perf.spec.ts` liest den Renderer aus und überspringt die Frame-Zeit-Messung auf Software-Renderern mit klarer Begründung. Zusätzlich misst ein eigener Test die **reine JS-Zeit pro Frame** (Architektur §7.10) — die hängt nicht am Renderer und läuft überall. Konsequenz: Kein grüner Test, der nichts aussagt, und kein roter, der nur die Testmaschine anzeigt.

## ADR-24 · 2026-09-03 · Sequenzen bekommen das Rig über ein eigenes Interface
Kontext: Todesanimationen müssen Kopf, Arme, Hut und Overlays einzeln bewegen; alle Rig-Teile waren `private`. Entscheidung: Ein `ShotlingRig`-Interface gibt genau die Teile frei, die animiert werden dürfen, plus `setDriven()` (Automatik abschalten), `detachHat()` und `addOverlay()`. Konsequenz: Sequenzen können alles, was sie brauchen, aber nicht am Zustand des Shotlings schrauben — und `reset()` bleibt die eine Stelle, die alles zurückdreht.

## ADR-25 · 2026-09-03 · Jede Sequenz endet über `finishDeath()`
Kontext: Audit A4 verlangt von jeder der zwölf Animationen Grabstein-Pop und Nachbeben-Zoom. Zwölfmal kopiert wäre das zwölfmal eine Gelegenheit, es zu vergessen. Entscheidung: Ein gemeinsamer Abschluss in `fx/deathFinish.ts` setzt Grabstein, Nachbeben und die Reaktion der Umstehenden; die Timeline trägt danach eine Markierung. Konsequenz: Der Unit-Test prüft für jede Sequenz, dass sie den Abschluss benutzt — nicht nur, dass irgendwo ein Grabstein auftaucht.

## ADR-26 · 2026-09-03 · Die Death-Auswahl kommt als Callback in `createRoundSetup`
Kontext: Die Registry lebt in `game/`, die Runden-Erzeugung in `core/`. Ein Import von dort nach hier würde die Schichtung umdrehen. Entscheidung: `createRoundSetup(bets, mode, duration, chooseDeath?)` bekommt die Wahl als Funktion herein; `main.ts` reicht sie über den bestehenden `drawRound`-Seam der FSM. Der Seed entsteht zuerst, die Wahl läuft auf dem daraus abgeleiteten PRNG. Konsequenz: `core/` bleibt frei von `game/`, und dieselbe Runde lässt sich aus dem Seed identisch wiederholen.

## ADR-27 · 2026-09-03 · Kontaktbögen statt Video als Animations-Beleg
Kontext: Audit A4 nennt ein Video aller Tode als SOLL; im System gibt es keinen Encoder (kein `ffmpeg`). Entscheidung: Pro Sequenz ein Kontaktbogen aus acht Frames über die Laufzeit, nebeneinander montiert (`docs/screens/m4a-*.png`), aufgenommen aus der Death-Preview. Konsequenz: Zum Beurteilen sogar besser als ein Video, weil man die Key-Frames direkt vergleichen kann; ein Video bleibt für M6 möglich, wenn ein Encoder da ist.
