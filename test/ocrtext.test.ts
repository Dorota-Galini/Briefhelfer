import { describe, expect, it } from 'vitest';
import type { Kaestchen } from '../src/lib/kaestchen';
import { baueText } from '../src/lib/ocrtext';

const wort = (text: string, x0: number, y0: number, x1: number, y1: number, confidence = 90) => ({
  text,
  confidence,
  bbox: { x0, y0, x1, y1 },
});
const zeile = (...words: ReturnType<typeof wort>[]) => ({
  words,
  bbox: {
    x0: Math.min(...words.map((w) => w.bbox.x0)),
    y0: Math.min(...words.map((w) => w.bbox.y0)),
    x1: Math.max(...words.map((w) => w.bbox.x1)),
    y1: Math.max(...words.map((w) => w.bbox.y1)),
  },
});
const seite = (...lines: ReturnType<typeof zeile>[]) => [{ paragraphs: [{ lines }] }];

describe('baueText', () => {
  it('setzt ☒ und ☐ vor die passende Zeile und wirft den gelesenen Kästchen-Müll weg', () => {
    const bloecke = seite(
      zeile(wort('Kontaktwunsch', 100, 50, 300, 70)),
      zeile(wort('X', 102, 102, 120, 120), wort('per', 160, 100, 200, 122), wort('Telefon', 210, 100, 300, 122)),
      zeile(wort('per', 160, 200, 200, 222), wort('E-Mail', 210, 200, 300, 222)),
    );
    const kaestchen: Kaestchen[] = [
      { x0: 100, y0: 100, x1: 124, y1: 124, angekreuzt: true, fuellung: 0.3 },
      { x0: 100, y0: 198, x1: 124, y1: 222, angekreuzt: false, fuellung: 0 },
    ];
    expect(baueText(bloecke, kaestchen)).toBe('Kontaktwunsch\n☒ per Telefon\n☐ per E-Mail');
  });

  it('entfernt Fetzen der Randschrift vorn und Rahmenstriche hinten', () => {
    const bloecke = seite(
      zeile(wort('S', 20, 100, 34, 120, 95), wort('Hiermit', 200, 100, 280, 122), wort('bitte', 290, 100, 380, 122), wort('|', 900, 100, 904, 122)),
      zeile(wort('5', 20, 140, 34, 160), wort('um', 200, 140, 260, 162), wort('Antwort', 270, 140, 360, 162), wort('£', 700, 140, 710, 150)),
    );
    expect(baueText(bloecke)).toBe('Hiermit bitte\num Antwort');
  });

  it('lässt kurze Wörter im Text und Beträge mit € stehen', () => {
    const bloecke = seite(
      zeile(wort('1.', 200, 100, 220, 122), wort('Werbung', 230, 100, 330, 122)),
      zeile(wort('Beitrag:', 200, 140, 300, 162), wort('120,00', 310, 140, 390, 162), wort('€', 396, 140, 410, 162)),
      zeile(wort('Nr.', 200, 180, 240, 202, 92), wort('5', 250, 180, 262, 202, 92)),
    );
    expect(baueText(bloecke)).toBe('1. Werbung\nBeitrag: 120,00 €\nNr. 5');
  });

  it('wirft Zeilen weg, die nur aus unsicheren Fetzen bestehen', () => {
    const bloecke = seite(
      zeile(wort('Widerrufsrecht', 200, 100, 400, 122)),
      zeile(wort('SZ', 20, 140, 40, 160, 18), wort('8', 50, 140, 60, 160, 30)),
      zeile(wort('ÄE', 20, 180, 40, 200, 40)),
    );
    expect(baueText(bloecke)).toBe('Widerrufsrecht');
  });
});
