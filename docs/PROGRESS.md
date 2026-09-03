# Fortschritt

| Meilenstein | Status | Tag | Audit |
|---|---|---|---|
| M0 Setup & Skelett | ✅ fertig (⏳ 4 manuelle Checks offen) | `v0.0.1` | A0 bestanden |
| M1 UI-Flow | ⬜ offen | – | – |
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
| CI läuft grün auf GitHub | ⏳ manuell | `ci.yml` (Typecheck · Lint ≤ 5 Warnings · Coverage · Build · Bundle-Report · E2E) und `deploy.yml` (Pages) liegen bereit. Lokal laufen alle Schritte grün; der Actions-Lauf braucht einen Push zum Remote. |
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
- [ ] Repo pushen (`git remote add origin https://github.com/lukabpunkt/Drinkshot.git && git push -u origin main --tags`), dann im Actions-Tab prüfen, dass `ci.yml` grün ist, und in den Repo-Settings **Pages → Source: GitHub Actions** setzen, damit `deploy.yml` durchläuft.

**Optional, wenn du magst:** Die App über den Preview-Build zum Homescreen hinzufügen und den Flugmodus einschalten — sie startet offline (lokal verifiziert, auf echtem Gerät noch nicht).
