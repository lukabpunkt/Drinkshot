# Fortschritt

| Meilenstein | Status | Tag | Audit |
|---|---|---|---|
| M0 Setup & Skelett | ✅ fertig (⏳ 4 manuelle Checks offen) | `v0.0.1` | A0 bestanden |
| M1 UI-Flow | ✅ fertig (⏳ 2 manuelle Checks offen) | `v0.1.0` | A1 bestanden |
| M2 Shotlings & Arena | ⬜ offen | – | – |
| M3 Scope, Choreo, Schuss | ⬜ offen | – | – |
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
