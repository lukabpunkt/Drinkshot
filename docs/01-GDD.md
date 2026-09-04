# DRINKSHOT — Game Design Document (GDD)

> Version 1.0 · Stand: 2026-09-03 · Autor: Planung (Cowork) · Zielgruppe: Claude Code + Luka
> Dieses Dokument ist die **Wahrheit** für das Spielverhalten. Bei Widersprüchen zu Code gewinnt das GDD, bis es bewusst geändert wird.

---

## 1. Elevator Pitch

**Drinkshot** ist ein Pass-the-Phone-Partyspiel für 2–8 Personen. Jeder Spieler setzt heimlich Schlücke. Dann laufen kleine Cartoon-Männchen in einer Arena um ihr Leben, während ein unsichtbarer Scharfschütze durch sein Zielfernrohr die Männchen nacheinander anvisiert. Wer getroffen wird, trinkt — je mehr Schlücke man gesetzt hat, desto höher die Chance, dass es einen erwischt. Der Reiz: Das Fadenkreuz springt nervös zwischen den Spielern hin und her, und bis zum Knall weiß niemand, wen es trifft.

**Genre:** Party / Trinkspiel · **Plattform:** Web (Mobile First, Desktop-kompatibel) · **Session-Länge:** 30–90 Sekunden pro Runde · **Spielerzahl:** 2–8 (Sweet Spot 4–6)

**Design-Pfeiler (in dieser Reihenfolge):**

1. **Spannung** — Der Moment vor dem Schuss muss sich anfühlen wie ein Elfmeter.
2. **Comedy** — Jeder Tod ist ein kleiner Gag. Nie brutal, immer albern.
3. **Zero Friction** — Vom Öffnen der Seite bis zum ersten Schuss < 60 Sekunden, keine Registrierung, kein Tutorial-Zwang.
4. **Schön auf jedem Handy** — Läuft flüssig (60 fps Ziel, 30 fps Minimum) auf einem 4 Jahre alten Mittelklasse-Android.

---

## 2. Core Loop

```
┌─────────────────────────────────────────────────────────────────────┐
│  LOBBY  →  BETTING (Handy rumgeben)  →  ARENA (Scope-Phase)  →      │
│  SHOT + DEATH-ANIMATION  →  RESULT ("X trinkt N Schlücke")  →       │
│  [Nächste Runde mit gleichen Spielern]  oder  [Zurück zur Lobby]     │
└─────────────────────────────────────────────────────────────────────┘
```

Eine **Runde** = eine Betting-Phase + eine Arena-Phase + genau **ein Opfer**.
Eine **Session** = beliebig viele Runden mit derselben Spielergruppe. Es gibt einen Session-Scoreboard (wer hat insgesamt wie viele Schlücke getrunken).

---

## 3. Spielregeln (verbindlich)

### 3.1 Spieler & Farben

- Spielerzahl: min. 2, max. 8.
- Jeder Spieler hat: `id`, `name` (optional, max. 12 Zeichen, Default "Spieler 1..8"), `color`.
- **Farbpalette (feste Reihenfolge, wird der Reihe nach vergeben):**

| #   | Name   | Hex       | Charakter-Spitzname (intern) |
| --- | ------ | --------- | ---------------------------- |
| 1   | Rot    | `#FF4757` | Rudi                         |
| 2   | Blau   | `#3B82F6` | Blue                         |
| 3   | Grün   | `#2ED573` | Gustav                       |
| 4   | Gelb   | `#FFD32A` | Yoshi                        |
| 5   | Lila   | `#AF73EE` | Lilo                         |
| 6   | Orange | `#FF7F50` | Olli                         |
| 7   | Pink   | `#FF6B9D` | Pinky                        |
| 8   | Türkis | `#18DCFF` | Turbo                        |

- Farben sind so gewählt, dass sie auf dem Arena-Boden (gedämpftes Grün/Sand) und im Scope-Vignette-Dunkel klar unterscheidbar sind. Zusätzlich trägt jedes Männchen ein Symbol auf dem Shirt (Kreis, Dreieck, Quadrat, Stern, Raute, Herz, Blitz, Kreuz) — **Farbenblind-Fallback**.

### 3.2 Betting-Phase ("Handy rumgeben")

