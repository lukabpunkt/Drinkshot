# DRINKSHOT — Audits

> Jeder Meilenstein endet mit einem Audit. Claude Code führt die **automatischen** Teile selbst aus und schreibt das Ergebnis mit Datum nach `docs/PROGRESS.md` (Tabelle: Check · Status · Notiz). Die **manuellen** Teile (Handy-Test, Playtest) macht Luka; Claude Code bereitet Checklisten vor und fragt aktiv nach dem Ergebnis, bevor es weitergeht.
>
> **Regel:** Ein Audit gilt als bestanden, wenn alle "MUSS"-Checks grün sind. "SOLL"-Checks dürfen als Follow-up-Issue offen bleiben (max. 3 pro Meilenstein).

---

## Standing Audit (bei JEDEM Commit — via CI)

| Check                                                                             | Typ  |
| --------------------------------------------------------------------------------- | ---- |
| `npm run typecheck` ohne Fehler                                                   | MUSS |
| `npm run lint` ohne Fehler (Warnings ≤ 5)                                         | MUSS |
| `npm run test:unit` grün                                                          | MUSS |
| Keine `console.error` im Dev-Flow (E2E prüft)                                     | MUSS |
| Kein hardcodierter UI-Text (Lint-Regel/Grep auf Umlaute in `.ts`)                 | SOLL |
| Bundle-Größe gemeldet (Vite `--report`), Delta ≤ +10 % pro Commit ohne Begründung | SOLL |

---

## A0 — Setup-Audit

| Check                                                                 | Typ  | Wie prüfen                                   |
| --------------------------------------------------------------------- | ---- | -------------------------------------------- |
| Projektstruktur entspricht `03-ARCHITECTURE.md §2`                    | MUSS | `tree -L 3` vergleichen                      |
| `theme.ts`/`rules.ts`/`choreo.ts` enthalten die GDD-Werte             | MUSS | Review                                       |
| Lottery-Test: 100 000 Ziehungen, Abweichung < 1 %                     | MUSS | `vitest run lottery`                         |
| RNG nutzt `crypto.getRandomValues`, nie `Math.random` für die Ziehung | MUSS | Grep `Math.random` in `core/` → 0 Treffer    |
| FSM-Übergänge vollständig getestet (jeder Pfeil im Diagramm)          | MUSS | Test-Coverage `fsm.ts` = 100 % Branches      |
| App auf Handy im WLAN erreichbar (`--host`), Titel sichtbar           | MUSS | manuell (Luka)                               |
| PWA installierbar (Lighthouse "Installable")                          | MUSS | `npx lighthouse --preset=desktop` / DevTools |
| Desktop zeigt Portrait-Frame, Mobile Landscape zeigt "Drehen"-Overlay | SOLL | manuell                                      |
| CI läuft grün auf GitHub                                              | MUSS | Actions-Tab                                  |

---

## A1 — UX-/Flow-Audit

| Check                                                                                                                      | Typ            |
| -------------------------------------------------------------------------------------------------------------------------- | -------------- |
| E2E: 4 Spieler, 2 Runden, alle Screens, Mobile-Emulation iPhone 12 + Pixel 5 grün                                          | MUSS           |
| Jeder Screen ist ohne Erklärung verständlich (Luka zeigt einer unbeteiligten Person nur den Screen: "Was würdest du tun?") | MUSS (manuell) |
| Touch-Ziele ≥ 48 px (Primary ≥ 64 px), gemessen per DevTools                                                               | MUSS           |
| Privacy-Screen blockiert Doppeltap (800 ms), Einsatz ist nach Bestätigen nirgends mehr sichtbar                            | MUSS           |
| Namen/Settings überleben Reload                                                                                            | MUSS           |
| Wipes laufen 60 fps (DevTools Performance, kein Layout-Thrash)                                                             | SOLL           |
| Alle 4 Modi liefern korrekte Drinker (Unit-Tests)                                                                          | MUSS           |
| Kein Text hardcodiert; DE komplett                                                                                         | MUSS           |
| Safe-Area auf iPhone mit Notch korrekt (kein Button hinter der Home-Bar)                                                   | MUSS (manuell) |
| Back-Button in PASS/BET/ARENA zeigt Abbrechen-Dialog                                                                       | SOLL           |

---

## A2 — Render-/Performance-Audit + Look-Check

