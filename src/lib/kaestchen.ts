// Findet Ankreuzkästchen auf einem Scan und sagt, ob ein Kreuz drin ist.
// Die Texterkennung liest nur Buchstaben, Kreuze gehen dabei verloren.
// Läuft komplett im Browser auf den Pixeln, das Bild verlässt das Gerät nicht.

export interface Graubild {
  breite: number;
  hoehe: number;
  // RGBA wie bei ImageData
  daten: Uint8ClampedArray | Uint8Array;
}

export interface Kaestchen {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  angekreuzt: boolean;
  fuellung: number; // Anteil dunkler Pixel im Innern, 0 bis 1
}

// Ab diesem Anteil dunkler Pixel im Innern gilt ein Kästchen als angekreuzt.
const KREUZ_AB = 0.06;

// Kästchenrahmen sind auf Scans oft nur hellgrau. Deshalb zählt alles als dunkel,
// was sich deutlich vom Papier abhebt, nicht erst richtig schwarze Tinte.
function schwelleZumPapier(grau: Uint8Array): number {
  const hist = new Array(256).fill(0);
  for (const g of grau) hist[g]++;
  // Papierhelligkeit: 90 % der Pixel sind höchstens so hell
  let n = 0, papier = 255;
  for (let i = 0; i < 256; i++) {
    n += hist[i];
    if (n >= grau.length * 0.9) { papier = i; break; }
  }
  return papier - 25;
}

/**
 * Sucht quadratische Rahmen in passender Größe (1 bis 4 % der Seitenbreite).
 * `massstab` rechnet die Koordinaten zurück, wenn das Bild vorher verkleinert wurde.
 */