- Reihenfolge: Spieler 1 → 2 → … → n.
- Vor jedem Spieler erscheint ein **Privacy-Screen**: großes Farb-Badge + Name + "Gib das Handy an **{Name}**. Tippe, wenn du bereit bist." Erst nach Tap wird das Eingabe-UI sichtbar.
- Eingabe: Schlücke **1 bis 10** (Default 3) über große +/– Buttons oder Slider. Es gibt einen Button "Bestätigen & verstecken".
- Nach Bestätigen: Sofort wieder Privacy-Screen für den nächsten Spieler. Die eigene Zahl ist **nie wieder sichtbar**, bis die Runde aufgelöst ist.
- **Nicht erlaubt:** 0 Schlücke. Begründung: Ein Spieler mit 0 Schlücken hätte 0 % Risiko und würde das Spiel für alle anderen entwerten. Min. 1 ist Pflicht ("Skin in the game").
- Optionaler Modus "Blind Bet" (Session-Setting): Zahl wird per Zufall zugewiesen, niemand wählt. Für sehr betrunkene Runden.

### 3.3 Einsatz-Logik: Was bedeutet der Einsatz?

**Regel (Default, "Risk & Reward"):**

- Der Getroffene trinkt **seinen eigenen Einsatz**. (Er hat sich selbst das Risiko gesetzt.)
- Zusätzlich darf der Getroffene **nichts** verteilen — die anderen sind safe.

**Warum nicht "verteilen"?** Der Ursprungs-Pitch sagt "Schlücke, die er verteilen möchte". Das erzeugt aber eine Spirale: Wer viel setzt, hat hohes Risiko UND große Belohnung — das wäre balanciert. Aber: Wer dann getroffen wird, hat gar nichts davon. Deshalb wird das im **Modus-System** gelöst (siehe 3.6), Default ist der einfachste, sofort verständliche Modus. Luka kann den Default in `src/config/rules.ts` mit einer Zeile umschalten.

### 3.4 Wahrscheinlichkeit (Kernmechanik)

Sei `b_i` der Einsatz von Spieler _i_ und `B = Σ b_i` die Summe aller Einsätze.

**Trefferwahrscheinlichkeit** von Spieler _i_:

```
p_i = b_i / B
```

Beispiel: Einsätze 1, 2, 3, 5 → B = 11 → p = 9,1 %, 18,2 %, 27,3 %, 45,5 %.
(Der Pitch nennt Einsätze 1/2/3/5 bei "insgesamt 10 Schlücken" → 10/20/30/50 %. 1+2+3+5 ist aber 11, nicht 10 — der Pitch hat sich verrechnet. Die Formel `p_i = b_i / B` ist die gemeinte Regel und wird so umgesetzt.)

**Ziehung:** Gewichtete Zufallsauswahl (Roulette-Wheel-Selection) mit einem **kryptografisch sicheren RNG** (`crypto.getRandomValues`), damit niemand behaupten kann, das Handy sei manipuliert.

```ts
// Pseudocode — verbindlich
function pickVictim(players: { id: string; bet: number }[]): string {
  const total = players.reduce((s, p) => s + p.bet, 0);
  const r = secureRandomFloat() * total; // [0, total)
  let acc = 0;
  for (const p of players) {
    acc += p.bet;
    if (r < acc) return p.id;
  }
  return players[players.length - 1].id; // Float-Rounding-Fallback
}
```

**Wichtig — das Opfer wird SOFORT bei Beginn der Arena-Phase gezogen.** Die gesamte Scope-Show danach ist reine Inszenierung ("Choreographie"), die auf das bereits feststehende Ergebnis hinführt. Das garantiert, dass die Animation dramaturgisch sauber auf das Opfer zuläuft, ohne dass die Fairness leidet (die Ziehung ist ja schon passiert).

**Verifizierbarkeit (Nice-to-have, M6):** Vor der Ziehung wird ein Seed erzeugt und als Hash angezeigt (Commit-Reveal). Nach der Runde wird der Seed gezeigt. Für die Party irrelevant, aber ein cooles "Beweis, dass es fair war"-Feature für Nerds am Tisch.

### 3.5 Arena-Phase (Scope-Show) — Dramaturgie

Dauer gesamt: **12–20 Sekunden** (Default 15 s, in Settings "Kurz / Normal / Lang" = 10 / 15 / 22 s).

