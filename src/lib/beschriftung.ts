// Findet zu einem Formularfeld den Text, der es beschriftet: links daneben auf gleicher Höhe
// oder direkt darüber. Arbeitet in PDF-Koordinaten (Punkte, y wächst nach oben).
import type { Stueck } from './layout';

export interface Rechteck {
  x: number;
  y: number; // Unterkante
  breite: number;
  hoehe: number;
}

const MAX_LINKS = 260; // so weit links darf die Beschriftung stehen
const MAX_DARUEBER = 28; // so weit über dem Feld

export function findeBeschriftung(feld: Rechteck, stuecke: Stueck[]): string {
  const mitte = feld.y + feld.hoehe / 2;
  const sichtbar = stuecke.filter((s) => s.str.trim() !== '');

  // 1. Links auf gleicher Höhe: Text endet vor dem Feld, Grundlinie innerhalb der Feldhöhe
  const links = sichtbar
    .filter((s) => {
      const ende = s.x + s.breite;
      return ende <= feld.x + 4 && feld.x - ende < MAX_LINKS && Math.abs(s.y + s.hoehe / 3 - mitte) < Math.max(feld.hoehe, s.hoehe);
    })
    .sort((a, b) => b.x - a.x);
  if (links.length) return zeile(links.reverse()).slice(-120);

  // 2. Darüber: Text liegt waagerecht im Bereich des Feldes, knapp oberhalb
  const darueber = sichtbar.filter((s) => {
    const abstand = s.y - (feld.y + feld.hoehe);
    const ueberlappt = s.x < feld.x + feld.breite && s.x + s.breite > feld.x - 10;
    return abstand >= -2 && abstand < MAX_DARUEBER && ueberlappt;
  });
  if (darueber.length) {
    const naechsteY = Math.min(...darueber.map((s) => s.y));
    return zeile(darueber.filter((s) => Math.abs(s.y - naechsteY) < 3).sort((a, b) => a.x - b.x)).slice(0, 120);
  }

  // 3. Rechts daneben (typisch bei Kästchen: "☐ Ich bin verheiratet")
  const rechts = sichtbar
    .filter((s) => s.x >= feld.x + feld.breite - 2 && s.x - (feld.x + feld.breite) < 40 && Math.abs(s.y + s.hoehe / 3 - mitte) < Math.max(feld.hoehe, s.hoehe))
    .sort((a, b) => a.x - b.x);
  if (rechts.length) return zeile(rechts).slice(0, 120);

  return '';
}

function zeile(stuecke: Stueck[]): string {
  return stuecke
    .map((s) => s.str.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
