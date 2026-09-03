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
