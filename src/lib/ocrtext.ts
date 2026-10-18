// Baut aus der Tesseract-Ausgabe den Text, der in die Vorschau und an die KI geht.
// Setzt ☒/☐ für Kästchen und wirft Zeichenmüll weg, den Scans typischerweise erzeugen:
// hochkant gedruckte Randschrift, Rahmenlinien, Barcodes.

import { ordneKaestchenZu, ZEICHEN_JA, ZEICHEN_NEIN, type Kaestchen, type Wort, type Zeile } from './kaestchen';

interface Block { paragraphs: { lines: Zeile[] }[] }

const kurz = (w: Wort) => w.text.length <= 3;
// Einzelne Zeichen ohne Buchstaben oder Ziffern am Zeilenende sind Rahmenlinien oder Flecken.
// € und % bleiben, die gehören oft zu einem Betrag.
const nurZeichen = (w: Wort) => !/[\p{L}\p{N}€%]/u.test(w.text);

function median(zahlen: number[]): number {
  if (!zahlen.length) return 0;
  const s = [...zahlen].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/**
 * Randschrift (z. B. "Seite 4/4" hochkant am Rand) liest Tesseract als kurze Fetzen
 * ganz vorn in den Zeilen, mit großem Abstand zum eigentlichen Text.
 */
function ohneRandmuell(woerter: Wort[], zeilenhoehe: number): Wort[] {
  let ab = 0;
  for (let i = 0; i < woerter.length - 1 && kurz(woerter[i]); i++) {
    if (woerter[i + 1].bbox.x0 - woerter[i].bbox.x1 > zeilenhoehe * 1.5) ab = i + 1;
  }
  let bis = woerter.length;
  while (bis > ab && nurZeichen(woerter[bis - 1])) bis--;
  return woerter.slice(ab, bis);
}

// Eine Zeile nur aus Fetzen, bei denen Tesseract selbst unsicher ist
function istMuellzeile(woerter: Wort[]): boolean {
  if (!woerter.length) return true;
  const sicherheit = woerter.reduce((n, w) => n + w.confidence, 0) / woerter.length;
  return woerter.every(kurz) && sicherheit < 75;
}

export function baueText(bloecke: Block[], kaestchen: Kaestchen[] = []): string {
  const zeilen = bloecke.flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
  const { zuordnung, istMuell } = ordneKaestchenZu(zeilen, kaestchen);
  const zeilenhoehe =
    median(zeilen.flatMap((z) => z.words).filter((w) => w.text.length >= 4).map((w) => w.bbox.y1 - w.bbox.y0)) || 30;

  return bloecke
    .map((b) =>
      b.paragraphs
        .map((p) =>
          p.lines
            .map((z) => {
              const k = zuordnung.get(z);
              const woerter = ohneRandmuell(z.words.filter((w) => !istMuell(w)), zeilenhoehe);
              if (!k && istMuellzeile(woerter)) return '';
              const text = woerter.map((w) => w.text).join(' ');
              return k ? `${k.angekreuzt ? ZEICHEN_JA : ZEICHEN_NEIN} ${text}` : text;
            })
            .filter((t) => t.trim())
            .join('\n'),
        )
        .filter((t) => t)
        .join('\n\n'),
    )
    .filter((t) => t)
    .join('\n\n');
}
