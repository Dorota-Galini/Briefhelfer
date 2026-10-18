import { describe, expect, it } from 'vitest';
import { baueLayout, type Stueck } from '../src/lib/layout';
import { findePersonendaten, kompakt, pseudonymisiere } from '../src/lib/pseudonymize';

describe('kompakt', () => {
  it('fasst Layout-Leerzeichen zusammen, Spalten bleiben getrennt', () => {
    const t = 'Beitrag:                      89,90 €   \n\n\n\nLaufzeit:          1 Jahr';
    expect(kompakt(t)).toBe('Beitrag:  89,90 €\n\nLaufzeit:  1 Jahr');
  });
});

// Zeichenbreite 6 pt, Schrift 10 pt. Die Stücke kommen absichtlich durcheinander, wie oft bei PDFs.
const s = (str: string, spalte: number, zeile: number): Stueck => ({
  str,
  x: 50 + spalte * 6,
  y: 800 - zeile * 14,
  breite: str.length * 6,
  hoehe: 10,
});

describe('baueLayout', () => {
  it('stellt Spalten und Zeilenreihenfolge wie im Original her', () => {
    const text = baueLayout([
      s('01.04.2027 0:00 Uhr', 30, 1),
      s('Versicherungsablauf:', 0, 0),
      s('01.04.2025 0:00 Uhr', 30, 0),
      s('Beitrag:', 0, 2),
      s('89,90 €', 30, 2),
    ]);
    expect(text.split('\n')).toEqual([
      'Versicherungsablauf:          01.04.2025 0:00 Uhr',
      '                              01.04.2027 0:00 Uhr',
      'Beitrag:                      89,90 €',
    ]);
  });

  it('übernimmt Leerzeilen aus dem Original, höchstens zwei', () => {
    expect(baueLayout([s('Oben', 0, 0), s('Unten', 0, 2)])).toBe('Oben\n\nUnten');
    expect(baueLayout([s('Oben', 0, 0), s('Unten', 0, 9)])).toBe('Oben\n\n\nUnten');
  });
});

describe('Beträge', () => {
  it('bleiben sichtbar, auch große mit Tausenderpunkten', () => {
    const t = 'Deckungssumme:   3.000.000 €\nSelbstbeteiligung: 2.500,00 EUR';
    const { text } = pseudonymisiere(t, findePersonendaten(t));
    expect(text).toBe(t);
  });
});

describe('Datumsangaben', () => {
  it('werden nicht als Nummer geschwärzt, auch mit Uhrzeit dahinter', () => {
    const t = 'Versicherungsablauf:   01.04.2025 0:00 Uhr\n                       01.04.2027 0:00 Uhr';
    const { text } = pseudonymisiere(t, findePersonendaten(t));
    expect(text).toBe(t);
  });
});
