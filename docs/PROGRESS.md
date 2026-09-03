# Fortschritt

| Meilenstein | Status | Tag | Audit |
|---|---|---|---|
| M0 Setup & Skelett | ✅ fertig (⏳ 4 manuelle Checks offen) | `v0.0.1` | A0 bestanden |
| M1 UI-Flow | ✅ fertig (⏳ 2 manuelle Checks offen) | `v0.1.0` | A1 bestanden |
| M2 Shotlings & Arena | ✅ fertig (⏳ 2 manuelle Checks offen) | `v0.2.0` | A2 bestanden |
| M3 Scope, Choreo, Schuss | ✅ fertig (⏳ 3 manuelle Checks offen) | `v0.3.0` | A3 bestanden |
| M4 Todesanimationen | ⬜ offen | – | – |
| M5 Polish, Modi, A11y | ⬜ offen | – | – |
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