| Check                                                                                                                                                                              | Typ                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 8 Shotlings, 60 s, Referenz-Handy: p50 ≤ 16.7 ms, p95 ≤ 33 ms (Dev-Panel FPS-Log)                                                                                                  | MUSS (manuell + `perf.spec.ts`) |
| Draw-Batches in Arena-Szene ≤ 3 (PIXI DevTools / `renderer.batch` Stats)                                                                                                           | MUSS                            |
| Keine Allokationen im Loop: Chrome Memory-Timeline zeigt flache Heap-Kurve über 30 s                                                                                               | MUSS                            |
| Atlas-Größe ≤ 2048² pro Auflösung, PNG optimiert (`oxipng`/`sharp` quality)                                                                                                        | SOLL                            |
| Look-Check gegen `02-ART-DIRECTION.md §1/§5`: Outline-Dicke, Chibi-Proportion, Cel-Shading, Blob-Shadow — Screenshot in `docs/screens/m2-*.png` ablegen und mit Checkliste abhaken | MUSS                            |
| Alle 8 Farben im Scope-Dunkel unterscheidbar (Screenshot mit simulierter Vignette, plus Deuteranopie-Simulation in DevTools → Symbole tragen die Unterscheidung)                   | MUSS                            |
| Walk-Cycle hat Squash & Stretch + Blinzeln; Männchen wirken "lebendig" (Luka-Urteil)                                                                                               | MUSS (manuell)                  |
| Low-Effects-Auto-Detect greift bei CPU-Throttle 6× (Dev-Panel zeigt "LOW")                                                                                                         | SOLL                            |
| Preload während BET: Beim Betreten der Arena kein sichtbares Nachladen                                                                                                             | MUSS                            |

---

## A3 — Spannungs-, Fairness- & Performance-Audit

| Check                                                                                                                                                              | Typ            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| Choreographer-Tests: Fairness (Opfer-Verweilzeit ≤ 1/n + 5 % über 10 000 Seeds), letzter Fake ≠ Opfer, 2-Spieler-Minimum, Determinismus                            | MUSS           |
| 1 000 simulierte Runden: `victimId` == angezeigtes Opfer in 100 %                                                                                                  | MUSS           |
| Perf-Test `perf.spec.ts` grün (p50 ≤ 20 ms, p95 ≤ 40 ms, CPU 4×)                                                                                                   | MUSS           |
| Filter sind nur während Shot/Lock aktiv (`container.filters === null` sonst)                                                                                       | MUSS           |
| Spannungs-Test (manuell): 3 Personen sehen 5 Shows; mind. 2 von 3 sagen, sie konnten das Opfer nicht vorhersagen; mind. 1 Fake-Lock-Reaktion ("Neeein") beobachtet | MUSS           |
| Slow-Mo, Zoom, Herzschlag, Vignette-Puls sind im Lock spürbar (Video 30 s in `docs/screens/`)                                                                      | MUSS           |
| Stumm komplett spielbar; mit Ton: Lock-Ticks synchron zu Reticle-Bewegung (± 50 ms)                                                                                | MUSS           |
| Tab-Wechsel während Show → Pause, Rückkehr → Fortsetzung ohne Sprung                                                                                               | SOLL           |
| Wake-Lock aktiv (Display geht in 30 s Arena nicht aus)                                                                                                             | SOLL (manuell) |
| Dauer-Presets 10/15/22 s ± 1 s                                                                                                                                     | MUSS           |

---

## A4 — Animations-Qualitäts-Audit (der wichtigste)

Für **jede** der 12 Todesanimationen eine Zeile in `docs/PROGRESS.md` mit diesen Spalten:

| Kriterium (pro Tod)                                                         | Typ            |
| --------------------------------------------------------------------------- | -------------- |
| Lesbarkeit: Auf einem 5,8"-Handy in 1 s verständlich, was passiert          | MUSS           |
| Anticipation vorhanden (≥ 2 Frames Gegenbewegung)                           | MUSS           |
| Hit-Stop 80 ms beim Treffer                                                 | MUSS           |
| Squash & Stretch beim Aufprall                                              | MUSS           |
| Overshoot-Easing (kein `linear`, kein `power1`)                             | MUSS           |
| Sound-Cues auf Key-Frames (± 50 ms)                                         | MUSS           |
| Dauer 1.5–4.5 s (Unit-Test)                                                 | MUSS           |
| Endet mit Grabstein-Pop (außer Miracle) und Nachbeben-Zoom                  | MUSS           |
| Kein Frame-Drop während Sequenz (max. 2 Long-Tasks > 50 ms)                 | MUSS           |
| "Lustig-Test": 3 Personen sehen die Sequenz einmal; ≥ 2 lachen oder grinsen | SOLL (manuell) |

Gesamt-Checks:

