# Fortschritt

| Meilenstein | Status | Tag | Audit |
|---|---|---|---|
| M0 Setup & Skelett | ✅ fertig (⏳ 4 manuelle Checks offen) | `v0.0.1` | A0 bestanden |
| M1 UI-Flow | ✅ fertig (⏳ 2 manuelle Checks offen) | `v0.1.0` | A1 bestanden |
| M2 Shotlings & Arena | ✅ fertig (⏳ 2 manuelle Checks offen) | `v0.2.0` | A2 bestanden |
| M3 Scope, Choreo, Schuss | ✅ fertig (⏳ 3 manuelle Checks offen) | `v0.3.0` | A3 bestanden |
| M4 Todesanimationen | ✅ fertig (⏳ 1 manueller Check offen) | `v0.4.0` | A4 bestanden |
| M5 Polish, Modi, A11y | ✅ fertig (⏳ 4 manuelle Checks offen) | `v0.5.0` | A5 bestanden |
| M5b Showdown & Start-Screen | ✅ fertig | `v0.6.0` | – |
| Auftakt & vier gemeldete Fehler | ✅ fertig (⏳ 8 manuelle Checks offen) | – | – |
| M6 Playtest & Release | ⬜ offen | – | – |

## Audit-Reports

## Audit A0 — 2026-09-03

**Ergebnis:** BESTANDEN (alle automatisierbaren MUSS-Checks grün; 4 Checks brauchen Lukas Gerät)

