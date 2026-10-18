// Baut aus den Textstücken eines PDFs wieder eine Seite, die aussieht wie das Original:
// gleiche Zeilen, gleiche Einrückung, Spalten nebeneinander, Leerzeilen bei großen Abständen.
// Jedes Stück wird nach seiner Position (x, y) auf ein Zeichenraster gesetzt.

export interface Stueck {
  str: string;
  x: number; // links, in PDF-Punkten
  y: number; // Grundlinie, in PDF-Punkten (wächst nach oben)
  breite: number;
  hoehe: number; // ungefähr die Schriftgröße
}

export function baueLayout(stuecke: Stueck[]): string {
  const sichtbar = stuecke.filter((s) => s.str.trim() !== '');
  if (sichtbar.length === 0) return '';

  const zeichenBreite = median(sichtbar.map((s) => s.breite / s.str.length).filter((w) => w > 0)) || 5;
  const zeilenHoehe = median(sichtbar.map((s) => s.hoehe).filter((h) => h > 0)) || 10;
  const minX = Math.min(...sichtbar.map((s) => s.x));

  // Zu Zeilen gruppieren: Stücke mit fast gleicher Grundlinie gehören zusammen.
  const sortiert = [...sichtbar].sort((a, b) => b.y - a.y || a.x - b.x);
  const zeilen: { y: number; stuecke: Stueck[] }[] = [];
  for (const s of sortiert) {
    const zeile = zeilen.find((z) => Math.abs(z.y - s.y) < zeilenHoehe * 0.5);
    if (zeile) zeile.stuecke.push(s);
    else zeilen.push({ y: s.y, stuecke: [s] });
  }
  zeilen.sort((a, b) => b.y - a.y);

  const ausgabe: string[] = [];
  let vorherY: number | null = null;
  for (const zeile of zeilen) {
    if (vorherY !== null) {
      // Großer Abstand nach oben = Leerzeilen, höchstens zwei, damit nichts auseinanderfällt.
      const leer = Math.round((vorherY - zeile.y) / (zeilenHoehe * 1.4)) - 1;
      for (let i = 0; i < Math.min(Math.max(leer, 0), 2); i++) ausgabe.push('');
    }
    vorherY = zeile.y;

    let text = '';
    for (const s of zeile.stuecke.sort((a, b) => a.x - b.x)) {
      const spalte = Math.round((s.x - minX) / zeichenBreite);
      if (spalte > text.length) text += ' '.repeat(spalte - text.length);
      else if (text.length > 0 && !text.endsWith(' ') && !s.str.startsWith(' ') && luecke(text, s, zeile.stuecke, zeichenBreite)) text += ' ';
      text += s.str;
    }
    ausgabe.push(text.trimEnd());
  }
  return ausgabe.join('\n');
}

// Prüft, ob zwischen dem vorigen Stück und diesem eine sichtbare Lücke ist (dann Leerzeichen).
function luecke(_text: string, s: Stueck, alle: Stueck[], zeichenBreite: number): boolean {
  const vorher = alle.filter((a) => a.x < s.x).sort((a, b) => b.x - a.x)[0];
  if (!vorher) return false;
  return s.x - (vorher.x + vorher.breite) > zeichenBreite * 0.3;
}

function median(werte: number[]): number {
  if (werte.length === 0) return 0;
  const w = [...werte].sort((a, b) => a - b);
  return w[Math.floor(w.length / 2)];
}