Die Phase ist ein **Skript** (Timeline), nicht Freiplay. Die Männchen laufen KI-gesteuert (siehe 5.1), das Fadenkreuz folgt einem generierten "Target-Script":

| Phase      | Zeit (bei 15 s) | Was passiert                                                                                                                                                                                             |
| ---------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Intro**  | 0.0 – 1.5 s     | Schwarz → Scope-Blende öffnet sich (Iris-Wipe). Leichtes Atmen (Scope wobbelt). Alle Männchen sichtbar, laufen los.                                                                                      |
| **Scan**   | 1.5 – 6.0 s     | Fadenkreuz gleitet weich von Männchen zu Männchen (jedes mind. 1×), Verweildauer 0.6–1.2 s. Beim Ankommen "Lock-Tick"-Sound + Reticle-Pulse.                                                             |
| **Panik**  | 6.0 – 11.0 s    | Wechsel werden schneller (0.3–0.7 s), Männchen rennen schneller, Herzschlag-Sound setzt ein, Vignette pulsiert. 1–2 "Fakes": Reticle bleibt 1 s auf einem Nicht-Opfer, färbt sich fast rot, springt weg. |
| **Lock**   | 11.0 – 13.5 s   | Reticle landet auf dem Opfer, färbt sich rot, "LOCKED"-Ticks, Scope zoomt 15 % rein, Zeit verlangsamt sich (Slow-Mo 0.4×), Herzschlag laut.                                                              |
| **Shot**   | 13.5 s          | Weißer Muzzle-Flash 2 Frames, Screen-Shake, Knall, Slow-Mo bricht ab.                                                                                                                                    |
| **Death**  | 13.5 – ~16 s    | Todesanimation (siehe 4). Kamera bleibt im Scope, folgt dem Opfer.                                                                                                                                       |
| **Reveal** | danach          | Scope-Vignette fährt weg, Result-Screen fährt rein.                                                                                                                                                      |

**Regeln für das Target-Script (Anti-Vorhersagbarkeit):**

- Das Opfer darf während "Scan" und "Panik" **nicht** häufiger angevisiert werden als andere. Statistisch muss die Reticle-Verweilzeit auf jedem Spieler bis zum Lock ± gleich sein, sonst lernen die Spieler das Muster.
- Der letzte Fake vor dem Lock muss ein **Nicht-Opfer** sein (max. Fallhöhe).
- Bei 2 Spielern: Mindestens 4 Wechsel, damit es nicht in 3 Sekunden vorbei ist.

### 3.6 Modi (Session-Settings, M5)

| Modus                 | Wer trinkt?                                                                                                                         | Zweck                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Klassik** (Default) | Opfer trinkt eigenen Einsatz.                                                                                                       | Einfach, sofort verständlich.                                                                 |
| **Verteiler**         | Opfer wird angeschossen; **alle anderen** trinken den Einsatz des Opfers (das Opfer "verteilt" posthum).                            | Belohnt Mut: hoher Einsatz = hohes Risiko, aber die anderen zahlen. Näher am Ursprungs-Pitch. |
| **Sudden Death**      | Wie Klassik, aber der Getroffene scheidet für die Session aus; letzter Überlebender bekommt die Summe aller Einsätze zum Verteilen. | Turnier-Feeling für 5+ Spieler.                                                               |
| **Double Tap**        | Wie Klassik, aber es fallen 2 Schüsse (2 Opfer, ohne Zurücklegen).                                                                  | Für große Gruppen (6–8).                                                                      |
| **Showdown**          | Es wird geschossen, bis nur einer steht. Jeder Getroffene trinkt seinen eigenen Einsatz, der Überlebende verteilt seinen. **Kein Ausscheiden für die Session** — nächste Runde sind alle wieder dabei. Wunder sind hier aus, weil genau einer überleben muss. | Der große Auftritt: eine Runde als ganzer Abend im Kleinen. |