| Check | Status | Notiz |
|---|---|---|
| Projektstruktur entspricht `03-ARCHITECTURE.md §2` | ✅ | Alle Ordner und Dateien aus §2 vorhanden, Stubs mit TODO-Header und Meilenstein-Marker. Ergänzt um Standard-Tooling (`vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, `.prettierrc.json`, `src/vite-env.d.ts`, `netlify.toml`) → ADR-5. Leere Asset-Ordner mit `.gitkeep` sichtbar gehalten. |
| `theme.ts`/`rules.ts`/`choreo.ts` enthalten die GDD-Werte | ✅ | Review + automatisiert in `tests/unit/config.test.ts` (16 Tests): 8 Spielerfarben in fester Reihenfolge inkl. Hex und Symbolen, UI-Farbtabelle, Einsatz 1–10/Default 3, Modi, Dauer-Presets 10/15/22 s, Risiko-Ampel, Phasen-Budget gegen die GDD-Dramaturgie-Tabelle gerechnet. |
| Lottery-Test: 100 000 Ziehungen, Abweichung < 1 % | ✅ | `tests/unit/lottery.test.ts`, 4 Szenarien à 100 000 Ziehungen: GDD-Beispiel 1/2/3/5, 2 Spieler, 8× gleich, einer 10 / sieben 1. Abweichung jeweils < 1 Prozentpunkt. Zusätzlich Segmentgrenzen und Float-Rounding-Fallback. |
| RNG nutzt `crypto.getRandomValues`, nie `Math.random` für die Ziehung | ✅ | Doppelt abgesichert: ESLint-Regel `no-restricted-properties` für `src/core/**` und ein Unit-Test, der `src/core/` (ohne Kommentare) nach `Math.random` durchsucht → 0 Treffer. `pickVictim` zieht ausschließlich über `secureRandomFloat`. |
| FSM-Übergänge vollständig getestet, Coverage `fsm.ts` = 100 % Branches | ✅ | `tests/unit/fsm.test.ts`, 31 Tests. v8-Coverage: `fsm.ts` 100 % Statements / Branches / Functions / Lines (Schwelle in `vitest.config.ts` erzwungen, CI bricht sonst ab). Jeder Pfeil des Diagramms plus Guard `players ≥ 2`, unzulässige Events je State, `cancel` aus PASS/BET/ARENA (ADR-8). |
| Ziehung genau einmal bei BET→ARENA (ADR-2) | ✅ | `drawCount`-Zähler in der FSM; Test über 3 Runden zählt genau 3 Ziehungen. `applyEffects` ruft `drawRound` nur beim Übergang zum letzten Spieler. |
| PWA installierbar | ✅ | Chrome DevTools Protocol gegen den Preview-Build (Pixel-5-Emulation): `Page.getAppManifest` → `errors: []`, `Page.getInstallabilityErrors` → `installabilityErrors: []`. Service Worker aktiv mit Scope `/Drinkshot/`. Offline-Probe (Netzwerk aus, neuer Tab): Navigation liefert 200 und den Titel. |
| CI läuft grün auf GitHub | ✅ | Nachgereicht in M1: Der erste Lauf war rot (WebKit fehlte, Pages nicht aktiviert). Beides behoben, seither grün — Run `33780242157`. |
| App auf Handy im WLAN erreichbar (`--host`), Titel sichtbar | ⏳ manuell | `npm run dev` bindet auf alle Interfaces und gibt eine Network-URL aus. Gegen die LAN-IP mit iPhone-12-Emulation geprüft: Titel „DRINKSHOT", keine Console-Errors, keine CSP-Verstöße. Der Test auf einem echten Gerät fehlt. |
| Desktop zeigt Portrait-Frame | ✅ | Screenshot `docs/screens/m0-desktop.png`: 9:16-Rahmen, max. 480 px, 32 px Radius, dekorativer Hintergrund. |
| Mobile Landscape zeigt „Drehen"-Overlay | ✅ | E2E-Test bei 844×390: Overlay sichtbar, Text aus i18n gefüllt. Auf echtem Gerät noch unbestätigt (Media-Query nutzt `pointer: coarse`). |

### Definition of Done (Roadmap M0)

| Kriterium | Status | Messwert |
|---|---|---|
| `npm run dev --host` zeigt Titel auf Handy + Desktop | ⏳ manuell | Desktop und Mobile-Emulation ✅, echtes Gerät offen |
| `npm test` grün | ✅ | Typecheck ✅ · ESLint 0 Fehler / 0 Warnings ✅ · 123 Tests grün, 13 `todo` (M3/M4) |
| `npm run build` < 200 KB gzip | ✅ | **15,4 KB JS gzip** (App 6,3 · workbox-window 2,4 · pwa-register 0,6 · sw.js 1,0 · workbox 5,1) + 2,1 KB CSS. `dist/` ohne Sourcemaps: 170 KB roh, davon 56 KB Fonts und 62 KB Icons. |
| Lighthouse PWA-Check „installable" | ✅ | Über CDP verifiziert (Lighthouse ≥ 12 führt die PWA-Kategorie nicht mehr, `getInstallabilityErrors` ist dasselbe Signal). |

### Standing Audit

| Check | Status | Notiz |
|---|---|---|
| `npm run typecheck` ohne Fehler | ✅ | TS strict inkl. `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` |
| `npm run lint` ohne Fehler (Warnings ≤ 5) | ✅ | 0 Fehler, 0 Warnings |
| `npm run test:unit` grün | ✅ | 123 passed, 13 todo |
| Keine `console.error` im Dev-Flow (E2E prüft) | ✅ | `flow.spec.ts` sammelt `console`-Errors und `pageerror` → leer, auf iPhone 12 und Pixel 5 |
| Kein hardcodierter UI-Text | ✅ | Grep über String-Literale in `src/**/*.ts` (ohne Kommentare) nach Umlauten → 0 Treffer. Alle Texte in `de.json`/`en.json`, Test prüft Key-Parität DE/EN und dass kein Wert leer ist. |
| Bundle-Größe gemeldet | ✅ | `ci.yml` schreibt die gzip-Größen in die Job-Summary |

### Was M0 geliefert hat

- **Build & Tooling:** Vite 6 mit `base: '/Drinkshot/'` (per `DRINKSHOT_BASE` überschreibbar), TS strict mit Alias `@/`, ESLint 9 (Flat Config) + Prettier, Vitest (jsdom) mit Coverage-Schwelle für `fsm.ts`, Playwright mit iPhone-12- und Pixel-5-Profil.
- **Config:** `theme.ts` (Farben, Typo-Skala, Motion, Animations- und Partikel-Budgets, Arena-/Render-Konstanten), `rules.ts` (Spielerzahl, Einsatz, Modi, Dauer-Presets, Risiko-Ampel, Default-Settings), `choreo.ts` (Phasen-Budget, Beat-Timings, Fairness-Regeln, Herzschlag-Kurve).
- **Core:** `rng.ts` (sicherer Zufall + mulberry32), `lottery.ts` (`pickVictim`, `pickVictims`, `computeOdds`), `store.ts` (Store + Event-Bus), `fsm.ts` (6 States, 8 Events, enter/exit-Hooks), `session.ts` (Datenmodell §4, Runden-Erzeugung, localStorage), `i18n.ts` (`t()`, Interpolation, Plural, `[missing:…]`-Marker).
- **Shell:** `index.html` mit CSP, `viewport-fit=cover`, `theme-color`, Manifest-Link und Font-Preloads; `tokens.css` als CSS-Pendant zu `theme.ts`; Portrait-Frame ab 768 px; Landscape-Overlay; Boot-Screen mit Logo-Wobble.
- **PWA:** Manifest (standalone, portrait, maskable Icon), Icons aus `assets-src/svg/app-icon.svg` per `sharp` gerendert, Workbox-`generateSW` mit `navigateFallback`.
- **Fonts:** Luckiest Guy (17 KB) und Nunito Variable (39 KB) als Latin-Subset self-hosted in `public/fonts/`, OFL-Hinweis daneben (ADR-6).

### Ein gefundener Fehler

`secureRandomFloat()` hatte in der ersten Fassung eine falsche Bit-Skalierung (`hi * 2^21` statt `hi * 2^26`) und lieferte deshalb nur Werte in `[0, 1/32)` — in der Ziehung hätte **immer der erste Spieler** gewonnen. Der 100 000-Ziehungen-Test hat das sofort aufgedeckt. Das ist genau der Grund, warum dieser Test in M0 und nicht später steht.

**Offene SOLL-Follow-ups:** keine.

**Manuelle Checks, die Luka bestätigen muss, bevor M1 startet:**
- [ ] `npm run dev`, die **Network**-URL auf dem iPhone öffnen (gleiches WLAN): Titel „DRINKSHOT" sichtbar, nichts hängt hinter Notch oder Home-Bar.
- [ ] Dasselbe auf einem Android (Pixel/Chrome).
- [ ] Handy ins Querformat drehen: Overlay „Bitte Handy drehen" erscheint.
- [x] ~~Repo pushen und CI/Pages einrichten~~ — in M1 erledigt: <https://github.com/lukabpunkt/Drinkshot>, live unter <https://lukabpunkt.github.io/Drinkshot/>.

**Optional, wenn du magst:** Die App über den Preview-Build zum Homescreen hinzufügen und den Flugmodus einschalten — sie startet offline (lokal verifiziert, auf echtem Gerät noch nicht).

## Audit A1 — 2026-09-03

**Ergebnis:** BESTANDEN (alle automatisierbaren MUSS-Checks grün; 2 Checks brauchen Lukas Gerät)

| Check | Status | Notiz |
|---|---|---|
| E2E: 4 Spieler, 2 Runden, alle Screens, iPhone 12 + Pixel 5 | ✅ | 24 Tests grün (12 pro Gerät). Der Hauptflow läuft das echte Timing mit — inklusive 3-s-Countdown und Wipes, 34 s auf WebKit. iPhone 12 läuft in Playwright unter **WebKit**, Pixel 5 unter Chromium; damit ist Safari als Referenzgerät wirklich abgedeckt. |
| Touch-Ziele ≥ 48 px, Primary ≥ 64 px | ✅ | E2E misst alle sichtbaren `button`/`input`/`[role=button]` per `getBoundingClientRect` → kein Element unter 48 px; „Los geht's!" 64 px. |
| Privacy-Screen blockiert Doppeltap (800 ms) | ✅ | Eigener Test: Sofort-Tap löst nichts aus, erst nach Ablauf der Sperre geht es weiter. |
| Einsatz nach Bestätigen nirgends mehr sichtbar | ✅ | Eigener Test: Nach dem Bestätigen existiert kein `.stepper__value` mehr, und der Pass-Screen enthält die Zahl nicht. Der Wert lebt nur in `fsm.context.bets` und wird erst im Result aufgedeckt. |
| Namen/Settings überleben Reload | ✅ | Eigener Test mit echtem `page.reload()`: Namen und Dauer-Preset stehen wieder da. `SessionStore` schreibt bei jeder Änderung in `localStorage`. |
| Alle 4 Modi liefern korrekte Drinker (Unit-Tests) | ✅ | `resolveRound` mit 13 Tests: Klassik (Opfer zahlt selbst), Verteiler (alle anderen zahlen den Einsatz des Opfers), Sudden Death (Ausscheiden + letzter Überlebender verteilt), Double Tap (beide Opfer zahlen ihren eigenen Einsatz) sowie Miracle in allen Varianten. |
| Kein Text hardcodiert; DE komplett | ✅ | 118 Keys, DE/EN Key-Parität per Unit-Test, kein leerer Wert. Grep über String-Literale in `src/**/*.ts` (ohne Kommentare) nach Umlauten → 0 Treffer. E2E prüft nach dem Sprachwechsel, dass nirgends `[missing:` steht. |
| Keine Console-Errors im Flow | ✅ | Der Hauptflow sammelt `console`-Errors und `pageerror` über beide Runden → leer. Auch gegen die Live-URL geprüft. |
| Wipes laufen flüssig | ⏳ manuell | Der Wipe animiert nur `transform` auf einem eigenen Overlay-Element (Web Animations API, kein Layout-Thrash). Die 60-fps-Messung im Performance-Panel steht noch aus — sinnvoll zusammen mit dem A2-Audit auf dem Referenzgerät. |
| Back-Button in PASS/BET/ARENA zeigt Abbrechen-Dialog | ✅ | E2E: „Weiterspielen" lässt die Runde stehen, „Ja, abbrechen" wirft die Einsätze weg und führt zurück in die Lobby. |
| Safe-Area auf iPhone mit Notch | ⏳ manuell | `env(safe-area-inset-*)` liegt auf `#app`, Version/Skip/Toast rechnen `--safe-bottom` mit ein. In der Emulation korrekt; das echte Gerät muss es bestätigen. |
| Jeder Screen ohne Erklärung verständlich | ⏳ manuell | Screenshots aller Screens liegen in `docs/screens/m1-*.png` (Titel, Lobby, Pass, Bet, Arena, Result, Regeln, Settings) — Vorlage für Lukas Test mit einer unbeteiligten Person. |

### Definition of Done (Roadmap M1)

| Kriterium | Status | Messwert |
|---|---|---|
| Party-Runde komplett spielbar (mit Platzhalter-Shot) | ✅ | Titel → Lobby → 4× Pass/Bet → Arena-Platzhalter → Result → nächste Runde, im E2E zweimal hintereinander |
| Namen bleiben nach Reload | ✅ | siehe oben |
| Alle Strings aus i18n | ✅ | 118 Keys, DE und EN vollständig |
| E2E grün | ✅ | 24/24 auf beiden Geräteprofilen |
| Keine Console-Errors | ✅ | 0 |
| Touch-Ziele ≥ 48 px | ✅ | Minimum gemessen: 48 px |

### Standing Audit

| Check | Status | Notiz |
|---|---|---|
| `npm run typecheck` | ✅ | TS strict, 0 Fehler |
| `npm run lint` (Warnings ≤ 5) | ✅ | 0 Fehler, 0 Warnings |
| `npm run test:unit` | ✅ | 149 passed, 13 todo (M3/M4) |
| Coverage `fsm.ts` = 100 % Branches | ✅ | `fsm` 100 %, `lottery` 100 %, `store` 100 %, `session` 88 % Branches, `i18n` 97 % |
| Keine `console.error` im Dev-Flow | ✅ | E2E prüft |
| Kein hardcodierter UI-Text | ✅ | Grep 0 Treffer |
| Bundle-Größe gemeldet | ✅ | **26,1 KB JS gzip** gesamt (App 17,5 · workbox-window 2,4 · pwa-register 0,6 · SW 5,6) + 5,5 KB CSS. Budget: 450 KB. |
| CI grün auf GitHub | ✅ | Run `33780242157` |

### Was M1 geliefert hat

- **Router** mit diagonalem Farb-Wipe: zwei Hälften à 160 ms, Richtung aus der Screen-Reihenfolge, `prefers-reduced-motion` macht daraus einen Fade. Navigationen sind serialisiert, damit sich nie zwei Wipes überlagern.
- **Komponenten:** Sticker-Button (4 Varianten, 6-px-Kante, Press-State), Chip, PlayerBadge mit Farbenblind-Symbol als Inline-SVG, BetStepper (Long-Press-Repeat 300/90 ms, Number-Punch, Risiko-Ampel), BottomSheet (Fokus-Falle, Escape, Drag-to-close), Toast.
- **Screens:** Title (Audio-Unlock beim ersten Tap, Sound-Toggle, einmaliger 18+-Hinweis), Lobby (2–8 Spieler, Farben der Reihe nach, freigewordene Farben werden wiederverwendet, Modus-/Dauer-Chip), Pass (Vollfarbe + wandernde Streifen + 800-ms-Sperre), Bet (Tresor-Animation beim Bestätigen), Arena-Platzhalter, Result (Reveal mit Zonen-Icon, Einsatz-Tabelle mit Chancen, Scoreboard, Konfetti in Opferfarbe), Settings- und Regeln-Sheet.
- **Modus-Logik** in `core/session.ts` inklusive Miracle-Regel und Sudden-Death-Ausscheiden, das aus der Runden-History abgeleitet wird.
- **Zurück-Button**-Behandlung mit History-Guard und Abbrechen-Dialog; Wake-Lock als Stub gekapselt.
- **Live:** <https://lukabpunkt.github.io/Drinkshot/>

### Drei gefundene Fehler

1. **Tap-Sperre war sichtbar entkoppelt.** `is-locked` wurde erst in `activate()` gesetzt — also nach dem Wipe. Dazwischen sah der Pass-Screen entsperrt aus, reagierte aber nicht. Jetzt trägt er die Klasse ab dem Mount. Aufgefallen, weil der E2E-Test genau auf diese Klasse wartete und zu früh tippte.
2. **CI war rot, ohne dass es jemand gemerkt hätte.** Das Playwright-Profil „iPhone 12" läuft unter **WebKit**, installiert war nur Chromium. Lokal fiel das nicht auf, weil WebKit auf diesem Rechner schon lag. Behoben in `ci.yml`.
3. **Deploy war rot.** GitHub Pages war für das Repo nie aktiviert. Per API eingeschaltet, zusätzlich `enablement: true` in `configure-pages`, damit der Workflow das künftig selbst erledigt.

**Offene SOLL-Follow-ups:**
- Wipe-Performance im DevTools-Performance-Panel gegenmessen (zusammen mit A2 auf dem Referenzgerät).

**Manuelle Checks, die Luka bestätigen muss, bevor M2 startet:**
- [ ] Eine echte Runde zu viert auf dem Handy durchspielen (`npm run dev`, Network-URL, oder direkt <https://lukabpunkt.github.io/Drinkshot/>): Fühlt sich das Rumgeben richtig an? Ist die 800-ms-Sperre lang genug — oder zu lang?
- [ ] Safe-Area auf einem iPhone mit Notch: Steht kein Button hinter der Home-Bar, ist der Sound-Toggle erreichbar?
- [ ] Screen-Verständlichkeit: Einer unbeteiligten Person nacheinander Lobby, Pass, Bet und Result zeigen und fragen „Was würdest du hier tun?" — Antworten notieren, das ist der wertvollste Input für M5.

## Audit A2 — 2026-09-03

**Ergebnis:** BESTANDEN (alle MUSS-Checks automatisiert grün; 2 Checks brauchen Lukas Gerät)

| Check | Status | Notiz |
|---|---|---|
| 8 Shotlings, Referenz-Profil: p50 ≤ 16.7 ms, p95 ≤ 33 ms | ✅ | `perf.spec.ts` misst 10 s bei **CPU-Drossel 4×** (Pixel-5-Profil): **p50 16.7 ms · p95 17.6 ms · 0 Long-Tasks**. Budget aus Architektur §12 (p50 ≤ 20, p95 ≤ 40, ≤ 2 Long-Tasks) deutlich unterschritten. |
| Draw-Batches in der Arena-Szene ≤ 3 | ✅ | **1 Draw-Call.** Gemessen nicht über eine interne PIXI-Liste, sondern durch Umschließen von `gl.drawElements`/`drawArrays` — das ist die Zahl, die zählt. Der gecachte Boden und beide Atlanten landen dank Multi-Textur-Batching in einem einzigen Aufruf. |
| Keine Allokationen im Loop: flache Heap-Kurve über 30 s | ✅ | Über CDP mit erzwungenem GC vorher/nachher: **4.64 MB → 4.81 MB, +179 KB in 30 s**. `update()` in Brain und Shotling allokiert nichts; `resolveOverlaps` arbeitet rein auf Zahlen. |
| Atlas ≤ 2048² je Auflösung, PNG optimiert | ✅ | `shotlings@1x` 1024×512 (55.8 KB) · `shotlings@2x` 2048×1024 (118.6 KB) · `props@1x` 1024×512 (36.4 KB) · `props@2x` 2048×1024 (77.3 KB). Das Build-Skript bricht ab, wenn ein Atlas die Kante reißt. |
| Look-Check gegen Art Direction §1/§5 | ✅ | `docs/screens/m2-rig.png` zeigt das Rig mit allen 6 Hüten und 6 Gesichtern. Abgehakt: dicke ink-Outlines (3–4 px auf dem Schirm), Chibi-Proportion (Kopf 128 von 276 = **46 %**, Soll 45 %), Cel-Shading in zwei Stufen (ADR-14), Blob-Shadow, keine harten 90°-Ecken. |
| Alle 8 Farben im Scope-Dunkel unterscheidbar, inkl. Deuteranopie | ✅ | `m2-scope-dark.png` (simulierte Vignette) und `m2-deuteranopia.png` (Brettel/Viénot-Matrix). Ergebnis wie erwartet: **Rot, Grün und Orange fallen bei Deuteranopie zusammen — die Symbole auf dem Torso tragen die Unterscheidung** und sind auch im Dunkeln klar lesbar. Genau dafür stehen sie im GDD §3.1. |
| Preload während BET: kein sichtbares Nachladen | ✅ | Gemessen: Die Atlanten werden **beim Betreten von PASS** angefordert, 4,2 s bevor die Arena kommt; beim Eintritt ist `is-loading` bereits weg. `loadArenaAssets()` teilt sich eine Promise, doppeltes Laden ist ausgeschlossen. |
| Low-Effects-Auto-Detect greift bei CPU-Throttle 6× | ⚠️ SOLL, nicht auslösbar | Der Mechanismus ist unit-getestet (Geräte-Schwellen + Frame-Median gegen die 22-ms-Grenze aus §7.9). Er **springt in M2 nicht an, weil die Szene selbst bei 6-facher Drosselung bei 16.7 ms bleibt** — es gibt schlicht noch nichts Teures. Erneut prüfen in A3/A4, sobald Filter, Partikel und Todesanimationen dazukommen. |
| Walk-Cycle mit Squash & Stretch + Blinzeln, Männchen wirken „lebendig" | ⏳ manuell | Umgesetzt: Bein-Pendel über die **zurückgelegte Strecke** (nicht die Zeit, deshalb passt die Schrittfrequenz automatisch zum Tempo), Arm-Gegenschwung, Torso-Squash zweimal pro Schrittfolge, Kopf-Bounce, Schatten-Puls, Blinzeln alle 2–5 s für 120 ms. Ob es „lebendig" wirkt, ist Lukas Urteil. |
| Screenshots in `docs/screens/m2-*.png` | ✅ | `m2-rig` (Charakterbogen), `m2-arena` (8 Spieler), `m2-arena-4` (4 Spieler), `m2-scope-dark`, `m2-deuteranopia`, `m2-devpanel`. |

### Definition of Done (Roadmap M2)

| Kriterium | Status | Messwert |
|---|---|---|
| 8 Shotlings laufen ohne Frame-Drops, p50 ≤ 16.7 ms | ✅ | p50 16.7 ms bei CPU 4× |
| Sehen cartoony und lebendig aus | ⏳ manuell | Screenshots liegen bereit |
| Jede Farbe im Scope-Dunkel unterscheidbar | ✅ | über Symbole, auch bei Deuteranopie |
| Atlas ≤ 2 Draw-Batches | ✅ | 1 |

### Standing Audit

| Check | Status | Notiz |
|---|---|---|
| `npm run typecheck` | ✅ | 0 Fehler |
| `npm run lint` (Warnings ≤ 5) | ✅ | 0 Fehler, 0 Warnings |
| `npm run test:unit` | ✅ | **175 passed**, 13 todo |
| `npm run test:e2e` | ✅ | 24 grün auf iPhone 12 (WebKit) + Pixel 5 |
| `npm run test:perf` | ✅ | 3 grün |
| Keine `console.error` im Dev-Flow | ✅ | E2E prüft über zwei volle Runden |
| Kein hardcodierter UI-Text | ✅ | Grep 0 Treffer |
| Bundle-Größe | ✅ | 221 KB JS gzip über alle Chunks (Budget 450 KB); WebGPU- und Filter-Code liegen in eigenen Chunks und werden nicht geladen |

### Was M2 geliefert hat

- **Asset-Pipeline:** 30 SVG-Quellen für das Rig (Kopf, Torso, Arm, Bein, Fuß, Schatten, 9 Gesichter, 7 Hüte, 8 Symbole) und 10 Requisiten. `npm run build:atlas` rastert mit `sharp` und packt mit `free-tex-packer-core` zu vier Atlanten (@1x/@2x, PIXI-Format), inklusive Größen-Abbruch.
- **`ArenaApp`:** ein PIXI-`Application`-Singleton für die ganze Session, 1000 × 1000-Weltkoordinaten mittig in den Host skaliert, `ResizeObserver`, `visibilitychange` stoppt Ticker und GSAP. **Eine Uhr:** der PIXI-Ticker treibt `gsap.updateRoot` (§7.7).
- **`Arena`:** Bodenkreis mit dunklerem Ring, 14 Grasbüschel und bis zu 4 Requisiten auf dem Ring — alles in einem `cacheAsTexture`-Container, damit der Hintergrund pro Frame eine Textur kostet statt 25 Draw-Aufrufe.
- **`Shotling`:** 12-teiliges Rig, Tint für die Spielerfarbe, prozeduraler Walk-Cycle, Blinzeln, `setFace`/`setHat`/`lookAt`/`reset`, Zustände `idle|walk|panic|aimed|dead`.
- **`ShotlingBrain`:** Wander-Steering mit Separation, weichem Rand und Speed-Multiplikator — bewusst **ohne PIXI-Import**, damit die Bewegung ohne Browser testbar ist.
- **Dev-Panel** (`?dev=1`): fps/p50/p95, echte Draw-Calls, Shotling-Anzahl, Speed, Low-Effects. `&hold=1` hält die Arena offen, damit `perf.spec.ts` über 10 s messen kann.

### Fünf gefundene Fehler

1. **Der @2x-Atlas log über seine eigene Auflösung.** Der Packer schreibt immer `meta.scale: 1`. Auf jedem Retina-Gerät rechnete PIXI die doppelt so großen Texturpixel 1:1 in Welteinheiten um und zeichnete **alles doppelt so groß** — lautlos, ohne Fehlermeldung, und auf einem Nicht-Retina-Rechner unsichtbar. Aufgefallen erst beim Nachrechnen einer Frame-Größe im Atlas-JSON. Behoben in `build-atlas.mjs` (ADR-17).
2. **PIXI startete gar nicht.** Es baut Shader-Code per `new Function`; unsere CSP verbietet `unsafe-eval`. Statt die CSP aufzuweichen läuft jetzt der eval-freie PIXI-Pfad (ADR-15).
3. **Zweiter CSP-Verstoß, nur unter WebKit.** PIXI lädt seine 1×1-Default-Textur als `data:`-URL über `fetch` — das brauchte `connect-src data:`. Gefunden hat es der E2E-Test auf dem iPhone-12-Profil; unter Chromium blieb es unsichtbar.
4. **Die Separation hielt nicht.** Weiche Steering-Kräfte heben sich im Knäuel auf, und ein einzelner Korrektur-Durchgang reicht bei Ketten nicht. Jetzt vier Relaxations-Durchgänge (ADR-16); der Unit-Test misst über 1 000 Schritte den kleinsten Paarabstand.
5. **Die Perf-Messung log um Faktor zwei.** Die drei Perf-Tests liefen parallel und nahmen sich gegenseitig die CPU weg — p50 stand bei 32.5 ms. Seriell gemessen sind es 16.7 ms. Ein Perf-Test, der parallel zu anderen Perf-Tests läuft, misst nichts.

Dazu ein Handwerksfehler: Die Hüte schwebten über dem Kopf, weil ihre SVGs unten leeren Raum hatten. Behoben, indem jede Hut-Zeichnung auf die Unterkante ihres Rahmens gesetzt wurde.

**Offene SOLL-Follow-ups:**
- Low-Effects-Auslösung bei CPU-Drossel 6× erneut prüfen, sobald M3/M4 Filter und Partikel bringen.
- Wipe-Performance im DevTools-Panel gegenmessen (Übertrag aus A1).

**Manuelle Checks, die Luka bestätigen muss, bevor M3 startet:**
- [ ] **Wirken die Männchen lebendig?** Arena auf dem Handy ansehen (<https://lukabpunkt.github.io/Drinkshot/>, 4 und 8 Spieler). Laufen sie glaubwürdig? Ist das Blinzeln zu hektisch oder zu selten? Ist die Grundgeschwindigkeit richtig?
- [ ] **Look-Check gegen die Art Direction:** Sind die Outlines dick genug, die Köpfe groß genug, die Farben satt genug? `docs/screens/m2-rig.png` neben `docs/02-ART-DIRECTION.md §5` legen.
- [ ] Optional, aber hilfreich für M3: Fällt dir eine Farbe schwerer als die anderen, sobald das Scope-Dunkel kommt?

## Audit A3 — 2026-09-03

**Ergebnis:** BESTANDEN (alle automatisierbaren MUSS-Checks grün; 3 Checks brauchen echte Menschen)

| Check | Status | Notiz |
|---|---|---|
| Choreographer: Fairness (Opfer-Verweilzeit ≤ 1/n + 5 % über 10 000 Seeds) | ✅ | Für 2 bis 8 Spieler, je 10 000 Seeds. Schlimmster gemessener Wert je Spielerzahl: 49.8 % (n=2, Grenze 55.0) · 33.3 % (n=3, Grenze 38.3) · 25.7 % (n=4, Grenze 30.0) · 21.5 % (n=5) · 19.2 % (n=6) · 17.3 % (n=7) · 16.0 % (n=8, Grenze 17.5). |
| Choreographer: letzter Fake ≠ Opfer | ✅ | 10 000 Seeds × 7 Spielerzahlen. Frühere Fakes dürfen das Opfer treffen (ADR-19) — das ist eine bewusste Präzisierung, kein Schlupfloch. |
| Choreographer: 2-Spieler-Minimum | ✅ | Mindestens 4 Panik-Beats, für alle drei Dauer-Presets geprüft. |
| Choreographer: Determinismus | ✅ | Gleicher Seed ⇒ identisches Skript (200 Seeds, tiefer Vergleich); anderer Seed ⇒ in 190+ von 200 Fällen anderes Skript. |
| 1 000 simulierte Runden: `victimId` == angezeigtes Opfer in 100 % | ✅ | `showPipeline.test.ts` fährt die **ganze Kette**: Einsätze → `pickVictim` (sicherer Zufall) → `RoundSetup` → `ShowScript` → Lock-Ziel → `resolveRound`. 1 000 Runden mit wechselnder Spielerzahl, Modus und Dauer: das Lock-Ziel war immer das gezogene Opfer, und wer trinkt, passt zum Modus. |
| Perf-Test grün (p50 ≤ 20 ms, p95 ≤ 40 ms, CPU 4×) | ✅ | 8 Shotlings mit voller Show: **p50 16.7 ms · p95 18.5 ms · 2 Long-Tasks**. Zusätzlich neu: **JS-Zeit pro Frame p95 = 0.60 ms** bei 4-facher Drosselung (Budget 4 ms, Architektur §7.10) — dieser Wert hängt nicht am Renderer und misst überall dasselbe. |
| Filter nur während Shot/Lock aktiv | ✅ | `Scope.clearFilters()` setzt `view.filters = []`; Shockwave und RGB-Split werden **lazy** importiert (eigener Chunk) und nach dem Effekt zerstört. E2E prüft über die Scan- und Panik-Phase hinweg, dass das Dev-Panel `fltr aus` meldet. |
| Dauer-Presets 10/15/22 s ± 1 s | ✅ | Unit: 1 000 Runden × 3 Presets, Abweichung ≤ 1 s. E2E misst die echte Wanduhr: Kurz 11.9 s, Lang 23.0 s (jeweils inklusive derselben Todesanimation). |
| Stumm komplett spielbar | ✅ | E2E entfernt `AudioContext` **und** `webkitAudioContext` komplett und schaltet den Ton ab — die Runde läuft ohne einen einzigen Fehler bis zum Result durch. |
| Lock-Ticks synchron zur Reticle-Bewegung (± 50 ms) | ✅ konstruktiv | Der Tick wird nicht im Frame-Loop ausgelöst, sondern auf der **AudioContext-Uhr vorgeplant**: `play('lock_tick', hopMs/1000)` legt ihn exakt auf das Ende der Reticle-Fahrt. Damit ist der Versatz nicht „klein", sondern vom Scheduler garantiert. Der Höreindruck bleibt Lukas Urteil. |
| Tab-Wechsel → Pause, Rückkehr → Fortsetzung | ✅ | E2E: `visibilitychange` auf hidden — die Show bleibt drei Sekunden stehen und läuft nach dem Zurückschalten sauber weiter. Der PIXI-Ticker und GSAP stoppen zusätzlich in `ArenaApp`. |
| Wake-Lock aktiv | ✅ umgesetzt, ⏳ Gerät | `navigator.wakeLock.request('screen')` beim Betreten der Arena, mit erneutem Anfordern nach einem Tab-Wechsel (das Betriebssystem gibt den Lock dabei frei). Schlägt still fehl, wo es die API nicht gibt. Ob das Display 30 s durchhält, zeigt nur ein echtes Gerät. |
| Slow-Mo, Zoom, Herzschlag, Vignette-Puls im Lock spürbar | ⏳ manuell | Alles umgesetzt und in `docs/screens/m3-lock.png` sichtbar (rotes Reticle, zugeschnappte Eckklammern, chromatischer Rand, LOCK-Schriftzug). Ob es sich *spürbar* anfühlt, entscheidet der Ton und das Handy. |
| Spannungs-Test: 3 Personen sehen 5 Shows | ⏳ manuell | Das ist der eigentliche Test dieses Meilensteins und lässt sich nicht automatisieren. Protokoll unten. |

### Definition of Done (Roadmap M3)

| Kriterium | Status | Messwert |
|---|---|---|
| Die Show erzeugt nachweislich Spannung | ⏳ manuell | Fake-Locks, Slow-Mo, Herzschlag und Zoom sind da — die Wirkung misst nur ein Mensch |
| Timing-Presets funktionieren | ✅ | 10/15/22 s ± 1 s, unit- und E2E-geprüft |
| Perf-Test grün | ✅ | p50 16.7 ms · p95 18.5 ms · JS 0.60 ms |
| Ergebnis stimmt zu 100 % mit `victimId` überein | ✅ | 1 000 Runden über die ganze Kette |
| Sound optional (stumm voll spielbar) | ✅ | E2E ohne AudioContext |

### Standing Audit

| Check | Status | Notiz |
|---|---|---|
| `npm run typecheck` | ✅ | 0 Fehler |
| `npm run lint` | ✅ | 0 Fehler, 0 Warnings |
| `npm run test:unit` | ✅ | **228 passed**, 5 todo (M4) |
| `npm run test:e2e` | ✅ | 34 grün (24 Flow + 10 Show) auf iPhone 12 (WebKit) und Pixel 5. Läuft bewusst seriell — Tests, die eine 15-Sekunden-Show in Echtzeit abwarten, nehmen sich parallel gegenseitig die CPU weg. |
| `npm run test:perf` | ✅ | 4 grün |
| Kein hardcodierter UI-Text | ✅ | Grep 0 Treffer |
| Bundle | ✅ | 234 KB JS gzip über alle Chunks (Budget 450 KB). Die Filter liegen in eigenen Chunks und werden erst beim Schuss geladen. |

### Was M3 geliefert hat

- **`core/choreographer.ts`** — erzeugt das `ShowScript` deterministisch aus dem Seed: Intro, Scan (jeder genau einmal), Panik mit eingebauten Fake-Locks, Lock, Schuss, Tod, Outro. Die Anti-Vorhersagbarkeits-Regeln sind Teil der Konstruktion, nicht nachträglich geprüft.
- **`game/Scope.ts`** — Vignette mit weichem 24-px-Rand (als Radial-Textur, nicht als harte Kante), Fadenkreuz mit Mil-Dots und freiem Zentrum, vier Eckklammern, Atem-Wobble über Simplex-Noise, Lock/Fake-Lock/Flash, Glas-Effekte über lazy geladene Filter. Das Fadenkreuz ist auf das Sichtfenster maskiert.
- **`game/Camera.ts`** — Zoom, Parallax gegen die Sprungrichtung, Screen-Shake mit exponentiellem Abklingen, Slow-Mo, Nachbeben.
- **`game/ShowDirector.ts`** — eine GSAP-Timeline für die ganze Show; Beats steuern Scope, Kamera, Männchen und Ton. Das anvisierte Männchen bekommt Angst-Gesicht und Blick zur Kamera, das vorherige sprintet weg.
- **`game/deaths/`** — `DeathSequence`-Interface, Registry mit gewichteter Auswahl und No-Repeat-Fenster, `basic_fall` als erster vollständiger Eintrag nach allen sieben Animationsprinzipien.
- **`game/fx/`** — Partikel-Pool mit Kategorie-Budgets, Einschlag- und Erdfontänen-Effekte, Grabstein-Pop, Sprechblasen.
- **`audio/AudioManager.ts`** — 18 Cues, prozedural erzeugt (ADR-20), Herzschlag mit steigendem Tempo, Musik-Ducking, iOS-Unlock.
- **Wake-Lock** in der Arena, „Tippen zum Überspringen" nach dem Schuss, Dev-Panel mit Seed-Anzeige, Filter-Status, JS-Zeit und Wiederholen-Knopf.

### Sechs gefundene Fehler

1. **PIXI startete nicht.** Es baut Shader-Code per `new Function`, unsere CSP verbietet `unsafe-eval`. Statt die CSP aufzuweichen läuft jetzt der eval-freie PIXI-Pfad (ADR-15). Ein zweiter Verstoß fiel nur unter WebKit auf: PIXI lädt seine Default-Textur als `data:`-URL.
2. **Slow-Mo bremste die Show selbst aus.** `gsap.globalTimeline.timeScale(0.4)` verlangsamte auch die Show-Timeline — die Runde dauerte plötzlich 25 statt 15 Sekunden und erreichte den Result-Screen gar nicht mehr. Slow-Mo gehört in die Welt, nicht ins Drehbuch (ADR-21).
3. **Das Fadenkreuz zielte auf den Rasen.** `brain.y` ist der Bodenpunkt des Männchens; das Reticle landete konsequent unter den Füssen statt auf dem Körper. Aufgefallen erst beim Betrachten eines Screenshots — kein Test hätte das gemerkt.
4. **Die Ziel-Reparatur reparierte sich im Kreis.** Der erste Ansatz schob Fake-Locks nachträglich in eine fertige Reihenfolge und behob dabei eine Wiederholung, während er die nächste erzeugte. Ersetzt durch eine Slot-Folge, die in einem Durchgang gefüllt wird.
5. **Das Opfer hing systematisch *kürzer* im Fadenkreuz.** Ein Fehler, den der Audit gar nicht prüft — er misst nur die Obergrenze. Weil Fake-Locks nie auf dem Opfer landeten und lange halten, bekam es 10.6 % statt 12.5 % der Aufmerksamkeit. Auch das ist ein Muster. Behoben über frühe Fakes auf dem Opfer (ADR-19) und einen Ausgleich über die Haltezeiten (ADR-22): Abweichung bei zwei Spielern von 18.3 % auf **1.7 %**.
6. **Die Perf-Messung maß den Testrechner.** Headless-Chromium rendert ohne GPU in Software; die Arena lief dort mit 30 statt 60 fps. Mit GPU-Flags sind es 16.7 ms p50. Der Test erkennt den Software-Fall jetzt und sagt es, statt falsch grün oder falsch rot zu sein (ADR-23).

Dazu ein Nachtrag aus der CI: Der erste Lauf war rot. Auf einem Runner ohne GPU klemmt PIXI zu lange Frames ab (`maxElapsedMS`), wodurch die Show gedehnt statt springend weiterläuft — richtig auf einem echten Gerät, aber jede Wanduhr-Messung wird dadurch wertlos. Die betroffene Prüfung sagt das jetzt, statt zu scheitern. Ausserdem laufen die E2E-Tests seit diesem Meilenstein **seriell**: Wer eine 15-Sekunden-Show in Echtzeit abwartet, darf nicht neben einer zweiten Show laufen.

**Offene SOLL-Follow-ups:**
- Low-Effects-Auslösung bei CPU-Drossel 6× erneut prüfen (Übertrag aus A2; die Szene ist inzwischen teurer, könnte jetzt greifen).
- Wipe-Performance im DevTools-Panel gegenmessen (Übertrag aus A1).

**Manuelle Checks, die Luka bestätigen muss, bevor M4 startet:**
- [ ] **Der Spannungs-Test — der eigentliche Test dieses Meilensteins.** Drei Personen je fünf Shows zeigen (<https://lukabpunkt.github.io/Drinkshot/>, mit Ton). Zwei Fragen: *Konntest du vorhersagen, wen es trifft?* (Ziel: mindestens 2 von 3 sagen nein) und *hat jemand beim Fake-Lock reagiert?* (Ziel: mindestens ein „Neeein"). Wenn niemand zuckt, ist die Dramaturgie das Problem, nicht der Code.
- [ ] **Ton auf dem Handy:** Sitzen die Lock-Ticks auf der Reticle-Bewegung? Trägt der Herzschlag? Die Sounds sind synthetisiert (ADR-20) und bewusst schlicht — sag, was fehlt, dann kommen in M6 echte Samples an dieselbe Stelle.
- [ ] **Wake-Lock:** Bleibt das Display während einer 22-Sekunden-Show (Preset „Lang") an?

**Zum Anschauen:** `docs/screens/m3-intro.png`, `-scan`, `-panik`, `-lock`, `-shot`, `-tod` — die sechs Phasen der Show in der Reihenfolge, in der sie laufen.

## Zwischenbericht M4a — 2026-09-03

Die Roadmap teilt M4 in drei Etappen. **M4a (Kopf + Brust) ist fertig**: sechs Sequenzen,
jede einzeln im Dev-Panel abspielbar und unit-getestet. Bein, Po und Miss folgen in M4b,
Miracle und Politur in M4c. Der Tag `v0.4.0` bleibt bis dahin reserviert.

### Die sechs Sequenzen gegen die A4-Kriterien

| Sequenz | Zone | Dauer | Anticipation | Hit-Stop | Squash | Easing | Sound-Cues | Grabstein + Nachbeben |
|---|---|---|---|---|---|---|---|---|
| `head_helmet_spin` | Kopf | 3,22 s | Kopf zieht gegen die Drehrichtung | 80 ms | ✅ | `back.in`, `elastic.out` | 6 verschiedene | ✅ |
| `head_hat_launch` | Kopf | 4,42 s | Hut sackt vor dem Start | 80 ms | ✅ | `back.in`, `elastic.out` | 6 | ✅ |
| `head_xray` | Kopf | 1,71 s | 4 Frames Skelett-Flackern | 80 ms | ✅ | `power3.in`, `elastic.out` | 5 | ✅ |
| `body_dramatic` | Brust | 3,74 s | Hand fährt an die Brust | 80 ms | ✅ | `back.out`, `back.in` | 5 | ✅ |
| `body_deflate` | Brust | 2,78 s | bläht sich auf vor dem Start | 80 ms | ✅ | `power3.out`, `elastic.out` | 4 | ✅ |
| `body_freeze_shatter` | Brust | 2,71 s | Zittern beim Zufrieren | 80 ms | ✅ | `back.in`, `back.out` | 6 | ✅ |
| `basic_fall` (bleibt) | Brust | 1,81 s | kippt gegen die Fallrichtung | 80 ms | ✅ | `back.in`, `elastic.out` | 4 | ✅ |

Alle Werte sind gemessen, nicht abgehakt: Die Dauern kommen aus `timeline.duration()`, die
Cues aus einem mitschreibenden Audio-Double, Hit-Stop und Abschluss aus eigenen Tests
(`tests/unit/deaths.test.ts`, 60 Tests). Grenze laut Architektur §6 ist 1,5–4,5 s — die
längste Sequenz liegt bei 4,42 s, also knapp darunter.

### Gesamt-Checks

| Check | Status | Notiz |
|---|---|---|
| Sequenzen registriert, Dev-Preview zeigt alle | ✅ | `?dev=1&panel=deaths` startet direkt in der Arena, Dropdown mit allen sieben, ▶ spielt sofort. `npm run preview:deaths` öffnet das. |
| No-Repeat-Fenster 4 über 1 000 Runden | ✅ | greift ab 8 registrierten Sequenzen; bis dahin bewusst inaktiv, sonst gäbe es keine Auswahl mehr |
| Nach Sequenz + Reset ist der Shotling wieder `idle` | ✅ | pro Sequenz geprüft, inklusive Skalierung, Rotation, Alpha, Hut-Zugehörigkeit und Overlays |
| Result-Screen zeigt die richtige Zone | ✅ | `round.zone` kommt jetzt aus der Registry statt aus einem Platzhalter |
| Kein Frame-Drop während der Sequenz (max. 2 Long-Tasks) | ✅ | **0 Long-Tasks**, p50 16,7 ms · p95 17,6 ms bei CPU 4× — mit den neuen Sequenzen gemessen |
| Draw-Calls | ✅ | 5 (Arena 1 + Scope), unverändert zu M3 |
| Heap über 30 s | ✅ | +621 KB |
| Zweiter Schuss (leg/miss) | ⬜ M4b | Interface (`needsSecondShot`, `ctx.scope`) steht bereit |
| „Lustig-Test": 3 Personen, ≥ 2 lachen | ⏳ manuell | genau dafür ist der Schnitt nach sechs Sequenzen da |

### Fünf gefundene Fehler

1. **Nach `body_deflate` blieb das Männchen für immer platt.** `reset()` stellte alles
   wieder her — Rotation, Position, Alpha, jedes Rig-Teil — nur die **Skalierung** nicht.
   Der Fehler war lautlos: Die nächste Runde begann mit einem plattgedrückten Shotling.
   Mein eigener Reset-Test hat ihn übersehen, weil er die Skalierung nicht geprüft hat.
   Beides behoben.
2. **Grabsteine sammelten sich an.** Beim wiederholten Abspielen im Dev-Panel stand nach
   fünf Durchläufen ein Friedhof herum. `clearDeathProps()` räumt jetzt vorher ab; die
   Requisiten tragen dafür ein Label.
3. **In der Death-Preview lief die automatische Show mit.** Zwei Todesanimationen
   gleichzeitig auf zwei verschiedenen Männchen — man beurteilte die falsche. Die Preview
   startet den ShowDirector jetzt gar nicht erst.
4. **Der Eisblock verdeckte den Erfrorenen komplett.** Deckkraft von 0,92 auf 0,78 und die
   Farbverläufe im SVG deutlich transparenter.
5. **Die Kopf-Schraube war nicht lesbar.** Ein runder Kopf, der sich dreht, sieht aus wie
   ein runder Kopf — nur der Hut verriet die Bewegung. Jetzt schraubt sich der Kopf
   sichtbar in den Torso hinein, wird dabei schmaler und kommt mit Überschwung zurück.

Dazu zwei Test-Reparaturen: Der JS-Zeit-Test verlangte 60 Messwerte aus 6 Sekunden — auf
einem Runner ohne GPU kommen unter 4-facher Drosselung keine 60 Frames zustande, obwohl
die eigentliche Aussage stimmte. Und der Dauer-Preset-Test maß bis zum Result, also
inklusive Todesanimation; seit die je nach Sequenz zwischen 1,7 und 4,4 s dauert, schwankte
die Differenz um zwei Sekunden. Er misst jetzt bis zum **Schuss** — genau das, was das
Preset steuert. Ergebnis stabil: Kurz 9,84 s, Lang 20,4 s.

### Was M4a technisch gebracht hat

- **Rig-Zugriff für Sequenzen**: `victim.rig` gibt Kopf, Torso, Arme, Beine, Füße, Gesicht,
  Hut und Schatten frei. `setDriven()` nimmt der Automatik die Kontrolle ab (sonst zöge das
  Brain das fliegende Männchen jeden Frame zurück), `detachHat()` löst den Hut für den
  Abschuss, `addOverlay()` legt Skelett und Eis über den Körper.
- **Gemeinsamer Abschluss** `finishDeath()`: Grabstein, Nachbeben-Zoom und „die anderen
  bleiben stehen, schauen hin, einer klatscht". Einmal geschrieben statt zwölfmal kopiert —
  und der Test prüft, dass jede Sequenz ihn benutzt.
- **`createCanvasTexture()`**: Grabstein, Sprechblase und Partikel fallen sauber zurück,
  wenn kein 2D-Kontext da ist. Das macht die Sequenzen in jsdom testbar und schützt
  nebenbei Browser mit abgeschaltetem Canvas.
- **Echte Death-Auswahl**: `createRoundSetup` bekommt die Wahl als Callback herein, damit
  `core/` nicht auf `game/` zeigen muss. Die Auswahl hängt am Seed der Runde — dieselbe
  Runde lässt sich später identisch abspielen.

**Zum Anschauen:** `docs/screens/m4a-<id>.png` — pro Sequenz acht Frames über die Laufzeit
nebeneinander. Besser als ein Video, weil man die Key-Frames vergleichen kann.

**Was Luka beurteilen muss:**
- [ ] **Zündet der Gag?** Jede Sequenz einmal ansehen (`npm run preview:deaths` oder das
      Dropdown links unten). Welche funktioniert, welche nicht?
- [ ] Ist `body_dramatic` mit dem doppelten Aufstehen zu lang oder genau richtig?
- [ ] Liest sich `head_helmet_spin` als Schraube — oder muss der Kopf noch tiefer rein?

## Zwischenbericht M4b — 2026-09-04

**Bein, Po und Miss sind fertig** — damit stehen elf der zwölf Sequenzen aus GDD §4.1.
Nur `miracle_dodge` fehlt (M4c), zusammen mit der Feier auf dem Result-Screen.

Neu in dieser Etappe ist der **zweite Schuss**: Bei drei Sequenzen fällt ein weiterer
Schuss mitten in der Animation. Das ist mehr als ein zusätzlicher Knall — das Reticle muss
dem Opfer sichtbar folgen, sonst ist der Schuss nur laut statt komisch. Der Aufbau steht
einmal in `secondShot()`, damit alle drei dasselbe Timing haben: nachführen, kurz halten,
Blitz, Knall, Wackler.

### Die fünf neuen Sequenzen gegen die A4-Kriterien

| Sequenz | Zone | Dauer | 2. Schuss | Anticipation | Hit-Stop | Squash | Cues | Abschluss |
|---|---|---|---|---|---|---|---|---|
| `leg_hop` | Bein | 4,39 s | ✅ | Bein zieht sich an | 80 ms | ✅ pro Hüpfer | 9 | ✅ |
| `leg_spin` | Bein | 3,34 s | ✅ | Kreisel beschleunigt | 80 ms | ✅ | 8 | ✅ |
| `butt_rocket` | Po | 3,74 s | – | sackt vor dem Start ab | 80 ms | ✅ | 6 | ✅ |
| `butt_hotfoot` | Po | 2,89 s | – | Sprung vor dem Rennen | 80 ms | ✅ | 5 | ✅ |
| `miss_then_hit` | Miss | 4,15 s | ✅ | zuckt weg, dann Erleichterung | 80 ms | ✅ | 10 | ✅ |

### Alle elf im Überblick

| Zone | Sequenzen | Dauern |
|---|---|---|
| Kopf | `head_helmet_spin`, `head_hat_launch`, `head_xray` | 3,22 / 4,42 / 1,71 s |
| Brust | `body_dramatic`, `body_deflate`, `body_freeze_shatter` (+ `basic_fall`) | 3,74 / 2,78 / 2,71 (+ 1,81) s |
| Bein | `leg_hop`, `leg_spin` | 4,39 / 3,34 s |
| Po | `butt_rocket`, `butt_hotfoot` | 3,74 / 2,89 s |
| Miss | `miss_then_hit` | 4,15 s |
| Miracle | — | M4c |

Alle zwölf registrierten Sequenzen liegen zwischen 1,71 s und 4,42 s; die Grenze aus
Architektur §6 ist 4,5 s. Der No-Repeat-Filter greift jetzt tatsächlich, weil mit zwölf
Einträgen die Mindest-Poolgrösse von acht überschritten ist.

### Was die Tests jetzt abdecken

Die Sequenz-Tests holen ihre Liste **aus der Registry**, nicht aus einer gepflegten
Aufzählung. Jede neue Sequenz wird damit automatisch gegen alle A4-Kriterien geprüft —
Dauer, Endzustand, sauberer Reset inklusive Skalierung, Sound-Cues, Overshoot-Easing,
Hit-Stop und der gemeinsame Abschluss. In M4c muss niemand daran denken, `miracle_dodge`
in eine Testliste einzutragen.

Dazu drei neue Zusicherungen speziell für den zweiten Schuss: Er fällt nur bei `leg_hop`,
`leg_spin` und `miss_then_hit`, das Reticle nimmt vorher sichtbar die Verfolgung auf, und
der Schuss wird angekündigt (`lock_engage`), bevor er kracht.

| Check | Wert |
|---|---|
| Unit-Tests | **334** grün (104 für die Sequenzen) |
| E2E | 34 grün auf iPhone 12 (WebKit) + Pixel 5 |
| Perf mit 12 Sequenzen | **0 Long-Tasks**, p50 16,7 ms · p95 17,6 ms bei CPU 4× |
| JS-Zeit pro Frame | p95 0,70 ms (Budget 4 ms) |
| Draw-Calls | 5, unverändert |
| Heap über 30 s | +622 KB |

### Zwei gefundene Fehler

1. **`miss_then_hit` liess das Opfer am Leben.** Die Sequenz setzte den Zustand nie auf
   `dead` — nach der Runde wäre das Männchen weitergelaufen, während der Result-Screen
   verkündet, dass es getroffen wurde. Der Fehler war naheliegend, weil das Opfer hier
   absichtlich erst **spät** stirbt: Es überlebt den ersten Schuss, winkt erleichtert, und
   erst der zweite trifft. Genau an dieser Stelle fehlte die Zeile.
2. **Das Erdloch klebte am Körper statt am Boden.** Bei `leg_spin` und `butt_rocket` war es
   als Rig-Overlay angelegt und drehte und verschob sich deshalb mit — bei dem kopfüber im
   Boden steckenden Männchen landete es über dessen Füssen. Bodenrequisiten haben jetzt
   ein eigenes Modul (`fx/GroundProp.ts`) und liegen dort, wo eingeschlagen wurde.

### Eine Lehre über die Testumgebung

Während dieser Etappe fiel in jedem vollen E2E-Lauf ein **anderer** Test durch — mal die
Persistenz, mal der Zurück-Button, mal die Stumm-Prüfung. Isoliert liefen alle grün, und
zwar stabil auf die Zehntelsekunde. Die Ursache war kein Testfehler: Parallel lief ein
Dev-Server mit offener Arena, die durchgehend mit 60 fps rendert und den Tests die CPU
wegnahm. Sobald der Tab auf dem Titelbildschirm parkte, waren alle 34 grün.

Zwei Dinge bleiben als Konsequenz: Die Standard-Wartezeit von Playwright steht jetzt auf
10 s statt 5 s — bei einer App, in der fast jede Zusicherung hinter einer Animation hängt,
sind fünf Sekunden auf einem ausgelasteten Rechner oder einem CI-Runner mit zwei Kernen zu
knapp. Und der Persistenz-Test wartet jetzt darauf, dass wirklich geschrieben wurde, statt
darauf zu hoffen.

**Zum Anschauen:** `docs/screens/m4b-*.png`, acht Frames pro Sequenz. In `leg_hop` und
`miss_then_hit` erwischt der Kontaktbogen den Mündungsblitz des zweiten Schusses als
weisses Bild — der Beweis, dass er im richtigen Moment fällt.

**Was Luka beurteilen muss:**
- [ ] `leg_hop`: Ist die Verfolgung durch das Reticle lang genug, dass man mitleidet — oder
      schon zu lang?
- [ ] `miss_then_hit`: Kommt der zweite Schuss früh genug, dass die Hand noch oben ist?
- [ ] `butt_rocket`: Trägt die leere Sekunde, oder wirkt sie wie ein Hänger?

## Audit A4 — Animations-Qualitäts-Audit — 2026-09-04

**Ergebnis:** BESTANDEN (alle automatisierbaren MUSS-Checks grün; der „Lustig-Test" braucht
echte Menschen)

Das GDD nennt die Todesanimationen „das Herzstück" und die Roadmap dieses Audit „den
wichtigsten". Beides stimmt: Ohne die Tode ist Drinkshot ein Zufallsgenerator mit Vignette.

### Alle zwölf Sequenzen aus GDD §4.1 — plus `basic_fall`

| Sequenz | Zone | Dauer | 2. Schuss | Cues |
|---|---|---|---|---|
| `head_helmet_spin` | Kopf | 3,22 s | – | 6 |
| `head_hat_launch` | Kopf | 4,42 s | – | 6 |
| `head_xray` | Kopf | 1,71 s | – | 5 |
| `body_dramatic` | Brust | 3,74 s | – | 5 |
| `body_deflate` | Brust | 2,78 s | – | 4 |
| `body_freeze_shatter` | Brust | 2,71 s | – | 6 |
| `leg_hop` | Bein | 4,39 s | **ja** | 9 |
| `leg_spin` | Bein | 3,34 s | **ja** | 8 |
| `butt_rocket` | Po | 3,74 s | – | 6 |
| `butt_hotfoot` | Po | 2,89 s | – | 5 |
| `miss_then_hit` | Miss | 4,15 s | **ja** | 10 |
| `miracle_dodge` | Wunder | 3,92 s | – | 4 |
| `basic_fall` | Brust | 1,81 s | – | 4 |

### Die Kriterien pro Sequenz

Die A4-Tabelle verlangt für **jede** Animation eine eigene Zeile. Statt dreizehn Zeilen mit
denselben Haken steht hier, wie jedes Kriterium geprüft wird — automatisiert, für jede
Sequenz, aus der Registry abgeleitet (`tests/unit/deaths.test.ts`, 128 Tests):

| Kriterium | Wie geprüft | Ergebnis |
|---|---|---|
| Dauer 1,5–4,5 s | `timeline.duration()` je Sequenz | 1,71–4,42 s, alle innerhalb |
| Anticipation ≥ 2 Frames Gegenbewegung | Review je Sequenz, in jeder Datei kommentiert | ✅ 13/13 |
| Hit-Stop 80 ms beim Treffer | Timeline nach einem Kind mit exakt `ANIM.hitStopMs` durchsucht | ✅ 12/12 (Wunder hat keinen Treffer) |
| Squash & Stretch beim Aufprall | `impactBeat()` bzw. eigene Skalierung, Review | ✅ 13/13 |
| Overshoot-Easing, kein `linear`/`power1` | Easings aller Tweens gelesen, mindestens ein `back`/`elastic`/`bounce`/`power2+` gefordert | ✅ 13/13 |
| Sound-Cues auf Key-Frames (± 50 ms) | Cues über ein mitschreibendes Audio-Double gezählt; sie hängen als `timeline.call()` an derselben Zeitachse und werden auf der AudioContext-Uhr vorgeplant | ✅ 4–10 Cues je Sequenz |
| Endet mit Grabstein-Pop und Nachbeben-Zoom | `finishDeath()` setzt eine Markierung auf der Timeline; der Test fordert sie von jeder Sequenz | ✅ 13/13, beim Wunder ohne Grab |
| Endzustand `dead` (ausser Wunder) | nach `timeline.progress(1)` geprüft | ✅ 12× `dead`, 1× überlebt |
| Rig-Reset: danach wieder `idle` | Position, Rotation, **Skalierung**, Alpha, Hut-Zugehörigkeit und Overlays einzeln geprüft | ✅ 13/13 |
| Kein Frame-Drop (max. 2 Long-Tasks) | `perf.spec.ts` bei CPU-Drossel 4× | **0 Long-Tasks** |
| Lesbarkeit auf dem Handy in 1 s | Kontaktbögen `docs/screens/m4*-*.png` | ⏳ Lukas Urteil |
| „Lustig-Test": 3 Personen, ≥ 2 lachen | – | ⏳ manuell |

### Gesamt-Checks

| Check | Status | Notiz |
|---|---|---|
| 12 Sequenzen registriert, Dev-Preview zeigt alle | ✅ | 13 im Dropdown unter `?dev=1&panel=deaths`; `npm run preview:deaths` öffnet es direkt |
| No-Repeat-Fenster 4 über 1 000 Runden | ✅ | greift jetzt tatsächlich — mit 13 Einträgen ist die Mindest-Poolgrösse von 8 überschritten |
| Second-Shot-Tode triggern Verfolgung + zweiten Schuss | ✅ | genau `leg_hop`, `leg_spin`, `miss_then_hit`; der Test fordert Reticle-Nachführung **und** Ankündigung (`lock_engage`) vor dem Knall |
| Result-Screen zeigt richtige Zone + Zonen-Text | ✅ | `round.zone` kommt aus der Registry; E2E prüft eine erzwungene `leg_hop`-Runde bis zum Zonen-Text „Ins Bein… und nochmal!" |
| Miracle: Session-Regel korrekt, Result feiert es | ✅ | E2E: erzwungenes Wunder mit drei Spielern — Scoreboard bleibt bei null, „LEGENDE"-Badge, Gold-Konfetti, Chor. Im Verteiler-Modus trinken alle 1 (unit-getestet). |
| Wunder-Rate 1 von 40 | ✅ | über 40 000 Ziehungen gemessen, und die Gegenprobe zeigt: die Rate hängt **nicht** an der Zahl der übrigen Sequenzen (ADR-32) |
| Alle Sequenzen sauber gegen Rig-Reset | ✅ | siehe oben |
| Video aller Tode | ✅ ersetzt | Kontaktbögen statt Video (ADR-27): acht Frames pro Sequenz nebeneinander. Ohne Encoder im System kein Video — und zum Vergleichen der Key-Frames ohnehin besser. |

### Standing Audit

| Check | Wert |
|---|---|
| `npm run typecheck` | 0 Fehler |
| `npm run lint` | 0 Fehler, 0 Warnings |
| `npm run test:unit` | **348** grün, 0 todo |
| `npm run test:e2e` | **38** grün auf iPhone 12 (WebKit) + Pixel 5 |
| `npm run test:perf` | 4 grün · p50 16,7 ms · p95 17,6 ms · **0 Long-Tasks** · JS-Zeit p95 0,90 ms |
| Draw-Calls | 5 (Arena 1 + Scope), unverändert seit M3 |
| Heap über 30 s | +674 KB |
| Bundle | 241 KB JS gzip (Budget 450), Atlas @2x 218 KB |

### Die Fehler dieses Meilensteins

Über M4a bis M4c waren es neun. Vier davon hätte kein Test der Welt gefunden, weil sie
Gestaltung betreffen — die stehen in den Zwischenberichten. Drei waren echte Programmfehler,
die lautlos gewesen wären:

1. **Nach `body_deflate` blieb das Männchen für immer platt.** `reset()` stellte alles
   wieder her ausser der Skalierung. Die nächste Runde hätte mit einem plattgedrückten
   Shotling begonnen. Mein eigener Reset-Test hat es übersehen — er prüfte die Skalierung
   nicht. Beides behoben.
2. **`miss_then_hit` liess das Opfer am Leben.** Der Zustand wurde nie auf `dead` gesetzt:
   Das Männchen wäre nach der Runde weitergelaufen, während der Result-Screen es für tot
   erklärt. Der Fehler war naheliegend, weil das Opfer hier absichtlich erst **spät** stirbt.
3. **Das Erdloch klebte am Körper statt am Boden** und landete beim kopfüber Steckenden
   über dessen Füssen.

Dazu drei Test-Reparaturen, die alle dasselbe Muster hatten: **Der Test war zu eng gefasst,
nicht der Code kaputt.** Der JS-Zeit-Test verlangte mehr Frames, als ein Runner ohne GPU
liefern kann. Der Dauer-Preset-Test mass inklusive Todesanimation, die seit M4a variabel
ist. Und in jedem vollen E2E-Lauf fiel ein *anderer* Test durch — bis sich zeigte, dass ein
parallel offener Browser-Tab mit laufender Arena den Tests die CPU wegnahm. Danach: 38 von
38 grün.

**Offene SOLL-Follow-ups:**
- Low-Effects-Auslösung bei CPU-Drossel 6× erneut prüfen (Übertrag aus A2)
- Wipe-Performance im DevTools-Panel gegenmessen (Übertrag aus A1)

**Der eine Check, den nur Menschen machen können:**
- [ ] **Der „Lustig-Test".** Drei Personen sehen jede Sequenz einmal — bei mindestens zwei
      soll es zünden. `npm run preview:deaths` öffnet die Vorschau mit allen dreizehn im
      Dropdown. Interessant sind vor allem die drei mit Timing-Risiko: `body_dramatic`
      (doppeltes Aufstehen), `butt_rocket` (die leere Sekunde) und `leg_hop` (wie lange das
      Reticle verfolgt). Sag, welche zu lang, zu kurz oder unverständlich ist — das ist der
      Input für M5.

**Zum Anschauen:** `docs/screens/m4a-*.png`, `m4b-*.png`, `m4c-miracle_dodge.png` und
`m4c-result-miracle.png`.

---

## M5 — Polish, Modi, Juice & Accessibility (2026-09-04)

Der Meilenstein hatte zwei Schwerpunkte, die auf den ersten Blick nichts miteinander zu
tun haben und sich dann gegenseitig bestimmten: **den Start leicht machen** und **die
Runde fertig machen**. Beides lief auf dieselbe Frage hinaus — was muss wirklich da sein,
bevor jemand zum ersten Mal tippt?

### Was gebaut wurde

**Der Arena-Code wird nachgeladen.** PIXI, GSAP, die Filter und alle dreizehn
Todesanimationen lagen im Einstiegs-Chunk, obwohl bis zum ersten Schuss nur Menüs zu sehen
sind: 159 KB gzip, die niemand braucht, während er Namen eintippt. Die Ziehung des Todes
hing daran, weil sie über die Registry der fertigen Sequenzen lief. Jetzt hält
`deaths/catalog.ts` nur die Metadaten (ADR-35), der Screen kommt per `import()` und wird
beim Betreten der **Lobby** vorgeladen, die Atlanten wie bisher beim **Pass** (ADR-36).

| | vorher | nachher |
|---|---|---|
| Einstiegs-Chunk | 159,00 KB gzip | **21,2 KB gzip** |
| Arena-Chunk | (im Einstieg) | 138,2 KB gzip, lazy |
| JS gesamt | 241 KB | 249 KB |

Das Gesamtvolumen wächst leicht — Code-Splitting kostet ein paar Byte Modul-Verwaltung.
Der Punkt ist nicht die Summe, sondern was vor dem ersten Bild geladen wird: **28 KB
gzip** (JS + CSS) statt 165.

**Double Tap erschiesst jetzt beide Opfer.** Der Kern liess seit M1 zwei Leute trinken,
die Show traf aber nur einen — das zweite Opfer stand nach der Runde unversehrt da und
sollte trinken. Ein zweiter vollständiger Aufbau kam nicht in Frage: Die Spannung ist mit
dem ersten Schuss verbraucht, ein zweiter Scan würde sie nicht wiederholen, sondern
langweilen. Der Nachschlag ist deshalb ein Ruck aufs nächste Ziel (500 ms), Lock (900 ms),
Schuss, eigene Sequenz (ADR-37). Der Aufbau bis zum ersten Schuss bleibt exakt so lang wie
das Preset sagt, und die Fairness-Bilanz vor dem Lock ist unverändert — beides ist
getestet.

**Der Titel-Loop ist CSS, nicht PIXI** (ADR-38). Die Roadmap sah eine echte Arena-Instanz
vor; die hätte den Renderer beim Start geladen und den Split von oben aufgehoben — 159 KB
für einen Gag, der vor dem ersten Tap läuft. Stattdessen ein Inline-SVG in der
Rig-Sprache mit CSS-Keyframes: Laufzyklus, einfahrendes Fadenkreuz, Blitz, Umkippen mit
Anticipation und Overshoot.

Dazu: Zahlen und Balken im Result zählen versetzt hoch, die Haptik pulsiert im Lock im
Herzschlag-Takt (eigener Timer, damit sie auch bei stummem Gerät trägt), zwei einmalige
Hinweise in der ersten Runde, und Ladefehler enden in einem Toast mit „Nochmal versuchen"
statt in einem schwarzen Bild.

### Audit A5 — 2026-09-04

**Ergebnis:** BESTANDEN

| Check | Status | Notiz |
| --- | --- | --- |
| Lighthouse Mobile: Performance ≥ 90 | ✅ | **100** · FCP 1,3 s · LCP 1,6 s · TBT 0 ms · CLS 0 |
| Lighthouse: Accessibility ≥ 90 | ✅ | **96** · ein verbleibender Befund, siehe unten |
| Lighthouse: Best Practices ≥ 90 | ✅ | **100** |
| PWA installierbar | ✅ | Manifest mit `any` + `maskable`, `display: standalone`, SW aktiv |
| JS gzip ≤ 450 KB | ✅ | **249 KB**; CI bricht ab, wenn das Budget reisst |
| Initial-Assets ≤ 1 MB | ✅ | 28 KB JS+CSS, 60 KB Fonts, 68 KB Icons; Atlanten (552 KB) erst ab PASS |
| Arena-Chunk lazy | ✅ | nicht in `index.html` referenziert; CI prüft das mit |
| Kontrast aller Textfarben ≥ 4.5:1 | ✅ | 25 Paare, schlechtestes 4,58:1 · `npm run check:contrast`, läuft in CI |
| `prefers-reduced-motion` respektiert | ✅ | Titel-Loop still, Wipe wird Fade, Konfetti aus, Zähler springen auf den Endwert |
| Tastatur-Navigation Titel→Lobby | ✅ (SOLL) | Tab erreicht alle drei Buttons, Enter wechselt, Fokus landet im neuen Screen |
| EN vollständig, kein `[missing:` | ✅ | 127 Schlüssel je Sprache, deckungsgleich; DE und EN im E2E abgesucht |
| Alle 4 Modi erklärt und spielbar | ✅ | jeder mit Namen und erklärendem Satz; Double Tap end-to-end belegt |
| Sudden-Death-Ausscheiden sichtbar | ✅ | gedimmte Zeile mit „Ausgeschieden" in der Lobby |
| Titel-Loop ohne Speicherleck (10 min) | ✅ | Heap **±0 KB**, DOM konstant 59 Knoten, 8 Animationen |
| Haptik: Android spürbar, iOS still | ⏳ manuell | `navigator.vibrate` fehlt auf iOS — abgefangen, kein Fehler; Muster nur am Gerät beurteilbar |
| Offline-Start nach Erstinstallation | ✅ (Chromium) | E2E: SW aktiv, Netz aus, Reload → Titelbild samt Loop. Unter WebKit uebersprungen — Playwright bricht dort beim Offline-Reload mit „internal error" ab, das ist die Testumgebung, nicht die App. Auf echtem iOS-Safari bleibt es ein manueller Check. |
| Atlas-Fehler → Toast | ✅ | E2E: beide Versuche blockiert → Toast mit „Nochmal versuchen", Runde endet trotzdem im Result |

**Der eine verbleibende Lighthouse-Befund** ist der Logo-Schriftzug: axe liest den 4 px
dicken `-webkit-text-stroke` als Textfarbe, und Tinte auf fast-schwarzem Grund ergibt
1,04:1. Gelesen wird aber die **Füllung** — Akzent auf Deep-BG, 11,03:1. Ich habe das
nicht „wegoptimiert": Den Umriss zu entfernen würde die Sticker-Sprache aus der Art
Direction aufgeben, um eine Heuristik zu bedienen, die hier danebenliegt. Accessibility
steht mit 96 deutlich über der Grenze.

**Zur Heap-Messung:** Chrome rundet `performance.memory` aus Datenschutzgründen auf etwa
100 KB. „±0 KB" heisst also präziser: **Wachstum unterhalb der Messauflösung.** Die
belastbareren Zahlen stehen daneben — DOM-Knoten und laufende Animationen blieben über
zehn Minuten konstant, und der Loop hat weder Timer noch Frame-Schleife. Nachmessen:
`node scripts/measure-title-heap.mjs <URL> <Minuten>`.

### Die Fehler dieses Meilensteins

1. **Der Hut-Block stand auch im Frame-Loop.** Beim Einbau der `requiresHat`-Logik landete
   derselbe Abschnitt zweimal in `ArenaScreen` — einmal im Aufbau, einmal im Ticker. Dort
   hätte er bei **jedem Frame** ein Array gebaut, was Architektur §7 ausdrücklich verbietet.
   Gefunden beim Nachlesen des Diffs, nicht durch einen Test: Ein Test hätte ihn nicht
   bemerkt, weil er funktional nichts kaputt macht.
2. **Der Router nahm dem Pass-Screen die Tastatur.** Die neue Fokus-Führung setzte
   `tabindex="-1"` auf jeden Screen — der Pass-Screen ist aber selbst eine grosse Taste mit
   `tabindex="0"` und wäre so per Tastatur unerreichbar geworden. Jetzt wird nur gesetzt,
   wo noch keiner steht.
3. **Zwei echte Kontrast-Fehlschläge.** Papier auf der Danger-Fläche kam auf 3,44:1
   (Knopf *und* Toast), Lila auf dem Panel auf 4,33:1. Beide standen seit M1 im Code und
   sind keinem Blick aufgefallen — deshalb prüft das jetzt ein Skript in der CI, statt
   einmalig axe.
4. **`user-scalable=no` im Viewport.** Verhindert Pinch-Zoom komplett; das Doppeltipp-Zoom,
   um das es eigentlich ging, unterbindet `touch-action: manipulation` ohnehin schon.
   Alleine dieser Punkt kostete 10 von 100 Lighthouse-Punkten.
5. **`Element.animate` gibt es in jsdom nicht** — und die Zeile stand nicht nur im Schmuck,
   sondern auch dort, wo auf `.finished` gewartet wird. Fehlt die API, bricht dann nicht
   die Animation ab, sondern der Ablauf dahinter (ADR-39).

Dazu zwei Testfehler eigener Machung: Mein `addInitScript` leerte `localStorage` bei
**jeder** Navigation und damit auch beim Reload — der Test „Sprache überlebt den Reload"
warf weg, was er prüfen wollte. Und die Modus-Buttons melden sich als `aria-checked`
(Radiogruppe), nicht als `aria-pressed`; da war der Test falsch, nicht der Code.

**Offene SOLL-Follow-ups:**
- Low-Effects-Auslösung bei CPU-Drossel 6× erneut prüfen (Übertrag aus A2)
- Wipe-Performance im DevTools-Panel gegenmessen (Übertrag aus A1)
- Arena-Themes (Roadmap M5.5, „nice-to-have") bewusst nicht gebaut — sie kosten Atlas-Fläche
  und lösen kein Problem, das im Playtest aufgefallen wäre. Entscheidung für M6.

**Manuelle Checks, die Luka bestätigen muss, bevor M6 startet:**
- [ ] **Haptik am Gerät.** Auf Android: Pulsiert es im Lock spürbar im Herzschlag-Takt und
      hört es mit dem Schuss auf? Auf dem iPhone: passiert einfach nichts (richtig so)?
- [ ] **Der Titel-Loop.** Zündet der Gag — läuft, Fadenkreuz, Umkippen — oder wirkt er
      neben dem Logo nur unruhig?
- [ ] **Die zwei Hinweise in der ersten Runde.** Zu viel, zu wenig, oder genau richtig?
      Der Bet-Hinweis steht direkt über der schon vorhandenen Zeile „Mehr Einsatz =
      höheres Risiko" — ist das doppelt?
- [ ] **Double Tap einmal spielen.** Kommt der Nachschlag überraschend oder wirkt er
      angehängt? `Einstellungen → Modus → Double Tap`.
- [ ] **Offline auf dem iPhone.** Seite einmal laden, zum Homescreen hinzufügen, Flugmodus
      an, App öffnen. Unter Chromium ist das getestet; Playwright kann es unter WebKit
      nicht, also muss es einmal ein Mensch am Gerät sehen.

---

## M5b — Showdown & Start-Screen (2026-09-04)

Zwei Wünsche, die nichts miteinander zu tun haben — und beim Bauen kamen fünf Fehler
heraus, die schon vorher im Spiel steckten.

### Der Start-Screen

Bis jetzt startete die Show in dem Moment, in dem der letzte Spieler „Bestätigen &
verstecken" tippte. Das Handy lag da noch in seiner Hand; niemand am Tisch sah den Anfang.
Der Pass-the-Phone-Fluss hatte keinen Übergabepunkt.

Jetzt steht dazwischen ein Zustand `READY`: „Alle haben gesetzt", die Farb-Badges aller
Mitspieler, **„Legt das Handy in die Mitte"**, Modus- und Dauer-Chip, ein grosser
Start-Knopf. Keine Einsätze — Audit A1 verlangt, dass ab dem Bestätigen keine Zahl mehr
sichtbar ist, und dieser Screen ist die neue Stelle, an der man das brechen könnte.

**Die Ziehung wandert mit.** Sie hing am `confirm` des letzten Spielers und hängt jetzt am
`startShow`. Sie passiert weiterhin genau einmal und ausschliesslich in der FSM (ADR-2) —
aber an dem Übergang, der die Show wirklich startet. Wer aus READY abbricht, hat nie
gezogen.

### Der Showdown

Alle setzen wie immer, dann fallen n−1 Schüsse in **einer** Runde, bis einer steht. Jeder
Getroffene trinkt seinen eigenen Einsatz, der Überlebende verteilt seinen.

Der Unterschied zu „Sudden Death" ist die Reichweite: Dort scheidet man für die **Session**
aus. Hier gilt das Ausscheiden nur innerhalb der Runde — `eliminatedIds` bleibt leer.
Stünde da etwas drin, wäre die Session nach genau einer Runde vorbei: `activePlayers()`
filtert danach, `canStart()` würde false, „Nächste Runde" wäre ausgegraut. Ein E2E-Test
belegt, dass danach weitergespielt werden kann.

**Die Dramaturgie.** Ein gleichmässiger Nachschlag wie bei Double Tap trägt hier nicht —
der erste Schuss von sechs ist kein Höhepunkt, der letzte ist einer. Die Show ist deshalb
eine Kette von Segmenten mit wachsender Länge:

```
Auftakt   ████████████        60 % einer Runde, voller Scan
Montage   ███ → ████ → ██████ geometrisch wachsend, ohne Scan
FINALE    ██████████████████  90 %, Scan + Panik + Fake-Locks
```

| Spieler | Schüsse | Kurz | Normal | Lang |
|---|---|---|---|---|
| 4 | 3 | 20 s | 28 s | 38 s |
| 6 | 5 | 25 s | 34 s | 37 s |
| 8 | 7 | 29 s | 35 s | 42 s |

Gedeckelt auf 45 s: Erst wird die Montage gestaucht, dann der Auftakt gekürzt. Das Finale
nie — es ist der Grund, warum jemand den Modus spielt.

### Die Fairness-Falle, die fast durchgerutscht wäre

Die Regel „der letzte Fake-Lock ist nie das Opfer" berechnet die Nicht-Opfer. Bei n−1
Opfern ist das **genau eine Person: der Gewinner**. Jeder letzte Fake hätte ihn verraten —
in jedem Segment, jede Runde. Deshalb werden Opfer, Nicht-Opfer und Verweilzeit-Bilanz
pro Segment gerechnet. Ein Test misst genau das: Der letzte Fake zeigt in unter 75 % der
Fälle auf den Überlebenden; global gerechnet wären es exakt 100 %.

Dazu drei weitere Zusicherungen, alle gemessen statt behauptet:

| Zusicherung | Messung |
|---|---|
| Gleiche Einsätze ⇒ gleiche Überlebenschance | 1/n ± 1 % über 100 000 Runden |
| Mehr Einsatz ⇒ seltener überleben | streng fallend über 100 000 Runden |
| Der Überlebende hängt nicht auffälliger im Fadenkreuz als andere Nicht-Opfer | Abweichung < 1 % über 4 000 Seeds |
| Die Schusszeiten hängen nicht davon ab, **wen** es trifft | identisch über alle Opfer-Permutationen |

### Die Fehler, die schon vorher drin waren

1. **Der zweite Double-Tap-Lock zielte auf die Leiche.** `ShowDirector` las im `lock`-Beat
   die Einzahl-Option `victimId` statt `beat.target` — das Fadenkreuz fuhr auf das bereits
   tote erste Opfer zurück, nachdem der `aim`-Beat davor korrekt auf das zweite geruckt
   war. Ausgeliefert seit M5. Aufgefallen ist es nur, weil der Director **keinen einzigen
   Unit-Test** hatte; der neue wurde gegen den alten Code gegengeprüft und wird dort rot.

2. **Vier Abläufe hingen an `animation.finished`** — und Chrome hält Animationen in einem
   Hintergrund-Tab an. `playState` bleibt „running", `currentTime` bleibt 0, das
   Versprechen löst nie auf. Betroffen: der Router-Wipe (und weil `go()` serialisiert,
   blieb danach **jeder** Screenwechsel für den Rest der Session hängen), die
   „Zahl-im-Tresor"-Animation im Bet-Screen (das `confirm` kam nie, und der Knopf war schon
   auf `submitted` gesetzt — die Runde liess sich nicht mehr bestätigen), das Schliessen
   eines Sheets und das Entfernen eines Toasts. Auf dem Handy reicht dafür ein Anruf mitten
   im Übergang. Gefunden nur, weil der Testbrowser zufällig im Hintergrund lief — kein
   E2E-Test deckt das ab, Playwright hält seine Seite sichtbar.

3. **`setAimed` hätte Leichen aufgeweckt.** Eine Sequenz setzt `dead` erst an ihrem Ende;
   bis dahin ist das Opfer nur `isDriven()`. Ohne Guard hätte der nächste Zielwechsel ihm
   `panic` + `burst` gegeben, während GSAP sein Rig animiert.

4. **`deathTimeline` war ein Einzelfeld** — bei mehreren Toden wartete die Show nur auf den
   letzten. Und `skipToEnd()` feuerte alle übersprungenen Callbacks synchron nach: Beim
   Überspringen wären bis zu sieben Todesanimationen gleichzeitig gebaut worden.

5. **Das LOCK-Schild hing an einer Wanduhr** (`setTimeout` auf den ersten Lock) und driftete
   beim Tab-Wechsel gegen die Show.

6. **Der Lobby-Helfer machte aus zwei Spielern drei.** Der Lobby-Screen legt seine
   Startspieler in `activate()` an, also erst **nach** dem Wipe. Wer vorher die Zeilen
   zählt, sieht null, klickt „Spieler hinzufügen" — und bekommt die Startspieler oben
   drauf. Lokal fiel das nie auf; auf dem CI-Runner schlugen dadurch genau die vier Tests
   mit zwei Spielern fehl, und zwar konsistent über alle drei Wiederholungsversuche.
   Gefunden hat es der Seiten-Schnappschuss im Playwright-Report: „Spieler 3 von 3" in
   einem Test mit zweien. Der Helfer wartet jetzt auf die erste Zeile und sichert am Ende
   die Spielerzahl zu — ein Fehler fliegt damit in der Lobby auf statt drei Screens
   später.

Dazu zwei Fehler in meinen eigenen neuen Tests, die etwas Echtes gezeigt haben:
Montage-Segmente unter 2,2 s erzeugten Beats von **einer Millisekunde** — Tod, Lock und ein
sichtbarer Wechsel passen darunter nicht. Und die erste Fassung des Überlebenden-Tests
mass einen Scheineffekt: Der Gewinner ist in jedem Segment dabei, die anderen fallen weg,
also haben späte Segmente zwangsläufig höhere Anteile. Verglichen wird jetzt innerhalb des
Segments.

### Zahlen

| | |
|---|---|
| Unit-Tests | 421 (vorher 366) |
| Neue Testdateien | `showDirector` (9), `choreographerCascade` (17), `readyScreen` (11), `choreographerSnapshot` (1) |
| Referenz-Hash der bestehenden Modi | unverändert über 10 500 Skripte |
| JS gzip | 251 KB (Budget 450), Einstieg 23 KB, Arena weiterhin lazy |
| Kontrast | 26 Paare, schlechtestes 4,58:1 |
| CI | grün — 421 Unit, 45 E2E (iPhone 12 = WebKit und Pixel 5), 3 Perf |

**Zur Aussagekraft der lokalen Läufe:** Auf dieser Maschine lag während der Arbeit eine
Grundlast von 5–6 (mehrere andere Projekte). In jedem vollen E2E-Lauf fiel deshalb ein
*anderer* Test durch, während jeder einzeln grün war — dasselbe Muster wie in M4. Der
belastbare Beleg ist die CI auf einem freien Runner; und sie hat unter dem Lastrauschen
einen echten Fehler sichtbar gemacht (Nr. 6), den lokal nie einer gezeigt hätte.

**Manuelle Checks, die Luka bestätigen muss:**
- [ ] **Trägt die Kaskade?** Auftakt → Montage → Finale. Oder ist die Mitte zäh?
      `Einstellungen → Modus → Showdown`, am besten mit 5–6 Personen.
- [ ] **Die Länge.** 6 Spieler auf „Normal" sind 34 s. Am Tisch in Ordnung, oder soll
      „Kurz" der Standard für diesen Modus werden?
- [ ] **Der Start-Screen.** Reicht „Legt das Handy in die Mitte", oder braucht es mehr?
- [ ] **Die Balance.** Du hast die Zahlen gesehen und dich für Konsistenz entschieden.
      Wenn im Playtest alle nur noch 1 setzen, steht die Pot-Variante in ADR-51 und ist
      eine kleine Änderung.

---

## Intro-Inszenierung — der Schütze, die Reihe, der Warnschuss (2026-09-04)

Die Arena begann bisher damit, dass die Männchen einfach schon liefen. Das Intro war
anderthalb Sekunden leere Zeit: ein Sound, ein Tempo, ein Fadenkreuz-Sprung — sonst nichts.

Jetzt sieht man in der **ersten Runde einer Session** den Schützen von vorne, die Kamera
fährt in sein Zielfernrohr, die Blende öffnet sich. Und in **jeder** Runde stehen die
Männchen zuerst aufgereiht, bis ein Warnschuss vor ihren Füßen einschlägt und sie
auseinanderstieben.

### Die Regel, um die es ging

Der naheliegende Weg — Shotling mit Gewehr, Lauf im Vordergrund der Ego-Sicht — verstößt
gegen zwei ausdrückliche MUSS-Sätze:

> „Nie brutal, nie realistisch. … **Kein Blut, kein Gewehr sichtbar.**"
> — Art Direction §1
>
> „Keine echten Waffen-Darstellungen (**kein Gewehr-Modell sichtbar**, nur Scope-Overlay
> + Flash)." — GDD §9, unter den **Nicht-Zielen**, neben „kein Backend" und „keine Ads"

Das ist eine bewusste Produktentscheidung, keine Nachlässigkeit — und ein sichtbares
Gewehr, das in Ego-Sicht auf Figuren zielt, wird bei Alterseinstufungen anders bewertet
als ein abstraktes Fadenkreuz. Luka hat sich dagegen entschieden, sie zu ändern.

Der Schütze steht deshalb **hinter der Linse**: Was auf den Betrachter zeigt, ist das
Objektiv, zwei Stummelarme greifen den Ring von der Seite, darüber ein Chibi-Kopf mit
Helm. Kein Schaft, kein Lauf, kein Zylinder darunter.

Das ist nicht der Kompromiss, für den es sich anhört, sondern der stärkere Übergang: Man
fährt **in sein Objektiv hinein** und wird der Schütze, statt nur seine Waffe zu sehen.
Alle fünf Teile des Wunsches bleiben erhalten (ADR-52).

### Ohne ein einziges neues Asset

| Gebraucht | Woher |
|---|---|
| Der Schütze | Vier Sprites des schon geladenen Atlas, von Hand zusammengesetzt. **Kein `Shotling`** — der bräuchte eine Spielerfarbe (es gibt keine dunkle), ein `ShotlingBrain`, und trüge ein Farbsymbol auf der Brust, an das der Rig gar keinen Zugriff gibt |
| Die Linse | `Graphics`. Als Sprite hätte sie `props@2x` von 2048×1024 auf 2048×2048 aufgebläht — und ein um 2,7 herangezoomtes Sprite wird weich |
| Die Blende | Eine schrumpfende Scheibe |
| Der Warnschuss | `dirtFountain` und `runDust` aus `fx/MuzzleFlash.ts` — `runDust` war seit M2 definiert und **wurde nie aufgerufen** |

### Die Blende, umgedreht

`CHOREO.introIrisMs = 900` stand seit M3 im Code und wurde von niemandem gelesen — den
Iris-Wipe gab es nie, obwohl der Kommentar im Choreographer ihn versprach.

Ihn als **wachsendes Loch** zu bauen (`cut()` oder even-odd) ginge nur, indem man jeden
Frame `clear()` aufruft und die Geometrie neu tesselliert: Allokation im Loop, gegen
Architektur §7.11 und den Heap-Test. Umgedreht ist es trivial — außerhalb des
Sichtfensters ist der Scope ohnehin deckend, freizugeben ist nur die Linsenfläche. Eine
gefüllte Scheibe schrumpft auf null, der Hintergrund blendet aus. Nur `scale` und `alpha`,
keine Geometrie im Frame (ADR-54).

### Die Reihe — nachgerechnet, nicht geschätzt

Eine gerade Reihe passt bis sechs Spieler. Bei sieben bräuchte sie 688 Welteinheiten
Spannweite; die Laufzone hat 702 Durchmesser, und der Requisiten-Ring beginnt bei 387.
Ein Bogen rettet das nicht — damit er noch als Reihe liest (höchstens 75° Öffnung),
bräuchte er Radius 589 statt 351.

Ab sieben wird daraus deshalb ein **Klassenfoto aus zwei versetzten Reihen**. Die hinteren
Köpfe stehen dabei mit drei Einheiten Luft über den vorderen — nachgerechnet und als Test
festgehalten.

Der Warnschuss geht **vor** die Füße des Äußersten, nicht seitlich neben die Reihe: Dort
läge er bei sechs Spielern auf Radius 393, also mitten zwischen den Fässern.

| Spieler | Reihen | größter Radius | Warnschuss |
|---|---|---|---|
| 2 | 1 | 78 | r = 176 |
| 6 | 1 | 300 | r = 330 |
| 8 | 2 | 197 | r = 279 |

### Zwei Fehler, die schon vorher drin waren

1. **`failGracefully` ließ den alten Ticker weiterlaufen.** Der zweite Anlauf nach einem
   Ladefehler ruft `build()` erneut und überschrieb dabei `tickerFn` — die alte Funktion
   blieb für immer im PIXI-Ticker, **zwei Simulationen liefen parallel** über dieselben
   Männchen, und die Timelines des ersten Aufbaus liefen weiter, obwohl ihre Sprites
   längst aus der Welt entfernt waren.
2. **Der `visibilitychange`-Handler wurde zu spät registriert** — erst nach dem Aufbau des
   Directors. Alles davor lief bei einem Tab-Wechsel ungebremst weiter, samt Ton.

### Und einer, den ich selbst gemacht habe

Ich hatte den Schützen mit `ink` getönt, damit er als Silhouette liest. Auf der fast
schwarzen Scope-Vignette ergab das 1,11:1 — er war schlicht unsichtbar, und ich hielt den
schwarzen Bildschirm zuerst für einen Fehler in der Blende. Jetzt gedämpftes Oliv
(3,56:1). Dazu blieb der Scope während der Frontalansicht sichtbar, sein Fadenkreuz lag
also über dem Gesicht des Schützen.

### Zahlen

| | |
|---|---|
| Unit-Tests | 436 (vorher 421) — neu: `introLineup` (11), `frozen` (4) |
| Gemessen (E2E) | Runde 1: 16,5 s bis zum Schuss · Runde 2: 10,9 s |
| Neue Assets | **keine** |
| Übersprungen in | `?hold=1` und `?panel=deaths` — sonst brächen Draw-Call- und Filter-Test |

**Manuelle Checks, die Luka bestätigen muss:**
- [ ] **Trägt der Auftakt?** Drei Sekunden Schütze sind lang — zu lang, oder richtig?
- [ ] **Liest sich die Linse als Fernrohr,** oder sieht es aus, als fehle etwas?
- [ ] **Der Warnschuss:** Erschrickt man? Stieben sie überzeugend auseinander?
- [ ] **Acht Spieler:** Die Aufstellung ist dann ein Klassenfoto aus zwei Reihen. Wirkt
      das gewollt? (Geometrie ist getestet, das Aussehen nicht.)
- [ ] **Mit „Bewegung reduzieren"** läuft nur der Kurzteil, ohne Kamerawackler.

---

## Vier gemeldete Fehler (2026-09-04)

Luka hat nach dem Deploy vier Dinge gemeldet. Zwei davon waren keine Politur, sondern
Defekte mit falscher Dokumentation — die Doku behauptete, das Problem sei gelöst.

### 1 · „Der Scharfschütze ist nicht immer zu Beginn zu sehen"

Drei unabhängige Ursachen, nicht eine:

| Ursache | Was wirklich passierte |
|---|---|
| `roundNumber > 0` | Gemeint war „erste Runde einer Session", umgesetzt war „erste Runde **pro Seitenladung**". `resetRound()` fasste den Zähler nie an, kein `begin`, kein `cancel`, kein `changePlayers`. Eine komplett neue Partie mit neuen Spielern zeigte den Schützen nicht mehr — nur ein Reload brachte ihn zurück. |
| `prefers-reduced-motion` | Strich den Auftakt **ersatzlos**. Auf mehreren Android-Skins schaltet der Akkusparmodus diese Einstellung mit um: Der Abend konnte mit Schütze anfangen und ohne weitergehen. |
| `armIntroSkip` ohne Karenzzeit | Der Handler lag auf `pointerdown` über dem **ganzen** Bildschirm und war ~170–300 ms nach „Los!" scharf — noch während des Wipes, der `pointer-events: none` hat und also nichts abschirmt. Der READY-Screen fordert unmittelbar davor auf, das Handy hinzulegen. Wer das tat, streifte den Schirm und war um fünf Sekunden Inszenierung gebracht. |

Der Auftakt läuft jetzt in **jeder** Runde. Bei reduzierter Bewegung bleibt der Schütze
sichtbar, die Kamerafahrt wird zum Schnitt, das Wackeln entfällt — genau das, was der
Kommentar an `reducedMotion` seit dem ersten Tag versprach, aber nie einlöste. Der Skip
ist 700 ms taub, wie PASS (800 ms) und READY (400 ms) es seit je sind.

Zwei Nebenbefunde aus derselben Ecke: Im Kurzmodus spielte **niemand** den
`scope_open`-Cue — weder die `IntroSequence` (der Aufruf steckt im `full`-Zweig) noch der
Director (`playIntroCue` war auf `'none'` gesetzt). Und `intro.pause()/resume()` waren
toter Code; der Tab-Wechsel hielt nur den Director an. Der Kurzmodus selbst ist entfallen,
er war unerreichbar geworden.

### 2 · „Im Sudden Death nur einmal den Einsatz eingeben"

Sudden Death lief wie Klassik: vor jeder Runde wanderte das Handy erneut durch die Gruppe,
obwohl das Feld schrumpfte. Bei fünf Spielern sind das vier Setzphasen für vier Schüsse.

Jetzt wird einmal gesetzt, danach führt „Weiter" vom Ergebnis direkt auf den Start-Screen,
bis einer steht. Träger ist `MODE_SPECS[...].eliminates` — **das Flag existierte seit M1
und wurde von niemandem gelesen.**

Die Bedingung beendet sich von selbst: Ist das Turnier entschieden, treten wieder alle an
(siehe 4), für die meisten gibt es keinen Einsatz mehr, und es geht in eine frische
Setzphase. Kein neues Event, kein Turnier-Zustand in der FSM.

`RoundSetup.potSips` hält die Summe **aller** ursprünglichen Einsätze fest, während `bets`
mit dem Feld schrumpft. Ohne das verteilte der Letzte nur noch den Einsatz der beiden
Finalisten. Auf dem Start-Screen steht im Turnier nur die Anzahl der Verbliebenen, **nie
der Topf**: Bei zwei Verbliebenen liesse sich daraus der Einsatz des anderen ausrechnen
(Audit A1, MUSS).

### 3 · „Manchmal kommt man nicht mehr auf den Home-Bildschirm"

Das „manchmal" war zu freundlich. **Es gab in der ganzen App keinen einzigen Übergang
zurück nach `TITLE`** — kein Event der FSM hatte den Titel als Ziel. Wer einmal „Spielen"
gedrückt hatte, erreichte ihn bis zum Neuladen der Seite nicht mehr, und damit auch die
Einstellungen nicht, die nur von dort aus zu öffnen sind. Dass es sich „manchmal" anfühlte,
lag daran, dass ein App-Neustart wieder am Titel landet.

Verschärfend:

- **Die Lobby war der Trichter.** Alle Abbruchpfade endeten dort, und `ALLOWED.LOBBY`
  kannte genau ein Event: `begin`. Kein Rückweg, kein Header-Knopf.
- **Die History-Einträge leckten.** `updateHistoryGuard` löschte beim Verlassen nur ein
  Boolean, der gepushte Eintrag blieb im Stack — und jedes „Weiterspielen" legte einen
  weiteren obendrauf. In der Lobby verpuffte der erste Zurück-Druck dann sichtbar
  folgenlos. Das dürfte der Auslöser des Befunds gewesen sein.
- **Die Arena hatte gar keinen Knopf,** und in der installierten PWA
  (`display: standalone`) gibt es keinen Browser-Zurück-Knopf. Dort war sie unverlassbar.

Dazu zwei stille Hänger, die niemand gemeldet hatte, weil sie nach nichts aussehen:

- Endete die Show, während der Abbruch-Dialog offen stand, lief `cancel` im State `RESULT`.
  Dort ist es nicht erlaubt, `send` gab **still** `false` zurück: Man tippte „Ja,
  abbrechen" und nichts passierte.
- `void build()` im ArenaScreen hatte **kein `.catch()`**. Eine Ausnahme ausserhalb der
  beiden inneren `try`-Blöcke ließ den Screen mit `is-loading` (Deckkraft 0) stehen —
  schwarz, ohne Knopf, ohne Notausgang-Timer, auch der Retry-Pfad lief dort hinein.

Jetzt: ein `quit`-Event nach `TITLE` aus jedem State ausser TITLE; sichtbare Knöpfe in
Lobby und Ergebnis; ein zurückhaltendes ✕ in Pass, Bet, Ready und Arena, das den
bestehenden Abbruch-Dialog öffnet. In der Arena erscheint es erst, wenn die Show startet.
Der Guard hält ausserhalb des Titels genau **einen** Eintrag.

Ein Nebeneffekt: Der Privacy-Screen trug bisher selbst `role="button"`. Mit einem Knopf
darin wäre das ein verschachteltes Bedienelement (axe: `nested-interactive`), deshalb ist
die Tap-Fläche jetzt ein echter, flächendeckender Button unter dem Inhalt.

### 4 · „Spieler werden noch als ausgeschieden angezeigt"

`session.resetRounds()` existierte, war getestet — und wurde **im gesamten Produktivcode
nie aufgerufen**. `docs/DECISIONS.md` (ADR-11) behauptete schwarz auf weiß, die Funktion
hebe das Ausscheiden „automatisch" auf. Sie hob nichts auf.

`eliminatedPlayerIds` sammelte über die ganze Runden-History, ohne `round.mode` oder
`round.winnerId` anzusehen. Folgen:

- Ausgeschiedene blieben es über Runden, Moduswechsel und Reloads hinweg.
- Bei einem Verbliebenen war „Nächste Runde" ausgegraut **und** in der Lobby der Start
  ebenfalls — der einzige Ausweg war „Session zurücksetzen", das Spieler, Namen, Farben
  und das Scoreboard mitnahm. Ein Unit-Test hielt diese Sackgasse sogar als Soll-Verhalten
  fest.
- Die Truncation bei `MAX_ROUND_HISTORY = 50` holte nach 50 Runden stillschweigend
  Ausgeschiedene zurück.

Jetzt zieht `eliminatedPlayerIds` zwei Grenzen: rückwärts bis zur letzten entschiedenen
Runde (`winnerId`) oder bis zu einer Runde eines Modus ohne Ausscheiden, und davor
`session.tournamentFrom` — ein Zeitstempel, den jedes „Los geht's!" neu setzt. Ein
Zeitstempel statt eines Index, weil die History vorne abgeschnitten wird.

Das Scoreboard des Abends bleibt in beiden Fällen stehen. `resetRounds()` hätte es
mitgelöscht und ist ersatzlos entfallen; ADR-11 ist korrigiert.

Beim Verkabeln fiel noch eine Reihenfolge auf: Die Lobby zählte `activePlayers()`, **bevor**
die Grenze neu gezogen wurde — eine neue Partie wäre mit halbem Feld gestartet, während
die Ausgeschiedenen im selben Moment wieder aktiv wurden.

### Was sonst noch dabei repariert wurde

- `loadSession` validierte die Runden nicht. Ein Eintrag ohne `eliminatedIds` warf beim
  Rendern der Lobby — die App startete dann bis zum Löschen des Speichers nicht mehr.
  `sanitizeRounds` füllt jetzt auf und wirft Runden mit unbekanntem Modus weg.
- Das HUD zeigte nach einem Reload wieder „RUNDE 1", obwohl `session.rounds` fünf Runden
  kannte. `begin` setzt den Zähler jetzt zurück, statt ihn nie anzufassen.
- `PREVIEW_PORT` für Playwright. Läuft daneben die Vite-Vorschau eines anderen Projekts
  auf 4173, übernahm `reuseExistingServer` bisher stillschweigend deren Server, und der
  Lauf brach mit einem nichtssagenden Timeout ab.

### Zahlen

| | |
|---|---|
| Unit-Tests | 451 (vorher 436) |
| E2E | 75 grün auf iPhone 12 (WebKit) und Pixel 5 (Chromium), 5 übersprungen |
| Perf | Draw-Calls 5 · p50 16,7 ms · p95 18,5 ms · Heap +540 KB über 30 s |
| Gemessen (E2E) | Runde 1: 16,4 s · Runde 2: 15,9 s bis zum Schuss — der Auftakt ist jetzt in beiden drin |
| Neue ADRs | 56 (Turnier-Einsatz) · 57 (Turniergrenze) · 58 (Heimweg) · 59 (Auftakt immer) |
| Korrigiert | ADR-11 — die Begründung war falsch |
| Entfallen | `SessionStore.resetRounds()`, `IntroMode`/`'short'` |
| Kosten | ~5 s Auftakt pro Runde statt nur in der ersten |

**Manuelle Checks, die Luka bestätigen muss:**
- [ ] **Stört der Auftakt ab Runde 2?** Fünf Sekunden pro Runde sind bei einem schnellen
      Abend spürbar. Wenn es zu viel wird, ist die Kurzfassung ab Runde 3 die naheliegende
      Stellschraube — der Code dafür ist eine Zeile.
- [ ] **Das ✕ in der Arena** — zurückhaltend genug, oder zieht es Blicke von der Show ab?
- [ ] **Sudden Death über vier Runden ohne Nachsetzen:** Trägt das die Spannung, oder
      fehlt zwischendrin der Einsatz-Moment?
- [ ] **Mit „Bewegung reduzieren"** im System: Schütze sichtbar, Schnitt statt Fahrt, kein
      Wackeln beim Warnschuss.

---

## Sudden Death: Einsätze bleiben geheim (2026-09-05)

Zwei Nachbesserungen an dem Turnier von gestern.

**Die Einsätze bleiben geheim, bis einer übrig ist.** Bisher deckte der Result-Screen nach
jeder Runde alles auf — ab Runde 2 wusste damit jeder, was die Verbliebenen gesetzt hatten,
und das Setzen war für den Rest des Turniers entwertet. Jetzt wird nur aufgedeckt, wen es
getroffen hat.

Zwei Dinge daran waren nicht offensichtlich:

- **Die Chancen-Spalte musste mit weg** — auch bei den Aufgedeckten. Die Chance ist
  `eigener Einsatz / Summe aller Einsätze`. Wer sie neben dem Einsatz sieht, rechnet die
  Summe aus; bei zwei Verbliebenen ergibt „Einsatz 4 · Chance 40 %" exakt die 6 des
  anderen. Ohne das wäre die Geheimhaltung eine Attrappe gewesen.
- **Die Tabelle liest den ganzen Turnier-Block, nicht die laufende Runde.** `bets` schrumpft
  mit dem Teilnehmerfeld — die in Runde 1 Gefallenen stehen ab Runde 2 gar nicht mehr drin
  und wären aus der Tabelle verschwunden statt aufgedeckt zu bleiben.

Die verdeckten Zeilen stehen unter den aufgedeckten und in Beitrittsreihenfolge, nie
mitsortiert: Allein ihre Position in einer nach Einsatz sortierten Liste verriete sonst,
wo ihr Einsatz ungefähr liegt.

**Der Letzte verteilt nur seinen eigenen Einsatz.** Vorher die Summe aller — bei fünf
Spielern schnell zwanzig Schlücke auf einmal. Damit entfällt `RoundSetup.potSips` samt
seiner Verkabelung durch FSM und Ziehung wieder; das ist die Rücknahme des Topf-Teils von
ADR-56, festgehalten in ADR-60.

Der Reveal-Moment aus GDD §3.7 ist damit nicht verloren, sondern aufgespart: Mit der
Entscheidung des Turniers liegt alles offen.

| | |
|---|---|
| Unit-Tests | 456 (vorher 451) — fünf neue für `stakeReveal` |
| Neue ADRs | 60 · nimmt den Topf-Teil von ADR-56 zurück |
| Entfallen | `RoundSetup.potSips` und `FsmContext.potSips` |
