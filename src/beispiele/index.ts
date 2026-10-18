// Beispieldokumente der Demo. Die Dateien liegen in public/beispiele/ (scripts/beispiele-erzeugen.mjs,
// Scan: scripts/scan-vorlage.html). Alle Personen, Nummern und Absender sind erfunden.
// Die Antworten der KI werden einmal vorab erzeugt (Seite /werkstatt, nur in der Entwicklung)
// und liegen in src/beispiele/antworten/<id>.json.

export type BeispielArt = 'brief' | 'formular' | 'scan';

export interface Beispiel {
  id: string;
  titel: string;
  kurz: string; // ein Satz, was man daran sieht
  datei: string; // Pfad unter public/
  art: BeispielArt;
}

export const BEISPIELE: Beispiel[] = [
  {
    id: 'jobcenter-mitwirkung',
    titel: 'Jobcenter: Unterlagen fehlen',
    kurz: 'Frist, Forderung und die Folgen, die das Jobcenter androht.',
    datei: '/beispiele/jobcenter-mitwirkung.pdf',
    art: 'brief',
  },
  {
    id: 'krankenkasse-familienversicherung',
    titel: 'Krankenkasse: Familienversicherung',
    kurz: 'Zwei Personen im Brief. Die Schwärzung hält sie auseinander.',
    datei: '/beispiele/krankenkasse-familienversicherung.pdf',
    art: 'brief',
  },
  {
    id: 'stadtwerke-jahresabrechnung',
    titel: 'Stadtwerke: Jahresabrechnung',
    kurz: 'Keine Nachzahlung, aber eine Bitte mit Frist.',
    datei: '/beispiele/stadtwerke-jahresabrechnung.pdf',
    art: 'brief',
  },
  {
    id: 'wohngeld-antrag',
    titel: 'Wohngeld: Formular am Bildschirm ausfüllen',
    kurz: 'PDF mit Eingabefeldern. Jedes Feld wird erklärt, ausgefüllt wird auf Ihrem Gerät.',
    datei: '/beispiele/wohngeld-antrag.pdf',
    art: 'formular',
  },
  {
    id: 'scan-rundfunkbeitrag',
    titel: 'Gescanntes Papierformular',
    kurz: 'Ein Foto oder Scan. Texterkennung im Browser, ausgefüllt wird von Hand.',
    datei: '/beispiele/scan-rundfunkbeitrag.png',
    art: 'scan',
  },
];

/** Gespeicherte Antwort: genau der Text, den die KI bekommen hat, und ihre Antwort. */
export interface GespeicherteAntwort {
  id: string;
  erzeugt: string; // Datum
  modell: string;
  gesendet: string;
  antwort: unknown; // erklaerung, hilfe oder scan, je nach Art
}

const dateien = import.meta.glob<GespeicherteAntwort>('./antworten/*.json', { eager: true, import: 'default' });

export function gespeicherteAntwort(id: string): GespeicherteAntwort | null {
  return dateien[`./antworten/${id}.json`] ?? null;
}