**Zur Balance im Showdown** (gemessen, 300 000 simulierte Runden, 6 Spieler): Weil jeder der n−1 Schüsse nach Einsatz gewichtet wird, multipliziert sich das Risiko. Wer 1 setzt, überlebt in 52,9 % der Runden und trinkt im Schnitt 0,76; wer 6 setzt, überlebt in 2,6 % und trinkt 6,20. Ein hoher Einsatz ist hier auf **beiden** Achsen schlechter. Das ist bewusst so: Konsistenz mit den anderen Modi und eine Regel, die man am Tisch in einem Satz sagt, schlagen die rechnerische Balance — und dass der Großmauligste als Erster umfällt, ist gute Comedy. Sollte sich im Playtest zeigen, dass alle nur noch 1 setzen, liegt die Alternative in `DECISIONS.md` (ADR-51).


### 3.7 Result-Screen

- Großer Reveal: Farb-Badge + Name des Opfers, Trefferzone-Icon (Kopf/Brust/Bein/…), Zeile "**{Name} trinkt {N} Schlücke!**" mit fettem Number-Punch.
- Darunter aufklappbar: "Alle Einsätze" — jetzt sind alle Einsätze öffentlich (Tabelle Farbe · Name · Einsatz · Chance %). **Das ist der zweite Comedy-Moment:** "Du hast 1 gesetzt und wurdest trotzdem getroffen?!"
- Session-Scoreboard: Balken pro Spieler "insgesamt getrunken".
- Buttons: **"Nächste Runde"** (gleiche Spieler, direkt in Betting) · "Spieler ändern" · "Modus ändern".
- Im **Showdown** steht nicht das Opfer im Mittelpunkt, sondern der Überlebende: sein Badge, seine Farbe, "Überlebt"-Abzeichen in Gold, Kopfzeile "{Name} überlebt!", darüber "{n} Schüsse. Einer steht noch." In der Einsatz-Tabelle ist er hervorgehoben statt des Opfers.

---

## 4. Todesanimationen (das Herzstück)

Jeder Schuss wählt zufällig (gleichverteilt, mit "Nicht-zweimal-hintereinander"-Regel) eine **Trefferzone**, und jede Zone hat 2–3 **Varianten**. Alle Animationen sind **Cartoon-Slapstick**: kein Blut, keine Wunden. Stattdessen Sternchen, Rauchwölkchen, Federn, Konfetti, Röntgen-Blitz, "X"-Augen.

Ziel: mindestens **12 unterschiedliche Tode** bis Release, damit selbst nach 20 Runden noch Überraschung da ist.

### 4.1 Zonen & Varianten

**KOPF (Headshot)**

- `head_helmet_spin`: Der Kopf dreht sich 3× um die eigene Achse wie eine Schraube, Männchen bleibt stehen, blinzelt, fällt dann steif wie ein Brett nach hinten um. Sternchen kreisen.
- `head_hat_launch`: Männchen trägt seit Rundenbeginn zufällig einen Hut/Käppi/Partyhut; der Schuss schießt den Hut in den Himmel (raketenartig, bis aus dem Bild), das Männchen guckt hoch, Hut kommt 1,5 s später wieder runter und landet auf dem inzwischen ohnmächtigen Männchen.
- `head_xray`: Kurzer Röntgen-Blitz (Silhouette wird zum Skelett-Sprite, 4 Frames Flackern), dann sinkt das Männchen mit Spiral-Augen zu Boden.

**BRUST (Body)**

- `body_dramatic`: Klassischer Theater-Tod: Hand auf die Brust, taumelt 3 Schritte, dreht sich, fällt auf die Knie, steht nochmal auf ("noch nicht!"), fällt endgültig. 2,5 s Overacting.
- `body_deflate`: Männchen wird wie ein Luftballon angeschossen, fliegt zischend mit Loop-Bahn durch die Arena (Partikel-Spur) und landet schlaff als Häufchen.
- `body_freeze_shatter`: Männchen erstarrt (Eis-Overlay), kippt um, zerspringt in 6–8 Cartoon-Scherben, die wegspringen.

**BEIN (Leg) — der "Zweiter Schuss"-Gag**

- `leg_hop`: Erster Schuss trifft das Bein: Männchen hüpft auf einem Bein mit "Aua"-Sprechblase in Kreisen weiter und versucht zu flüchten. Reticle folgt ihm 1,5–2 s (mit Comedy-"Nicht schon wieder"-Timing), **zweiter Schuss** → er fällt wie ein gefällter Baum um (Baum-Knarz-Sound).
- `leg_spin`: Bein wird getroffen, Männchen rotiert wie ein Kreisel auf der Stelle (Beschleunigung), bohrt sich ins Erdreich, nur noch der Kopf guckt raus, dann zweiter Schuss macht "plopp" und ein Grabstein-Schild ("RIP") springt aus dem Loch.

