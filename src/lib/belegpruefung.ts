// Prüft lokal, ob ein Zitat der KI wirklich im gesendeten (pseudonymisierten) Text steht.
// Geprüft wird gegen genau den Text, den die KI bekommen hat, also mit Platzhaltern.
//
//   gefunden  – wörtlich vorhanden (nach vorsichtiger Normalisierung von Leerzeichen und Anführungszeichen)
//   aehnlich  – nicht wörtlich, aber eine ähnliche Stelle; beide werden zum Vergleich angezeigt
//   nicht     – keine passende Stelle
//   fehlt     – die KI hat kein Zitat geliefert
//
// Wichtig: "gefunden" heißt nur, dass die Textstelle existiert, nicht, dass die Erklärung stimmt.

export type BelegStatus = 'gefunden' | 'aehnlich' | 'nicht' | 'fehlt';

export interface BelegErgebnis {
  status: BelegStatus;
  stelle: string; // bei "aehnlich": die ähnliche Stelle aus dem Text
}

const MIN_AEHNLICH = 0.6;

function normalisiere(s: string): string {
  return s
    .replace(/[„“”"«»]/g, '"')
    .replace(/[‚‘’']/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('de');
}

// Silbentrennung am Zeilenende entfernen ("Konto-\nauszüge" -> "Kontoauszüge")
function ohneTrennung(s: string): string {
  return s.replace(/(\p{Ll})-[ \t]*\n[ \t]*(\p{Ll})/gu, '$1$2');
}

export function pruefeBeleg(zitat: string, gesendet: string): BelegErgebnis {
  const z = normalisiere(zitat);
  if (!z) return { status: 'fehlt', stelle: '' };

  for (const quelle of [gesendet, ohneTrennung(gesendet)]) {
    if (normalisiere(quelle).includes(z)) return { status: 'gefunden', stelle: '' };
  }

  // Ähnlichste Stelle suchen: Fenster gleicher Wortzahl, Anteil übereinstimmender Wörter
  const quelle = ohneTrennung(gesendet);
  const woerter = [...quelle.matchAll(/\S+/g)].map((m) => ({
    wort: normalisiere(m[0]).replace(/[.,;:!?()"]+$/g, ''),
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
  }));
  const ziel = z.split(' ').map((w) => w.replace(/[.,;:!?()"]+$/g, ''));
  const n = ziel.length;
  if (n === 0 || woerter.length === 0) return { status: 'nicht', stelle: '' };

  let bester = 0;
  let besterStart = 0;
  for (let i = 0; i + Math.min(n, woerter.length) <= woerter.length; i++) {
    const fenster = new Map<string, number>();
    for (let k = i; k < Math.min(i + n, woerter.length); k++) fenster.set(woerter[k].wort, (fenster.get(woerter[k].wort) ?? 0) + 1);
    let treffer = 0;
    for (const w of ziel) {
      const anzahl = fenster.get(w) ?? 0;
      if (anzahl > 0) {
        treffer++;
        fenster.set(w, anzahl - 1);
      }
    }
    const anteil = treffer / n;
    if (anteil > bester) {
      bester = anteil;
      besterStart = i;
    }
  }

  if (bester >= MIN_AEHNLICH) {
    // Etwas Umfeld mit anzeigen, damit z. B. ein abweichendes "nicht" direkt daneben sichtbar ist
    const rand = Math.max(3, Math.ceil(n / 2));
    const anfang = Math.max(0, besterStart - rand);
    const ende = Math.min(besterStart + n + rand, woerter.length) - 1;
    return { status: 'aehnlich', stelle: quelle.slice(woerter[anfang].start, woerter[ende].end).replace(/\s+/g, ' ') };
  }
  return { status: 'nicht', stelle: '' };
}

/**
 * Für Fristen strenger: Das Datum muss in der gefundenen Textstelle selbst stehen,
 * nicht nur irgendwo im Brief. Nur dann darf die Frist in den Kalender.
 */
export function fristBelegt(datum: string, zitat: string, gesendet: string): boolean {
  if (pruefeBeleg(zitat, gesendet).status !== 'gefunden') return false;
  const d = normalisiere(datum);
  return d !== '' && normalisiere(zitat).includes(d);
}