export function findeKaestchen(bild: Graubild, massstab = 1): Kaestchen[] {
  const { breite: B, hoehe: H, daten } = bild;
  const grau = new Uint8Array(B * H);
  for (let i = 0; i < B * H; i++) {
    grau[i] = (daten[i * 4] * 299 + daten[i * 4 + 1] * 587 + daten[i * 4 + 2] * 114) / 1000;
  }
  const schwelle = schwelleZumPapier(grau);
  const dunkel = new Uint8Array(B * H);
  for (let i = 0; i < B * H; i++) dunkel[i] = grau[i] < schwelle ? 1 : 0;

  // Präfixsummen je Zeile und je Spalte: Anteil dunkler Pixel auf einer Strecke in O(1)
  const zeile = new Int32Array((B + 1) * H);
  for (let y = 0; y < H; y++) {
    const o = y * (B + 1);
    for (let x = 0; x < B; x++) zeile[o + x + 1] = zeile[o + x] + dunkel[y * B + x];
  }
  const spalte = new Int32Array((H + 1) * B);
  for (let x = 0; x < B; x++) {
    const o = x * (H + 1);
    for (let y = 0; y < H; y++) spalte[o + y + 1] = spalte[o + y] + dunkel[y * B + x];
  }
  const anteilZeile = (y: number, xa: number, xb: number) => {
    if (y < 0 || y >= H) return 0;
    xa = Math.max(0, xa); xb = Math.min(B - 1, xb);
    if (xb < xa) return 0;
    const o = y * (B + 1);
    return (zeile[o + xb + 1] - zeile[o + xa]) / (xb - xa + 1);
  };
  const anteilSpalte = (x: number, ya: number, yb: number) => {
    if (x < 0 || x >= B) return 0;
    ya = Math.max(0, ya); yb = Math.min(H - 1, yb);
    if (yb < ya) return 0;
    const o = x * (H + 1);
    return (spalte[o + yb + 1] - spalte[o + ya]) / (yb - ya + 1);
  };
  // Linien sind auf Scans 1 bis 4 Pixel dick und leicht schief: im Band ±2 den besten Wert nehmen
  const linieWaag = (y: number, xa: number, xb: number) =>
    Math.max(...[-2, -1, 0, 1, 2].map((d) => anteilZeile(y + d, xa, xb)));
  const linieSenk = (x: number, ya: number, yb: number) =>
    Math.max(...[-2, -1, 0, 1, 2].map((d) => anteilSpalte(x + d, ya, yb)));
  // Mittlere Hälfte einer Strecke, für Prüfungen neben dem Rahmen
  const mitte = (a: number, b: number): [number, number] => {
    const v = Math.round((b - a) / 4);
    return [a + v, b - v];
  };

  // Ankreuzkästchen sind auf A4 etwa 3 bis 8 mm groß, also gut 1,2 % bis 4 % der Breite.
  // Kleinere Quadrate sind fast immer Buchstaben wie "O" oder "D".
  const min = Math.max(8, Math.round(B * 0.012));
  const max = Math.round(B * 0.04);
  const funde: (Kaestchen & { guete: number })[] = [];

  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < B) {
      if (!dunkel[y * B + x]) { x++; continue; }
      // Waagrechte dunkle Strecke, Lücken bis 2 Pixel überbrücken
      const start = x;
      let ende = x, luecke = 0;
      while (x < B && luecke <= 2) {
        if (dunkel[y * B + x]) { ende = x; luecke = 0; } else luecke++;
        x++;
      }
      const L = ende - start + 1;
      if (L < min || L > max) continue;
      const x0 = start, x1 = ende;
      if (funde.some((k) => x0 + L / 2 >= k.x0 && x0 + L / 2 <= k.x1 && y >= k.y0 - 3 && y <= k.y1)) continue;

      // Untere Kante etwa eine Seitenlänge tiefer
      let y1 = -1;
      for (let dy = Math.round(L * 0.85); dy <= Math.round(L * 1.15); dy++) {
        if (linieWaag(y + dy, x0, x1) >= 0.8) { y1 = y + dy; break; }
      }
      if (y1 < 0) continue;
      const links = linieSenk(x0, y, y1), rechts = linieSenk(x1, y, y1);
      if (links < 0.7 || rechts < 0.7) continue;

      // Ein echter Rahmen ist eine dünne Linie: ein paar Pixel weiter innen wird es deutlich heller,
      // auch wenn ein Kreuz drin ist. Bei Buchstaben, Logos und Barcodes bleibt es dunkel.
      const t = Math.max(4, Math.round(L * 0.22));
      const kante =
        (linieWaag(y, x0, x1) - anteilZeile(y + t, x0, x1) +
          linieWaag(y1, x0, x1) - anteilZeile(y1 - t, x0, x1) +
          links - anteilSpalte(x0 + t, y, y1) +
          rechts - anteilSpalte(x1 - t, y, y1)) / 4;
      if (kante < 0.3) continue;

      // Ein Kästchen hat vier Ecken. Buchstaben mit Bögen ("o", "S", "e", "b") sind dort rund:
      // nahe der Ecke ist es hell. Ein kleiner Spielraum erlaubt leicht abgerundete Kästchen.
      const r = Math.max(2, Math.round(L * 0.12));
      const ecke = (ex: number, ey: number, sx: number, sy: number) => {
        for (let d = 0; d <= r; d++) {
          // entlang beider Kanten von der Ecke aus: irgendwo nah an der Ecke muss es dunkel sein
          const px = ex + sx * d, py = ey + sy * d;
          for (let q = -2; q <= 2; q++) {
            if (dunkelBei(px, ey + q) && dunkelBei(ex + q, py)) return true;
          }
        }
        return false;
      };
      const dunkelBei = (px: number, py: number) => px >= 0 && py >= 0 && px < B && py < H && dunkel[py * B + px] === 1;
      if (!(ecke(x0, y, 1, 1) && ecke(x1, y, -1, 1) && ecke(x0, y1, 1, -1) && ecke(x1, y1, -1, -1))) continue;

      const [ixa, ixb] = mitte(x0, x1);
      const [iya, iyb] = mitte(y, y1);

      // Gleich außerhalb des Rahmens muss es hell sein, sonst ist es Teil eines Musters (Barcode, Tabelle)
      const aussen =
        (anteilZeile(y - 5, ixa, ixb) + anteilZeile(y1 + 5, ixa, ixb) +
          anteilSpalte(x0 - 5, iya, iyb) + anteilSpalte(x1 + 5, iya, iyb)) / 4;
      if (aussen > 0.35) continue;

      // Innenfläche ohne Rahmen
      const rand = Math.max(4, Math.round(L * 0.2));
      let summe = 0, flaeche = 0;
      for (let yy = y + rand; yy <= y1 - rand; yy++) {
        summe += anteilZeile(yy, x0 + rand, x1 - rand) * (x1 - x0 - 2 * rand + 1);
        flaeche += x1 - x0 - 2 * rand + 1;
      }
      const fuellung = flaeche > 0 ? summe / flaeche : 0;
      // Ein Kreuz füllt das Innere auf Scans zu etwa zwei Dritteln. Noch voller ist es
      // eher ein Buchstabe, ein Logo oder ein Stück Barcode.
      if (fuellung > 0.72) continue;

      const guete = linieWaag(y, x0, x1) + linieWaag(y1, x0, x1) + links + rechts;
      funde.push({ x0, y0: y, x1, y1, angekreuzt: fuellung >= KREUZ_AB, fuellung, guete });
    }
  }

  // Ragt ein Kreuz über den Rahmen, wird dasselbe Kästchen mehrfach gefunden.
  // Dann zählt der Fund mit den saubersten Kanten.
  const behalten: typeof funde = [];
  for (const k of [...funde].sort((a, b) => b.guete - a.guete)) {
    const mx = (k.x0 + k.x1) / 2, my = (k.y0 + k.y1) / 2;
    if (!behalten.some((b) => mx >= b.x0 && mx <= b.x1 && my >= b.y0 && my <= b.y1)) behalten.push(k);
  }
  behalten.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);

  return behalten.map(({ guete: _, ...k }) => ({
    ...k,
    x0: Math.round(k.x0 * massstab),
    y0: Math.round(k.y0 * massstab),
    x1: Math.round(k.x1 * massstab),
    y1: Math.round(k.y1 * massstab),
  }));
}