**HINTERN (Butt)**

- `butt_rocket`: Treffer in den Po, Männchen schießt mit Rauchspur nach oben aus dem Bild, kommt 1 s später kopfüber im Boden steckend wieder runter, Beine strampeln, werden still.
- `butt_hotfoot`: Männchen springt mit Händen am Po hoch, rennt Kreise mit Rauch, stolpert über die eigenen Füße, Sternchen.

**MISS + SECOND SHOT (der Fake-Miss)**

- `miss_then_hit`: Erster Schuss geht daneben (Erdfontäne neben dem Männchen), Männchen dreht sich erleichtert zur Kamera, winkt "Puh!" — zweiter Schuss trifft mitten im Winken. Frames einfrieren, "X"-Augen, kippt um.

**GLÜCK GEHABT? (Kein Tod — Rarität, 1 von 40 Runden, Setting "Miracles" an/aus)**

- `miracle_dodge`: Männchen bückt sich zufällig, um einen Schnürsenkel zu binden, Kugel fliegt drüber. Alle überleben, **niemand trinkt** — oder in "Verteiler"-Modus: alle trinken 1. Gibt dem Spiel einen "Legend"-Moment. **Wird auf dem Result-Screen groß gefeiert.**

### 4.2 Gemeinsame Effekt-Bausteine (wiederverwendbar)

- **Muzzle-Flash:** Vollbild-Weißblitz 2 Frames + radiale Distortion (WebGL-Filter, fallback: einfache Skalierung).
- **Screen-Shake:** 250 ms, Amplitude 12 px, exponentieller Decay.
- **Hit-Stop:** 80 ms Freeze auf dem Treffer-Frame.
- **Impact-Sternchen:** 5–8 Sprite-Partikel, gelb/weiß, kreisen um den Kopf.
- **Rauchwölkchen:** Puff-Sprite, wächst und fadet 400 ms.
- **Sprechblasen:** "Aua!", "Puh!", "Nicht schon wieder!", "Warum ich?!" — Comic-Font, Pop-In mit Overshoot.
- **Grabstein-Pop:** Kleines "RIP"-Schild springt mit Bounce aus dem Boden (Ende jeder Todesanimation, außer Miracle).
- **Nachbeben:** Nach dem Tod zoomt die Scope-Kamera leicht auf das Opfer, andere Männchen bleiben stehen, schauen hin, einer klatscht.

### 4.3 Animationstechnik

- Männchen sind **rigged 2D-Sprites** (Kopf, Torso, 2 Arme, 2 Beine, Hut-Slot, Gesichts-Slot) → Animationen werden **prozedural per Tween** gebaut (GSAP oder pixi-tweener), nicht als Frame-Sequenzen. Vorteil: winzige Assets, unbegrenzte Varianten, Farben live per Tint.
- Gesichter sind austauschbare Sprites: `neutral`, `scared`, `x_eyes`, `spiral`, `happy`, `ouch`.
- Alle Animationen laufen in einem einheitlichen `DeathSequence`-Interface (siehe Architektur) mit Zeitleiste, damit die Kamera und der Sound synchron gehen.

---

## 5. Arena & Charakter-Verhalten

### 5.1 Männchen-KI (leicht, deterministisch bei gegebenem Seed)

- Bewegung: **Wander-Steering** (zufälliges Zielpunkt-Sampling innerhalb der Arena, Umkehr an Rändern, leichte Separation zwischen Männchen, damit sie nicht überlappen).
- Geschwindigkeit skaliert mit Phase: Scan 1.0×, Panik 1.6×, Lock 0.4× (Slow-Mo global).
- Reaktion auf das Fadenkreuz: Wird ein Männchen anvisiert, guckt es zur Kamera (Angst-Gesicht), zappelt kurz und rennt weg, sobald das Reticle weiterspringt. Erhöht die Lesbarkeit: Man sieht immer, wer gerade "dran" ist.
- Idle-Gags (zufällig, 1 pro Runde): Ein Männchen stolpert, ein Männchen versteckt sich hinter einem Fass (und wird trotzdem "gesehen" — das Fass ist zu klein), ein Männchen winkt in die Kamera.

