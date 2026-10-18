import { describe, expect, it } from 'vitest';
import { ordneKaestchenZu as zuordnenFuerBuchstabenTest } from '../src/lib/kaestchen';

describe('Buchstaben sind keine Kästchen', () => {
  // Tesseract-Werte aus einem erfundenen Testbild: "B" in "Beispiel", "b" in "bitte", "e" am Ende von "geehrte"
  const wort = (text: string, x0: number, x1: number, y0: number, y1: number, confidence = 96) => ({
    text, confidence, bbox: { x0, x1, y0, y1 },
  });
  const zeile = (...words: ReturnType<typeof wort>[]) => ({
    words,
    bbox: { x0: words[0].bbox.x0, x1: words.at(-1)!.bbox.x1, y0: 140, y1: 220 },
  });
  const box = (x0: number, x1: number) => ({ x0, x1, y0: 160, y1: 190, angekreuzt: true, fuellung: 0.3 });

  it('verwirft Funde am Anfang, in der Mitte und am Ende sicher erkannter Wörter', () => {
    const z = zeile(wort('Sehr', 84, 250, 141, 201), wort('geehrte', 274, 539, 142, 217), wort('Beispiel,', 757, 1047, 142, 216));
    const { zuordnung } = zuordnenFuerBuchstabenTest([z], [box(755, 792), box(504, 535), box(139, 169)]);
    expect(zuordnung.size).toBe(0);
  });

  it('verwirft auch das "O" in einem sicher erkannten Wort wie "Ohne"', () => {
    const z = zeile(wort('bei.', 1411, 1485, 2025, 2062), wort('Ohne', 1505, 1623, 2026, 2062));
    const k = { x0: 1507, x1: 1534, y0: 2030, y1: 2055, angekreuzt: false, fuellung: 0 };
    const { zuordnung } = zuordnenFuerBuchstabenTest([{ ...z, bbox: { ...z.bbox, y0: 2018, y1: 2065 } }], [k]);
    expect(zuordnung.size).toBe(0);
  });

  it('behält echte Kästchen, aus denen Tesseract Müll gelesen hat', () => {
    const z = zeile(wort('O', 84, 118, 150, 200, 40), wort('ledig', 190, 330, 150, 205));
    const { zuordnung } = zuordnenFuerBuchstabenTest([z], [box(84, 118)]);
    expect(zuordnung.size).toBe(1);
  });
});
import { findeKaestchen } from '../src/lib/kaestchen';

// Weißes Blatt mit schwarzen Rechtecken als Testbild
function blatt(breite: number, hoehe: number) {
  const daten = new Uint8ClampedArray(breite * hoehe * 4).fill(255);
  const punkt = (x: number, y: number) => {
    const i = (y * breite + x) * 4;
    daten[i] = daten[i + 1] = daten[i + 2] = 0;
  };
  const rahmen = (x: number, y: number, s: number, dicke = 2) => {
    for (let d = 0; d < dicke; d++)
      for (let i = 0; i < s; i++) {
        punkt(x + i, y + d); punkt(x + i, y + s - 1 - d);
        punkt(x + d, y + i); punkt(x + s - 1 - d, y + i);
      }
  };
  const kreuz = (x: number, y: number, s: number) => {
    for (let i = 4; i < s - 4; i++) {
      for (const d of [0, 1]) { punkt(x + i + d, y + i); punkt(x + s - 1 - i - d, y + i); }
    }
  };
  const balken = (x: number, y: number, b: number, h: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + b; xx++) punkt(xx, yy);
  };
  return { bild: { breite, hoehe, daten }, rahmen, kreuz, balken };
}

describe('findeKaestchen', () => {
  it('findet leere und angekreuzte Kästchen', () => {
    const { bild, rahmen, kreuz } = blatt(1000, 600);
    rahmen(100, 100, 24);
    rahmen(100, 300, 24);
    kreuz(100, 300, 24);
    const funde = findeKaestchen(bild);
    expect(funde).toHaveLength(2);
    expect(funde[0]).toMatchObject({ angekreuzt: false });
    expect(funde[1]).toMatchObject({ angekreuzt: true });
  });

  it('nimmt keine vollen Flächen, langen Linien oder Buchstabengrößen', () => {
    const { bild, rahmen, balken } = blatt(1000, 600);
    balken(100, 100, 24, 24); // Klecks
    balken(100, 300, 600, 2); // Trennlinie
    rahmen(400, 100, 6); // zu klein, eher ein "o"
    expect(findeKaestchen(bild)).toHaveLength(0);
  });

  it('rechnet Koordinaten auf die Originalgröße zurück', () => {
    const { bild, rahmen } = blatt(1000, 600);
    rahmen(100, 100, 24);
    expect(findeKaestchen(bild, 2)[0]).toMatchObject({ x0: 200, y0: 200 });
  });
});
