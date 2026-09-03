# 🎯 Drinkshot

Ein Mobile-First Pass-the-Phone-Trinkspiel für 2–8 Personen. Jeder setzt heimlich Schlücke, dann laufen kleine Cartoon-Männchen um ihr Leben, während ein Scharfschütze durchs Zielfernrohr zielt. Wer getroffen wird, trinkt — je mehr du setzt, desto wahrscheinlicher trifft es dich.

**Status:** M0 (Setup & Skelett) abgeschlossen → nächster Meilenstein ist M1 (UI-Flow). Fortschritt in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Loslegen

```bash
npm install
npm run dev        # Vite mit --host: die "Network"-URL im Terminal aufs Handy tippen
```

Handy und Rechner müssen im selben WLAN sein. Die App läuft unter `/Drinkshot/` (GitHub-Pages-Base).

## Befehle

| Befehl                   | Was es tut                                               |
| ------------------------ | -------------------------------------------------------- |
| `npm run dev`            | Dev-Server mit `--host` (Handy im WLAN)                  |
| `npm run build`          | Typecheck + Produktions-Build nach `dist/`               |
| `npm run preview`        | Produktions-Build lokal servieren (Port 4173)            |
| `npm run typecheck`      | `tsc --noEmit`                                           |
| `npm run lint`           | ESLint über das ganze Repo                               |
| `npm run format`         | Prettier schreibt alles glatt                            |
| `npm test`               | Typecheck + Lint + Unit-Tests (das Standing Audit)       |
| `npm run test:unit`      | Vitest einmalig                                          |
| `npm run test:coverage`  | Vitest mit Coverage (`fsm.ts` muss 100 % Branches haben) |
| `npm run test:e2e`       | Playwright-Flow, iPhone 12 + Pixel 5                     |
| `npm run test:perf`      | Playwright-Perf-Test (ab M3 aktiv)                       |
| `npm run build:atlas`    | SVG → PNG-Atlanten (ab M2)                               |
| `npm run build:audio`    | Audio-Sprite bauen (ab M3)                               |
| `npm run preview:deaths` | App direkt in der Death-Preview öffnen (ab M4)           |

## Stack

Vite 6 · TypeScript (strict) · PixiJS v8 · GSAP 3 · howler.js · vite-plugin-pwa · Vitest · Playwright

## Planung

| Dokument                                               | Inhalt                                                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| [`CLAUDE.md`](CLAUDE.md)                               | Arbeitsanweisungen für Claude Code                                                            |
| [`docs/01-GDD.md`](docs/01-GDD.md)                     | Game Design Document — Regeln, Wahrscheinlichkeit, Dramaturgie, 12 Todesanimationen           |
| [`docs/02-ART-DIRECTION.md`](docs/02-ART-DIRECTION.md) | Art Direction & Design-System — Stil, Tokens, Charakter-Rig, Scope-Overlay                    |
| [`docs/03-ARCHITECTURE.md`](docs/03-ARCHITECTURE.md)   | Technische Architektur — Stack, Ordnerstruktur, State Machine, Interfaces, Performance-Regeln |
| [`docs/04-ROADMAP.md`](docs/04-ROADMAP.md)             | Roadmap — Meilensteine M0–M6 mit Schritten & Definition of Done                               |
| [`docs/05-AUDITS.md`](docs/05-AUDITS.md)               | Audit-Checklisten pro Meilenstein                                                             |
| [`docs/PROGRESS.md`](docs/PROGRESS.md)                 | Fortschritt & Audit-Reports                                                                   |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)               | Architektur-Entscheidungen (ADR-Log)                                                          |

## Struktur (Kurzfassung)

```
src/config/   theme.ts · rules.ts · choreo.ts     — alle Tokens, Regeln, Timings
src/core/     store · fsm · rng · lottery · choreographer · session · i18n
src/ui/       router · components · screens        — DOM-Menüs
src/game/     ArenaApp · Arena · Shotling · Scope · ShowDirector · fx · deaths
src/audio/    AudioManager · sprite.json
src/i18n/     de.json · en.json
assets-src/   SVG-Quellen (nicht im Bundle) → scripts/build-atlas.mjs → public/atlas/
tests/        unit (Vitest) · e2e (Playwright, Mobile-Emulation)
```

## Zwei Regeln, die nicht verhandelbar sind

1. **Fairness.** Die Ziehung des Opfers passiert ausschließlich in `src/core/lottery.ts` über `crypto.getRandomValues`, genau einmal beim Übergang BET→ARENA. Die Show inszeniert nur, sie entscheidet nichts. `Math.random` ist in `src/core/` per ESLint verboten und wird zusätzlich von einem Unit-Test bewacht.
2. **Performance.** Ein PIXI-App-Singleton, Atlanten, Object-Pools, keine Allokationen im Frame-Loop, Filter nur temporär, eine Uhr (PIXI-Ticker treibt GSAP). Details in `docs/03-ARCHITECTURE.md §7`.

## Deploy

Push auf `main` → GitHub Actions (`.github/workflows/deploy.yml`) → GitHub Pages unter `/Drinkshot/`.
Alternativ liegt eine `netlify.toml` bei (baut mit `DRINKSHOT_BASE=/`).

## Lizenz

Code: MIT (folgt mit v1.0). Schriften in `public/fonts/` stehen unter der SIL Open Font License 1.1 — siehe `public/fonts/LICENSE.txt`.