### 5.2 Arena-Layout

- Format: Portrait auf Mobile, das Scope-Fenster ist rund und füllt die Breite. Auf Desktop bleibt das Scope rund und zentriert, die Ecken werden mit dunklem Vignette-Rand gefüllt (kein Stretch).
- Arena = **Kreisfläche** (passt zum runden Scope), Boden Wiese/Sand mit ein paar Requisiten (Fass, Strohballen, Zielscheibe, Kaktus, Bierkiste als Easter Egg). Requisiten sind reine Deko, nur die Mitte ist begehbar (Kollisionskreis).
- Themen (Nice-to-have, M6): "Wiese", "Wüste", "Nacht mit Lagerfeuer", "Schnee".

---

## 6. Screens / UX-Flow

| #   | Screen           | Inhalt & UX-Regeln                                                                                                                                                                                          |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | **Splash/Title** | Logo mit Wackel-Animation, ein Männchen läuft durchs Bild und wird erschossen (Loop). Buttons: **Spielen**, Regeln (Bottom-Sheet), Settings (Zahnrad). Sound-Toggle prominent, weil Mobile-Autoplay-Policy. |
| 1   | **Lobby**        | Spielerliste (Farb-Badge, Name editierbar, X zum Entfernen), "+ Spieler" (bis 8), Modus-Chip, Dauer-Chip. Primary CTA: **Los geht's**. Namen werden in localStorage gemerkt.                                |
| 2   | **Pass-Screen**  | Vollbild in Spielerfarbe, große Anweisung "Handy an **Name** geben", Tap-to-continue. Blockiert 800 ms gegen Doppeltaps.                                                                                    |
| 3   | **Bet-Screen**   | Zahl riesig, +/– Buttons (Touch-Ziel ≥ 64 px), Hinweistext "Mehr Einsatz = höheres Risiko", Button **Bestätigen**. Nach Bestätigen: kurze Bestätigungs-Animation (Zahl verschwindet in Umschlag/Tresor).    |
| 3b  | **Start-Screen** | Nachdem der letzte Spieler bestätigt hat: "Alle haben gesetzt", die Farb-Badges aller Mitspieler, **"Legt das Handy in die Mitte"**, Modus- und Dauer-Chip, Primary-CTA **Los!**. Zeigt **keine** Einsätze. Der Knopf ist 400 ms taub — er sitzt dort, wo eben noch "Bestätigen" war. |
| 4   | **Arena**        | Scope-View (siehe 3.5). **Keine** Interaktion nötig. Optional: "Tap zum Überspringen" erst nach dem **letzten** Schuss (springt zur Result).                                                                |
| 5   | **Result**       | Siehe 3.7. Konfetti in Opferfarbe. Haptik (`navigator.vibrate`) beim Reveal, wenn verfügbar.                                                                                                                |
| 6   | **Settings**     | Sound an/aus, Musik-Lautstärke, Haptik, Dauer, Modus, Miracles an/aus, Reduzierte Effekte (Low-End-Geräte), Sprache (DE/EN), "Session zurücksetzen".                                                        |
| 7   | **Regeln**       | 4 Cards mit Illustration, Swipe. Max. 30 Wörter pro Card.                                                                                                                                                   |

**Orientation:** Portrait-Lock via CSS/Meta (Landscape zeigt "Bitte Handy drehen"-Overlay). Desktop: Portrait-Rahmen 9:16 zentriert, max. 480 px breit, mit dekorativem Hintergrund drumherum.

**PWA:** Installierbar (Manifest + Service Worker), offline spielbar nach erstem Laden, Home-Screen-Icon. Das ist wichtig: Partys haben schlechtes WLAN.

**Wake Lock:** Während Arena-Phase `navigator.wakeLock` anfordern, damit das Display nicht ausgeht.

---

## 7. Audio

