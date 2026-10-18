// Erkennt persönliche Daten in deutschen Briefen und ersetzt sie durch Platzhalter.
// Läuft komplett im Browser. Die Zuordnung Platzhalter -> Original verlässt das Gerät nie.
//
// Bewusst NICHT ersetzt: Fristen, Beträge, Behördennamen, Paragrafen.
// Ohne sie kann die KI den Brief nicht erklären.

import { VORNAMEN } from '../data/vornamen';

export type Kategorie =
  | 'IBAN'
  | 'BIC'
  | 'STEUER_ID'
  | 'STEUERNUMMER'
  | 'RV_NUMMER'
  | 'KV_NUMMER'
  | 'AKTENZEICHEN'
  | 'EMAIL'
  | 'TELEFON'
  | 'ADRESSE'
  | 'PLZ_ORT'
  | 'GEBURTSDATUM'
  | 'PERSON'
  | 'MANUELL';

export interface Fund {
  start: number;
  end: number;
  original: string;
  kategorie: Kategorie;
}

export interface Ergebnis {
  text: string; // pseudonymisierter Text
  zuordnung: Map<string, string>; // Platzhalter -> Original
  funde: Fund[];
}

interface Regel {
  kategorie: Kategorie;
  muster: RegExp;
  // Index der Gruppe, die ersetzt wird (0 = ganzer Treffer)
  gruppe?: number;
  // Treffer, auf die dieses Muster passt, werden verworfen
  ausser?: RegExp;
}

const BUCHSTABE = 'A-ZÄÖÜa-zäöüß';
const NAME = `[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?`;
// Namen in Großbuchstaben, wie sie oft im Adressfeld stehen: "DOROTA MUSTER"
const NAME_GROSS = `[A-ZÄÖÜ]{2,}(?:-[A-ZÄÖÜ]{2,})?`;

const STICHWOERTER = [
  'Aktenzeichen', 'Az', 'Geschäftszeichen', 'Ihr Zeichen', 'Unser Zeichen', 'Kassenzeichen',
  'Kundennummer', 'Kunden-?Nr', 'Kundenkonto', 'Konto-?Nr', 'Kontonummer',
  'Mitgliedsnummer', 'Mitglieds-?Nr', 'Personalnummer', 'Personal-?Nr',
  'Versicherungsnummer', 'Versicherungs-?Nr', 'Versicherungsschein(?:nummer|-?Nr)?',
  'Police(?:n)?(?:nummer|-?Nr)?', 'Polizze(?:nnummer)?',
  'Vertragsnummer', 'Vertrags-?Nr', 'Schadennummer', 'Schaden-?Nr',
  'Rechnungsnummer', 'Rechnungs-?Nr', 'Vorgangsnummer', 'Vorgangs-?Nr',
  'Antragsnummer', 'Antrags-?Nr', 'Referenz(?:nummer)?', 'Bedarfsgemeinschaft', 'BG-Nr',
  // Allgemein: jedes Wort auf "-nummer" oder "-Nr" ("BG-Nummer", "Beitragsnummer", "Mandats-Nr")
  '[A-Za-zÄÖÜäöüß-]*nummer', '[A-Za-zÄÖÜäöüß]+-Nr',
].join('|');
const NUMMER_TEIL = `[A-Z0-9.\\/\\-]*\\d[A-Z0-9.\\/\\-]*`;

// Wörter, die zeigen, dass eine Zeile im Adressfeld kein Personenname ist.
// Auch als Wortende: "Krankenkasse", "Rentenversicherung", "Stadtwerke", "Landratsamt".
const KEINE_PERSON =
  /\b(?:GmbH|AG|KG|e\.V|mbH|Stadt|Gemeinde|Kreis|Postfach|Service|Jobcenter|Inkasso)\b|(?:versicherung|kasse|amt|agentur|bank|werke|verwaltung|zentrum|center|gesellschaft|behörde|gericht|verband|stiftung|klinik|praxis)\b/i;