| Check                                                                                                 | Typ  |
| ----------------------------------------------------------------------------------------------------- | ---- |
| 12 Sequenzen registriert, Dev-Preview zeigt alle                                                      | MUSS |
| No-Repeat-Fenster 4 (Test über 1 000 Runden: nie dieselbe ID in 4 Folge-Runden)                       | MUSS |
| Second-Shot-Tode (leg_hop, leg_spin, miss_then_hit) triggern Reticle-Verfolgung + zweiten Shot-Effekt | MUSS |
| Result-Screen zeigt richtige Zone + Zonen-Text                                                        | MUSS |
| Miracle: Session-Regel korrekt, Result feiert es                                                      | MUSS |
| Alle Sequenzen sauber gegen Rig-Reset: nach Sequenz + Reset ist Shotling wieder `idle` (Test)         | MUSS |
| Video aller 12 Tode (Dev-Preview-Durchlauf) in `docs/screens/m4-deaths.mp4`                           | SOLL |

---

## A5 — Polish-, Accessibility- & Bundle-Audit

| Check                                                                                           | Typ  |
| ----------------------------------------------------------------------------------------------- | ---- |
| Lighthouse Mobile: Performance ≥ 90, Accessibility ≥ 90, Best Practices ≥ 90, PWA installierbar | MUSS |
| JS gzip ≤ 450 KB, Initial-Assets ≤ 1 MB, Arena-Chunk lazy                                       | MUSS |
| Kontrast-Check aller Textfarben ≥ 4.5:1 (axe DevTools)                                          | MUSS |
| `prefers-reduced-motion` respektiert (Wipes→Fade, kein Shake)                                   | MUSS |
| Tastatur-Navigation Titel→Lobby→Settings vollständig (Desktop)                                  | SOLL |
| EN vollständig; kein Fallback-Key sichtbar (`[missing]`-Grep)                                   | MUSS |
| Alle 4 Modi im UI erklärt und spielbar; Sudden-Death-Ausscheiden sichtbar                       | MUSS |
| Titel-Loop läuft ohne Speicherleck (10 min Idle, Heap flach)                                    | MUSS |
| Haptik-Muster auf Android spürbar, auf iOS still fehlschlagend (kein Error)                     | SOLL |
| Fehlerfälle: Offline-Start nach Erstinstallation, Atlas-Fehler → Toast                          | MUSS |

---

## A6 — Release-Audit (Playtest-Protokoll)

**Setup:** 4–6 echte Personen, 1 Handy, Luka beobachtet und tippt mit. Mindestens 8 Runden.

| Beobachtung / Frage                                               | Ziel                    |
| ----------------------------------------------------------------- | ----------------------- |
| Zeit von "Seite geöffnet" bis erster Schuss                       | ≤ 90 s ohne Erklärung   |
| Hat jemand beim Rumgeben den Einsatz eines anderen gesehen?       | Nein                    |
| Reaktionen in der Lock-Phase (Rufe, Lachen, Anspannung) pro Runde | ≥ 1 in ≥ 6 von 8 Runden |
| Reaktionen bei der Todesanimation                                 | Lachen in ≥ 5 von 8     |
| "Alle Einsätze"-Reveal löst Gespräch aus?                         | Ja, in ≥ 4 von 8        |
| Frage an jeden: "Würdest du das nochmal spielen?"                 | ≥ 80 % Ja               |
| Frage: "War es fair?"                                             | ≥ 80 % Ja               |
| Frage: "Was war verwirrend?"                                      | Top-5 → Issues          |
| Technisch: Abstürze, Ruckler, Sound-Aussetzer                     | 0 Abstürze, ≤ 1 Ruckler |
| Gerätematrix (iPhone Safari, Android Chrome, iPad, Desktop ×3)    | Alle grün               |
| PWA: Install, Offline-Start, Update-Toast                         | Alle grün               |
| Live-URL, README mit GIF, CHANGELOG, Tag v1.0.0                   | vorhanden               |

Ergebnis → `docs/PLAYTEST-01.md`. Top-5-Findings werden vor dem Tag `v1.0.0` behoben.

---

## Audit-Report-Vorlage (für `docs/PROGRESS.md`)

```md
## Audit A{n} — {Datum}

**Ergebnis:** BESTANDEN / NICHT BESTANDEN

| Check | Status               | Notiz |
| ----- | -------------------- | ----- |
| …     | ✅ / ❌ / ⏳ manuell | …     |

**Offene SOLL-Follow-ups:** (max. 3)

- …
  **Manuelle Checks, die Luka bestätigen muss, bevor M{n+1} startet:**
- [ ] …
```