- Alle Sounds als kurze OGG+MP3 (Fallback), zusammengefasst in einem Sprite-Sheet (howler.js Audio-Sprite) → 1 Request.
- Liste: `ui_tap`, `ui_confirm`, `pass_whoosh`, `scope_open`, `reticle_move` (3 Varianten), `lock_tick`, `heartbeat_loop`, `gunshot` (2 Varianten), `hit_stop_thud`, `star_twinkle`, `balloon_deflate`, `tree_fall`, `rocket`, `rip_pop`, `crowd_ooh`, `crowd_laugh`, `fanfare_result`, `miracle_choir`.
- Musik: 1 Loop für Lobby (leichter Ukulele/Chiptune-Vibe), 1 Spannungs-Loop für Arena (Bass-Drone + Tick). Beide ≤ 30 s Loop, ≤ 400 KB.
- Audio-Unlock: Erster Tap auf "Spielen" entsperrt den AudioContext (iOS Pflicht).
- **Sound ist optional** — das Spiel muss auch stumm 100 % funktionieren (viele Partys haben eigene Musik). Deshalb: alle wichtigen Informationen auch visuell.

---

## 8. Ergänzungen, die der Pitch nicht hatte (bewusst aufgenommen)

| Ergänzung                             | Warum                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Spielerzahl 2–8 statt fix 4           | Partys sind nie genau 4 Leute.                                                                                           |
| Namen + Symbole                       | Farbe allein reicht nicht bei 8 Spielern / Farbenblindheit.                                                              |
| Privacy-Screen vor jeder Eingabe      | Ohne ihn sieht der Nachbar den Wert beim Rumgeben.                                                                       |
| Minimum-Einsatz 1                     | Verhindert 0 %-Trittbrettfahrer.                                                                                         |
| Ziehung VOR der Show, Show als Skript | Nur so lässt sich die Dramaturgie kontrollieren; Fairness bleibt erhalten.                                               |
| Fake-Locks                            | Das ist der eigentliche Spannungstreiber.                                                                                |
| Session-Scoreboard                    | Gibt dem Abend einen roten Faden ("Marc hat schon 14 Schlücke").                                                         |
| Modi                                  | Verlängert die Lebensdauer des Spiels, löst die "verteilen"-Frage sauber.                                                |
| Miracle-Dodge                         | Seltene Ereignisse erzeugen Geschichten, die man am nächsten Tag erzählt.                                                |
| PWA + Wake Lock + Haptik              | Handy-Realität auf Partys.                                                                                               |
| Low-Effects-Modus                     | Alte Androids am Tisch sollen nicht das Erlebnis für alle killen.                                                        |
| Alters-/Verantwortungs-Hinweis        | Einmaliger Hinweis beim ersten Start ("18+, trink verantwortungsvoll, Wasser ist auch ein Getränk"). Kurz, nicht nervig. |
| DE/EN                                 | i18n von Anfang an, weil später nachrüsten teuer ist. Start-Sprache DE.                                                  |
| Commit-Reveal-Seed                    | Fairness-Beweis für Skeptiker (M6, optional).                                                                            |

---

## 9. Nicht-Ziele (bewusst NICHT in v1)

- Kein Multiplayer über mehrere Handys / kein Backend. Pass-the-Phone ist das Feature, nicht die Einschränkung.
- Kein Login, keine Accounts, kein Tracking.
- Keine Ads, keine In-App-Käufe.
- Kein 3D. 2D-Cartoon ist stilistisch stärker und performanter.
- Keine echten Waffen-Darstellungen (kein Gewehr-Modell sichtbar, nur Scope-Overlay + Flash). Ton bleibt albern.

---

## 10. Erfolgskriterien (Definition of Done für v1.0)

1. Ein Neuling versteht die Regeln ohne Erklärung nach einer Runde.
2. Auf einem iPhone 11 und einem Pixel 4a läuft die Arena-Phase mit ≥ 55 fps (Low-Effects: ≥ 30 fps).
3. Lighthouse Mobile: Performance ≥ 90, PWA installierbar, First Load ≤ 1,5 MB (gzip), TTI ≤ 3 s auf 4G.
4. Mindestens 12 Todesanimationen, keine wiederholt sich in 4 aufeinanderfolgenden Runden.
5. Ziehung ist statistisch korrekt (Unit-Test: 100 000 Ziehungen, Abweichung < 1 % pro Spieler).
6. Playtest mit mindestens einer echten 4–6-Personen-Gruppe: alle lachen mindestens einmal (subjektiv, aber das ist das Produkt).
