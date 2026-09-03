# CLAUDE.md — Arbeitsanweisungen für Claude Code

Du entwickelst **Drinkshot**, ein Mobile-First Pass-the-Phone-Trinkspiel als Web-App (Vite + TypeScript + PixiJS v8 + GSAP). Die vollständige Planung liegt in `docs/`. **Lies vor jeder Aufgabe:**

1. `docs/01-GDD.md` — Spielregeln, Wahrscheinlichkeit, Dramaturgie, Todesanimationen (Wahrheit für Verhalten)
2. `docs/02-ART-DIRECTION.md` — Look, Tokens, Rig, Animationsprinzipien (Wahrheit für Aussehen)
3. `docs/03-ARCHITECTURE.md` — Stack, Ordnerstruktur, FSM, Interfaces, Performance-Regeln (Wahrheit für Code)
4. `docs/04-ROADMAP.md` — Meilensteine M0–M6 mit Schritten und Definition of Done
5. `docs/05-AUDITS.md` — Audit-Checklisten pro Meilenstein
6. `docs/PROGRESS.md` — aktueller Stand (du pflegst diese Datei)

## Arbeitsregeln

- **Ein Meilenstein pro Auftrag.** Arbeite die Schritte der Reihe nach ab, halte die Definition of Done ein, führe dann das zugehörige Audit aus und schreibe den Report nach `docs/PROGRESS.md` (Vorlage am Ende von `05-AUDITS.md`). Manuelle Checks als "⏳ manuell" markieren und Luka am Ende explizit auflisten.
- **Design-Prioritäten:** 1. Spannung, 2. Comedy, 3. Zero Friction, 4. Performance. Bei Zielkonflikten in dieser Reihenfolge entscheiden.
- **Mobile First.** Jede UI-Entscheidung zuerst für 390 × 844 (iPhone) denken; Desktop bekommt den Portrait-Frame (Architektur §8).
- **Performance ist nicht verhandelbar.** Regeln in Architektur §7 sind Pflicht: ein PIXI-App-Singleton, Atlanten, Pools, keine Allokationen im Loop, Filter nur temporär, eine Uhr (PIXI-Ticker treibt GSAP).
- **Fairness ist nicht verhandelbar.** Ziehung des Opfers ausschließlich in `core/lottery.ts` mit `crypto.getRandomValues`, genau einmal beim Übergang BET→ARENA. Die Show (`choreographer.ts`) inszeniert nur, sie entscheidet nichts. `Math.random` ist in `src/core/` verboten.
- **Alle Texte über i18n** (`src/i18n/de.json`, `en.json`). Kein hardcodierter UI-String.
- **Alle Farben/Timings über Tokens** (`src/config/theme.ts`, `styles/tokens.css`, `config/choreo.ts`). Keine Magic-Numbers in Komponenten.
- **Todesanimationen** implementieren immer das `DeathSequence`-Interface (Architektur §6), bekommen einen Unit-Test und einen Dev-Preview-Eintrag. Alle 7 Animationsprinzipien aus Art Direction §5.2 sind Pflicht (Anticipation, Squash & Stretch, Overshoot, Hit-Stop, Follow-Through, Lesbarkeit, Sound-Sync).
- **Assets:** Charaktere/Props als SVG in `assets-src/svg/` zeichnen (Rig-Spec Art Direction §5.1), Atlas per `npm run build:atlas`. Lieber simpel und sauber als detailliert und wackelig. Dicke Outlines, Chibi, Cel-Shading.
- **Kein Backend, keine Analytics, keine externen Requests** zur Laufzeit (außer Service-Worker-Update).
- **Abweichungen vom Plan** sind erlaubt, wenn sie begründet sind: 5-Zeilen-ADR in `docs/DECISIONS.md` (Kontext · Entscheidung · Konsequenz). Das GDD/die Architektur dann entsprechend anpassen — Docs und Code dürfen nicht auseinanderlaufen.
- **Commits:** Conventional Commits (`feat(arena): …`, `fix(scope): …`, `docs: …`), klein und häufig. Nach jedem abgeschlossenen Meilenstein Git-Tag laut Roadmap.
- **Tests:** Unit (Vitest) für `core/`, `choreographer`, `deaths/`; E2E (Playwright, Mobile-Emulation) für den Flow; `perf.spec.ts` für Frame-Zeiten. CI muss grün bleiben.
- **Fragen:** Wenn etwas im Plan fehlt oder widersprüchlich ist, triff die Entscheidung, die den Design-Prioritäten am besten dient, dokumentiere sie in `DECISIONS.md` und mache weiter — nicht blockieren.

## Befehle (nach M0 verfügbar)

```
npm run dev            # Vite Dev-Server mit --host (Handy im WLAN)
npm run build          # Produktions-Build nach dist/
npm run preview        # Build lokal testen
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run test:unit      # vitest
npm run test:e2e       # playwright
npm run test:perf      # playwright perf.spec.ts
npm run build:atlas    # SVG → PNG-Atlanten
npm run build:audio    # Audio-Sprite
npm run preview:deaths # App in der Death-Preview öffnen (?dev=1)
```

## Referenzgeräte

- Primär: iPhone 11/12 (Safari), Pixel 4a/5 (Chrome). Ziel 60 fps, Minimum 30 fps (Low-Effects).
- Sekundär: iPad, Desktop Chrome/Firefox/Safari.

## Projekt-Infos

- Repo: https://github.com/lukabpunkt/Drinkshot.git
- Deploy: GitHub Pages (Vite `base: '/Drinkshot/'`), Workflow `.github/workflows/deploy.yml`
- Sprache der Docs: Deutsch. Code, Bezeichner, Commits: Englisch.
