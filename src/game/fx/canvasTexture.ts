/**
 * Texturen aus einem Canvas erzeugen — mit Rückfalltür.
 *
 * Mehrere Effekte zeichnen ihre Sprites einmalig auf ein Canvas (Grabstein, Sprechblase,
 * Partikel). Fehlt der 2D-Kontext, lieferte `Texture.from(canvas)` bisher eine kaputte
 * Textur oder warf. Das passiert in zwei realen Fällen: in jsdom, wo die
 * Todesanimationen getestet werden, und in Browsern mit abgeschaltetem Canvas.
 *
 * Beides ist kein Grund, die Runde abzubrechen — der Effekt fällt eben weg.
 */

import { Texture } from 'pixi.js';

export interface CanvasTextureOptions {
  width: number;
  height: number;
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void;
}

export function createCanvasTexture(options: CanvasTextureOptions): Texture {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(options.width));
    canvas.height = Math.max(1, Math.round(options.height));

    const context = canvas.getContext('2d');
    if (!context) return Texture.EMPTY;

    options.draw(context, canvas.width, canvas.height);
    return Texture.from(canvas);
  } catch {
    return Texture.EMPTY;
  }
}
