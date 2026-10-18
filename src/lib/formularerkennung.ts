// Schätzt, ob ein Text (meist aus einem Scan) ein Formular zum Ausfüllen ist und kein Brief.
// Die Person kann die Einschätzung in der Oberfläche jederzeit ändern.

export interface Einschaetzung {
  istFormular: boolean;
  punkte: number;
  gruende: string[];
}

const SCHWELLE = 4;

export function schaetzeFormular(text: string): Einschaetzung {
  const gruende: string[] = [];
  let punkte = 0;
  const zaehle = (re: RegExp) => (text.match(re) ?? []).length;

  // Kästchen aus der Erkennung (☐ leer, ☒ angekreuzt) oder als Zeichen im Text
  const kaestchen = zaehle(/[☐☒□■◻▢]/g);
  if (kaestchen >= 3) {
    punkte += kaestchen >= 8 ? 4 : 2;
    gruende.push(`${kaestchen} Kästchen`);
  }

  // Linien zum Ausfüllen: ______ oder ........ oder – – – –
  const linien = zaehle(/_{5,}|\.{8,}|(?:[–-] ){4,}/g);
  if (linien >= 2) {
    punkte += linien >= 6 ? 3 : 2;
    gruende.push(`${linien} Linien zum Ausfüllen`);
  }

  // Beschriftungen mit Doppelpunkt am Zeilenende ("Geburtsdatum:" und dann nichts)
  const leereBeschriftungen = zaehle(/^[^\n]{2,40}:[ \t]*$/gm);
  if (leereBeschriftungen >= 4) {
    punkte += 2;
    gruende.push(`${leereBeschriftungen} leere Beschriftungen`);
  }

  // Typische Formularwörter
  const woerter = [
    /\bAntrag\b/i,
    /\bbitte\s+(?:vollständig\s+)?ausfüllen\b/i,
    /\bzutreffendes\s+(?:bitte\s+)?ankreuzen\b/i,
    /\bDatum,?\s+Unterschrift\b/i,
    /\bOrt,?\s+Datum\b/i,
    /\bin\s+Druckbuchstaben\b/i,
    /\bAnlage\s+[A-Z0-9]/,
    /\bErklärung\b/i,
    /\bFormular\b/i,
    /\b(?:ja|nein)\s*[☐☒□]/i,
  ];
  const treffer = woerter.filter((w) => w.test(text)).length;
  if (treffer) {
    punkte += Math.min(treffer, 3);
    gruende.push(`${treffer} typische Formularwörter`);
  }

  // Briefe beginnen mit Anrede und enden mit Grußformel
  if (/\bSehr geehrte[rn]?\b/.test(text) && /\bMit freundlichen Grüßen\b/i.test(text)) {
    punkte -= 2;
    gruende.push('Anrede und Grußformel wie in einem Brief');
  }

  return { istFormular: punkte >= SCHWELLE, punkte, gruende };
}
