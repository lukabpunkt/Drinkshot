/**
 * Wo die Männchen zu Beginn stehen (GDD §3.5, Intro-Inszenierung).
 *
 * Bevor der Warnschuss fällt, stehen sie aufgereiht und rühren sich nicht — wie für ein
 * Foto. Erst der Einschlag löst das auf.
 *
 * Reine Rechnung, kein PIXI: Die Aufstellung hängt an Weltmaßen und der Spielerzahl, und
 * genau das lässt sich ohne Renderer prüfen.
 *
 * **Warum nicht immer eine gerade Reihe:** Die Laufzone hat 702 Welteinheiten Durchmesser,
 * ein Männchen ist rund 0,44 seiner Höhe breit. Bis sechs Spieler passt eine Reihe
 * bequem; bei sieben bräuchte sie 688 Einheiten Spannweite und stünde damit im
 * Requisiten-Ring. Ein Bogen rettet das nicht — damit es noch als Reihe liest, bräuchte
 * er einen Radius von 589, also weit außerhalb der Arena. Ab sieben wird daraus deshalb
 * ein Klassenfoto aus zwei versetzten Reihen.
 */

import { INTRO } from '@/config/choreo';

export interface LineupInput {
  count: number;
  /** Höhe eines Männchens in Welteinheiten (`shotlingHeightFor`). */
  height: number;
  centerX: number;
  centerY: number;
  /** Radius der Laufzone. */
  walkRadius: number;
}

export interface LineupPoint {
  x: number;
  y: number;
  /** `0` = vordere Reihe (bei einer Reihe immer 0). */
  row: number;
}

/**
 * Verteilt `count` Männchen auf eine oder zwei Reihen.
 *
 * Die Reihenfolge entspricht der Eingabereihenfolge — Spieler 1 steht links außen. Bei
 * zwei Reihen füllt sich zuerst die vordere.
 */
export function lineupPositions(input: LineupInput): LineupPoint[] {
  const { count, height, centerX, centerY, walkRadius } = input;
  if (count <= 0) return [];

  const maxHalfSpan = walkRadius * INTRO.maxHalfSpanFactor;
  const spacing = height * INTRO.rowSpacingFactor;

  // Eine Reihe, solange sie in die Zone passt.
  const singleHalfSpan = ((count - 1) * spacing) / 2;
  const rows = singleHalfSpan <= maxHalfSpan ? 1 : 2;

  if (rows === 1) {
    const y = centerY - height * INTRO.rowOffsetFactor;
    return Array.from({ length: count }, (_, index) => ({
      x: centerX - singleHalfSpan + index * spacing,
      y,
      row: 0,
    }));
  }

  /*
   * Zwei Reihen. Die vordere bekommt bei ungerader Zahl den Überhang — so stehen die
   * Hinteren automatisch in den Lücken. Bei gerader Zahl deckten sich die Spalten sonst,
   * deshalb wird die hintere um einen halben Abstand versetzt.
   */
  const front = Math.ceil(count / 2);
  const back = count - front;
  const depth = height * INTRO.rowDepthFactor;
  const stagger = front === back ? spacing / 2 : 0;

  const points: LineupPoint[] = [];
  const place = (n: number, y: number, shift: number, row: number): void => {
    const halfSpan = ((n - 1) * spacing) / 2;
    for (let index = 0; index < n; index++) {
      points.push({ x: centerX - halfSpan + index * spacing + shift, y, row });
    }
  };

  place(front, centerY + depth / 2, -stagger / 2, 0);
  place(back, centerY - depth / 2, stagger / 2, 1);
  return points;
}

/**
 * Wohin der Warnschuss einschlägt: schräg **vor** die Füße des Äußersten.
 *
 * Nicht seitlich neben die Reihe — dort läge der Einschlag bei sechs Spielern auf Radius
 * 393 und damit mitten im Requisiten-Ring (387–418), also womöglich in einem Fass. Vor
 * den Füßen bleibt er immer auf dem hellen Boden, und die Erdfontäne spritzt den
 * Vordersten direkt an.
 */
export function warningShotPoint(positions: readonly LineupPoint[], height: number): {
  x: number;
  y: number;
} {
  if (positions.length === 0) return { x: 0, y: 0 };

  // Der Äußerste der vordersten Reihe — dort sieht man den Einschlag am besten.
  const front = positions.filter((point) => point.row === 0);
  const pool = front.length > 0 ? front : positions;

  // Abstand zur Mitte der Reihe, nicht zum Weltursprung: Die x-Werte liegen um 500 herum.
  const midX = (Math.min(...pool.map((p) => p.x)) + Math.max(...pool.map((p) => p.x))) / 2;
  const outermost = pool.reduce((farthest, point) =>
    Math.abs(point.x - midX) > Math.abs(farthest.x - midX) ? point : farthest
  );

  return { x: outermost.x, y: outermost.y + height * INTRO.warningShotAheadFactor };
}