// Reihenfolge zählt: spezifische Muster zuerst.
const REGELN: Regel[] = [
  { kategorie: 'EMAIL', muster: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { kategorie: 'IBAN', muster: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g },
  { kategorie: 'BIC', muster: /\b(?:BIC|SWIFT)[:\s]*([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/g, gruppe: 1 },
  {
    kategorie: 'STEUER_ID',
    muster: /\b(?:Steuer-?ID|Steuerliche Identifikationsnummer|Identifikationsnummer|IdNr\.?)[:\s]*(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})\b/gi,
    gruppe: 1,
  },
  // 11 Ziffern am Stück: sehr wahrscheinlich Steuer-ID. Lieber einmal zu viel schwärzen.
  { kategorie: 'STEUER_ID', muster: /\b\d{11}\b/g },
  { kategorie: 'STEUERNUMMER', muster: /\b(?:Steuernummer|St\.?-?Nr\.?)[:\s]*(\d{2,3}\/\d{3,4}\/\d{4,5})\b/gi, gruppe: 1 },
  { kategorie: 'STEUERNUMMER', muster: /\b\d{2,3}\/\d{3,4}\/\d{4,5}\b/g },
  // Rentenversicherungsnummer: 12 Stellen, z. B. 65 170839 J 003
  { kategorie: 'RV_NUMMER', muster: /\b\d{2}\s?\d{6}\s?[A-Z]\s?\d{3}\b/g },
  // Krankenversichertennummer: Buchstabe + 9 Ziffern
  { kategorie: 'KV_NUMMER', muster: /\b[A-Z]\d{9}\b/g },
  {
    kategorie: 'AKTENZEICHEN',
    // Stichwort, danach eine Nummer. Jeder Teil der Nummer muss eine Ziffer enthalten,
    // damit nicht die folgenden Wörter mitgeschwärzt werden.
    muster: new RegExp(
      // Nummer in derselben Zeile; sonst würde z. B. "Beitragsnummer:" am Zeilenende
      // die Abschnittsnummer "2." der nächsten Zeile schwärzen
      `\\b(?:${STICHWOERTER})\\.?[: \\t]*(${NUMMER_TEIL}(?: ${NUMMER_TEIL}){0,3})`,
      'gi',
    ),
    gruppe: 1,
  },
  {
    kategorie: 'TELEFON',
    muster: /(?:\+49|0049|\b0)[\s\-/]?\(?\d{2,5}\)?[\s\-/]?\d{2,}(?:[\s\-]?\d{2,}){0,3}\b/g,
  },
  {
    kategorie: 'GEBURTSDATUM',
    muster: /\b(?:geb\.?|geboren(?: am)?|Geburtsdatum)[:\s]*(\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4})/gi,
    gruppe: 1,
  },
  {
    kategorie: 'ADRESSE',
    muster: new RegExp(
      `\\b[${BUCHSTABE}][${BUCHSTABE}.\\-]*(?:straße|strasse|str\\.|weg|allee|platz|gasse|ring|damm|ufer|chaussee|steig|pfad)\\s+\\d+\\s?[a-zA-Z]?\\b`,
      'gi',
    ),
  },
  // Nur Leerzeichen innerhalb einer Zeile, nie über Zeilenumbrüche hinweg.
  { kategorie: 'PLZ_ORT', muster: new RegExp(`\\b\\d{5} +${NAME}(?: (?:an der|am|im|bei) ${NAME})?`, 'g') },
  // Namen ohne KI-Modell: nur nach Anrede. Das NER-Modell kommt in Schritt 2 dazu.
  {
    kategorie: 'PERSON',
    muster: new RegExp(
      `\\b(?:Herrn?|Frau|Familie|Eheleute) +((?:(?:Dr|Prof)\\. )?(?:${NAME} ){0,2}${NAME})`,
      'g',
    ),
    gruppe: 1,
  },
  // Gemischte Kennungen aus Großbuchstaben und mindestens 5 Ziffern ("12345BG0067890", "FV2026A4471")
  { kategorie: 'AKTENZEICHEN', muster: /\b(?=(?:[A-Z]*\d){5})(?=[A-Z0-9]*[A-Z])[A-Z0-9]{8,}\b/g },
  // Auffangregel, steht absichtlich zuletzt: lange Ziffernfolgen ohne Stichwort (7+ Ziffern),
  // z. B. Policen- oder Kundennummern. Datumsangaben bleiben sichtbar, Fristen werden gebraucht.
  {
    kategorie: 'AKTENZEICHEN',
    // Nur Leerzeichen, keine Zeilenumbrüche, zwischen den Ziffern.
    muster: /\b[A-Z]{0,4}\d(?:[ .\-\/]?\d){6,}[A-Z]{0,2}\b/g,
    // Kein Treffer, wenn ein Datum drinsteckt ("01.04.2025 0:00")
    // oder es ein Betrag mit Tausenderpunkten ist ("50.000.000", "1.250.000,00").
    ausser: /\d{1,2}\.\d{1,2}\.\d{2,4}|^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/,
  },
];

// Wörter, die nach "Frau/Herr" stehen können, aber keine Namen sind.
const KEINE_NAMEN = new Set(['Doktor', 'Rechtsanwalt', 'Rechtsanwältin', 'Sachbearbeiter', 'Sachbearbeiterin']);

export interface Optionen {
  /** Namen o. Ä., die die Nutzerin selbst eingetragen hat. Werden immer geschwärzt. */
  eigeneAngaben?: string[];
}

export function findePersonendaten(text: string, optionen: Optionen = {}): Fund[] {
  const funde: Fund[] = [];

  for (const regel of REGELN) {
    regel.muster.lastIndex = 0;
    for (const m of text.matchAll(regel.muster)) {
      const g = regel.gruppe ?? 0;
      const wert = m[g];
      if (!wert) continue;
      const start = (m.index ?? 0) + m[0].indexOf(wert);
      const original = wert.trim();
      if (regel.ausser?.test(original)) continue;
      if (regel.kategorie === 'PERSON' && KEINE_NAMEN.has(original.split(' ')[0])) continue;
      funde.push({ start, end: start + original.length, original, kategorie: regel.kategorie });
    }
  }

  funde.push(...namenImAdressfeld(text, funde));
  funde.push(...namenAusVornamenliste(text));
  funde.push(...eigeneAngabenFinden(text, optionen.eigeneAngaben ?? []));

  const erste = ohneUeberlappung(funde);

  // Einmal erkannte Namen auch an anderen Stellen finden ("Frau Müller" ... "Müller").
  const namen = new Set(erste.filter((f) => f.kategorie === 'PERSON').map((f) => f.original));
  for (const name of namen) {
    const teile = [name, ...name.split(' ').filter((t) => t.length > 2 && !t.endsWith('.'))];
    for (const teil of teile) {
      for (const m of text.matchAll(new RegExp(`(?<!\\p{L})${escapeRegex(teil)}(?!\\p{L})`, 'gu'))) {
        const s = m.index ?? 0;
        erste.push({ start: s, end: s + teil.length, original: teil, kategorie: 'PERSON' });
      }
    }
  }

  return ohneUeberlappung(erste);
}

/**
 * Adressfeld: Die ein bis zwei Zeilen direkt über einer erkannten Straße sind meist der Name.
 * "Frau" oder "Herrn" kann davor oder in einer eigenen Zeile stehen.
 */
function namenImAdressfeld(text: string, funde: Fund[]): Fund[] {
  const zeileName = new RegExp(
    `^(?:(?:Herrn?|Frau) +)?((?:(?:Dr|Prof)\\. )?(?:(?:${NAME}|${NAME_GROSS}) +){1,3}(?:${NAME}|${NAME_GROSS}))$`,
  );
  const ergebnis: Fund[] = [];
  for (const strasse of funde.filter((f) => f.kategorie === 'ADRESSE')) {
    let zeilenEnde = text.lastIndexOf('\n', strasse.start - 1);
    for (let i = 0; i < 2 && zeilenEnde > 0; i++) {
      const zeilenStart = text.lastIndexOf('\n', zeilenEnde - 1) + 1;
      const roh = text.slice(zeilenStart, zeilenEnde);
      const zeile = roh.trim();
      const m = zeile.match(zeileName);
      if (m && !KEINE_PERSON.test(zeile)) {
        const start = zeilenStart + roh.indexOf(zeile) + zeile.indexOf(m[1]);
        ergebnis.push({ start, end: start + m[1].length, original: m[1], kategorie: 'PERSON' });
      }
      zeilenEnde = zeilenStart - 1;
    }
  }
  return ergebnis;
}

// Wörter, die nach einem Vornamen stehen können, aber kein Nachname sind.
const KEIN_NACHNAME =
  /^(?:Straße|Strasse|Str|Weg|Allee|Platz|Gasse|Ring|Schule|Kirche|Haus|Klinik|Krankenhaus|Stift|Stiftung|Apotheke|GmbH|AG|KG|Versicherung|Kasse|Bank|Center|Zentrum|Heim|Kindergarten|Kita)$/i;
const STRASSEN_ENDUNG = /(?:straße|strasse|str|weg|allee|platz|gasse|ring|damm|ufer)$/i;
const NAMENSZUSATZ = /^(?:von|van|de|der|den|del|da|di|du|la|le|zu|zur|el|al|bin|ibn|ben)$/i;

/**
 * Personennamen über eine Liste häufiger Vornamen finden:
 * Vorname, ggf. weitere Vornamen, ggf. Zusatz (von, de, al, …), dann ein großgeschriebener Nachname.
 * Ein Vorname allein ("Liebe Ewa,") wird ebenfalls geschwärzt.
 */
function namenAusVornamenliste(text: string): Fund[] {
  const ergebnis: Fund[] = [];
  // Wörter mit Position, nur innerhalb einer Zeile verknüpft
  const woerter = [...text.matchAll(/[\p{L}]+(?:-[\p{L}]+)*/gu)].map((m) => ({
    wort: m[0],
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
  }));

  const istGross = (w: string) => /^\p{Lu}/u.test(w);
  const nurLeerzeichen = (a: number, b: number) => /^ {1,2}$/.test(text.slice(a, b));
  const istVorname = (w: string) =>
    istGross(w) && w.split('-').every((teil) => VORNAMEN.has(teil.toLocaleLowerCase('de')));

  for (let i = 0; i < woerter.length; i++) {
    if (!istVorname(woerter[i].wort)) continue;
    // "Jan." ist meist der Monat
    if (text[woerter[i].end] === '.' && woerter[i].wort.length <= 4) continue;

    let j = i;
    // weitere Vornamen und Zusätze
    while (j + 1 < woerter.length && nurLeerzeichen(woerter[j].end, woerter[j + 1].start)) {
      const naechstes = woerter[j + 1].wort;
      if (istVorname(naechstes) || NAMENSZUSATZ.test(naechstes)) j++;
      else break;
    }
    // Nachname
    if (j + 1 < woerter.length && nurLeerzeichen(woerter[j].end, woerter[j + 1].start)) {
      const n = woerter[j + 1].wort;
      if (istGross(n) && n.length > 1 && !KEIN_NACHNAME.test(n) && !STRASSEN_ENDUNG.test(n)) j++;
    }
    // Zusatz am Ende ("Anna von") gehört nicht dazu
    while (j > i && NAMENSZUSATZ.test(woerter[j].wort)) j--;

    const start = woerter[i].start;
    const end = woerter[j].end;
    ergebnis.push({ start, end, original: text.slice(start, end), kategorie: 'PERSON' });
    i = j;
  }
  return ergebnis;
}

/** Eigene Angaben überall finden, ohne Rücksicht auf Groß-/Kleinschreibung, auch einzelne Namensteile. */
function eigeneAngabenFinden(text: string, angaben: string[]): Fund[] {
  const ergebnis: Fund[] = [];
  const teile = new Set<string>();
  for (const angabe of angaben) {
    const a = angabe.trim();
    if (a.length < 2) continue;
    teile.add(a);
    for (const t of a.split(/\s+/)) if (t.length > 2) teile.add(t);
  }
  for (const teil of teile) {
    for (const m of text.matchAll(new RegExp(`(?<!\\p{L})${escapeRegex(teil)}(?!\\p{L})`, 'giu'))) {
      const s = m.index ?? 0;
      ergebnis.push({ start: s, end: s + m[0].length, original: m[0], kategorie: 'PERSON' });
    }
  }
  return ergebnis;
}

/** Früherer Start gewinnt, bei gleichem Start der längere Treffer. */
function ohneUeberlappung(funde: Fund[]): Fund[] {
  const sortiert = [...funde].sort((a, b) => a.start - b.start || b.end - a.end);
  const ergebnis: Fund[] = [];
  let ende = -1;
  for (const f of sortiert) {
    if (f.start >= ende) {
      ergebnis.push(f);
      ende = f.end;
    }
  }
  return ergebnis;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Ersetzt die Funde durch Platzhalter. Gleiche Werte bekommen denselben Platzhalter. */
export function pseudonymisiere(text: string, funde: Fund[]): Ergebnis {
  const zaehler = new Map<Kategorie, number>();
  const wertZuPlatzhalter = new Map<string, string>();
  const zuordnung = new Map<string, string>();

  const sortiert = [...funde].sort((a, b) => a.start - b.start);
  let ausgabe = '';
  let pos = 0;

  // Volle Namen (mehrere Wörter) zuerst nummerieren. Einzelne Namensteile derselben Person
  // bekommen dann denselben Platzhalter mit Zusatz: "Nowak" -> [PERSON_1_NACHNAME].
  // So erkennt die KI, dass "Herrn Jan Nowak" und "Herr Nowak" dieselbe Person sind.
  const volleNamen: { woerter: string[]; platzhalter: string }[] = [];
  for (const f of sortiert) {
    if (f.kategorie !== 'PERSON' || !/\s/.test(f.original.trim())) continue;
    const schluessel = `PERSON|${normalisiere(f.original)}`;
    if (wertZuPlatzhalter.has(schluessel)) continue;
    const n = (zaehler.get('PERSON') ?? 0) + 1;
    zaehler.set('PERSON', n);
    const platzhalter = `[PERSON_${n}]`;
    wertZuPlatzhalter.set(schluessel, platzhalter);
    zuordnung.set(platzhalter, f.original);
    const woerter = f.original.split(/\s+/).filter((w) => !w.endsWith('.'));
    volleNamen.push({ woerter: woerter.map((w) => w.toLocaleLowerCase('de')), platzhalter });
  }

  for (const f of sortiert) {
    const kat: Kategorie = f.kategorie;
    const schluessel = `${kat}|${normalisiere(f.original)}`;
    let platzhalter = wertZuPlatzhalter.get(schluessel);
    if (!platzhalter && kat === 'PERSON') {
      const teil = f.original.trim().toLocaleLowerCase('de');
      const name = volleNamen.find((v) => v.woerter.includes(teil));
      if (name) {
        const i = name.woerter.indexOf(teil);
        const zusatz = i === name.woerter.length - 1 ? 'NACHNAME' : i === 0 ? 'VORNAME' : 'NAME';
        platzhalter = name.platzhalter.replace(']', `_${zusatz}]`);
        wertZuPlatzhalter.set(schluessel, platzhalter);
        zuordnung.set(platzhalter, f.original);
      }
    }
    if (!platzhalter) {
      const n = (zaehler.get(kat) ?? 0) + 1;
      zaehler.set(kat, n);
      platzhalter = `[${kat}_${n}]`;
      wertZuPlatzhalter.set(schluessel, platzhalter);
      zuordnung.set(platzhalter, f.original);
    }
    ausgabe += text.slice(pos, f.start) + platzhalter;
    pos = f.end;
  }
  ausgabe += text.slice(pos);

  return { text: ausgabe, zuordnung, funde: sortiert };
}

/**
 * Macht den Text für die KI kürzer: Die Leerzeichen, mit denen die Vorschau Spalten nachbaut,
 * werden auf zwei zusammengefasst, Leerzeichen am Zeilenende und mehrfache Leerzeilen entfernt.
 * Zwei Leerzeichen bleiben, damit Spalten noch als getrennt erkennbar sind.
 */
export function kompakt(text: string): string {
  return text
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Ersetzt bereits bekannte echte Angaben in einem weiteren Text durch ihre Platzhalter,
 * z. B. in Feldbeschriftungen eines Formulars. Längere Werte zuerst, damit "Jan Nowak" vor "Nowak" greift.
 */
export function ersetzeBekannte(text: string, zuordnung: Map<string, string>): string {
  const paare = [...zuordnung].sort((a, b) => b[1].length - a[1].length);
  let ergebnis = text;
  for (const [platzhalter, original] of paare) {
    if (original.length < 2) continue;
    ergebnis = ergebnis.replace(new RegExp(`(?<!\\p{L})${escapeRegex(original)}(?!\\p{L})`, 'gu'), platzhalter);
  }
  return ergebnis;
}

/**
 * Schwärzt einen kurzen Zusatztext (Feldname, Beschriftung, Auswahloption) mit derselben Zuordnung:
 * bekannte Angaben bekommen ihren Platzhalter, neu erkannte einen neuen. `zuordnung` wird ergänzt.
 */
export function schwaerzeZusatz(text: string, zuordnung: Map<string, string>): string {
  const bekannt = ersetzeBekannte(text, zuordnung);
  // Bereits gesetzte Platzhalter nicht noch einmal anfassen
  const funde = findePersonendaten(bekannt).filter((f) => !/\[[A-Z_]+_\d+(?:_[A-Z]+)?\]/.test(f.original));
  if (funde.length === 0) return bekannt;

  const hoechste = (kat: string) =>
    Math.max(0, ...[...zuordnung.keys()].map((k) => k.match(new RegExp(`^\\[${kat}_(\\d+)`))?.[1]).filter(Boolean).map(Number));
  let ausgabe = '';
  let pos = 0;
  for (const f of [...funde].sort((a, b) => a.start - b.start)) {
    const vorhanden = [...zuordnung].find(([, wert]) => wert === f.original)?.[0];
    const platzhalter = vorhanden ?? `[${f.kategorie}_${hoechste(f.kategorie) + 1}]`;
    zuordnung.set(platzhalter, f.original);
    ausgabe += bekannt.slice(pos, f.start) + platzhalter;
    pos = f.end;
  }
  return ausgabe + bekannt.slice(pos);
}

/** Setzt in der KI-Antwort die echten Werte wieder ein. Läuft nur lokal. */
export function setzeZurueck(text: string, zuordnung: Map<string, string>): string {
  return text.replace(/\[[A-Z_]+_\d+(?:_[A-Z]+)?\]/g, (ganz) => zuordnung.get(ganz) ?? ganz);
}

function normalisiere(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}