// Minimale Form der Tesseract-Ausgabe (blocks → paragraphs → lines → words)
export interface Rahmen { x0: number; y0: number; x1: number; y1: number }
export interface Wort { text: string; bbox: Rahmen; confidence: number }
export interface Zeile { words: Wort[]; bbox: Rahmen }

// Zeichen, die Tesseract typischerweise aus einem Kästchen liest
const KAESTCHEN_MUELL = /^[\[\]()|IlO0oDQXx×✓✗☐☒□■*#]/;

/**
 * Ein "B" in "Beispiel", ein "b" in "bitte" oder ein "e" am Ende von "geehrte" sieht bei normaler
 * Schriftgröße aus wie ein Kästchen. Liegt der Fund in einem sicher erkannten Wort, das breiter ist
 * als das Kästchen und mit einem echten Buchstaben statt mit Kästchen-Müll beginnt, war es Text.
 */
function istBuchstabeImWort(w: Wort, k: Kaestchen, halb: number): boolean {
  const text = w.text.trim();
  const mx = (k.x0 + k.x1) / 2;
  return (
    mx >= w.bbox.x0 && mx <= w.bbox.x1 &&
    w.bbox.x1 - w.bbox.x0 > (k.x1 - k.x0) + halb &&
    text.length >= 3 &&
    w.confidence >= 75 &&
    /^\p{L}/u.test(text) &&
    // Ein sehr sicher erkanntes, normal geschriebenes Wort ("Ohne", "Bitte", "oder") ist Text,
    // auch wenn es mit einem Zeichen beginnt, das Tesseract sonst aus Kästchen liest
    (!KAESTCHEN_MUELL.test(text) || (w.confidence >= 85 && /^\p{L}\p{Ll}{2,}[.,;:!?]?$/u.test(text)))
  );
}

export const ZEICHEN_JA = '☒';
export const ZEICHEN_NEIN = '☐';

/**
 * Ordnet jedes Kästchen der Textzeile rechts daneben zu.
 * `istMuell` erkennt, was Tesseract aus dem Kästchen selbst gelesen hat ("X", "O", "[]" …).
 */
export function ordneKaestchenZu(zeilen: Zeile[], alleKaestchen: Kaestchen[]) {
  const woerter = zeilen.flatMap((z) => z.words);

  // Ein Buchstabe wie "N" oder "O" kann wie ein Rahmen aussehen. Liegt der Fund
  // mitten in einem Wort, das deutlich breiter ist, war es Text und kein Kästchen.
  const kaestchen = alleKaestchen.filter((k) => {
    const my = (k.y0 + k.y1) / 2;
    const halb = (k.x1 - k.x0) / 2;
    return !woerter.some(
      (w) =>
        my >= w.bbox.y0 && my <= w.bbox.y1 &&
        ((w.bbox.x0 < k.x0 - halb && w.bbox.x1 > k.x1 + halb) || istBuchstabeImWort(w, k, halb)),
    );
  });
  const imKaestchen = (w: Wort, k: Kaestchen) => {
    const mx = (w.bbox.x0 + w.bbox.x1) / 2, my = (w.bbox.y0 + w.bbox.y1) / 2;
    const r = (k.x1 - k.x0) * 0.25;
    return mx >= k.x0 - r && mx <= k.x1 + r && my >= k.y0 - r && my <= k.y1 + r;
  };

  const zuordnung = new Map<Zeile, Kaestchen>();
  for (const k of kaestchen) {
    const s = k.x1 - k.x0;
    const mitteY = (k.y0 + k.y1) / 2;
    let beste: Zeile | null = null, abstand = Infinity;
    for (const z of zeilen) {
      const dy = Math.abs((z.bbox.y0 + z.bbox.y1) / 2 - mitteY);
      if (dy > k.y1 - k.y0) continue;
      // Die Zeile muss rechts neben dem Kästchen anfangen, nicht weit weg.
      // Wörter links vom Kästchen zählen nicht, das ist oft Randschrift oder Scan-Schmutz.
      const erstes = z.words.find((w) => !imKaestchen(w, k) && w.bbox.x0 >= k.x1 - s * 0.5);
      if (!erstes || erstes.bbox.x0 > k.x1 + s * 6) continue;
      const d = dy + (erstes.bbox.x0 - k.x1) * 0.05;
      if (d < abstand) { abstand = d; beste = z; }
    }
    if (beste && !zuordnung.has(beste)) zuordnung.set(beste, k);
  }

  const zugeordnet = [...zuordnung.values()];
  return { zuordnung, istMuell: (w: Wort) => zugeordnet.some((k) => imKaestchen(w, k)) };
}
