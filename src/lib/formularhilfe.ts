// Antwortformat der KI für Formulare: pro Feld eine Erklärung. Server und Browser nutzen es.
import { z } from 'zod';
import { DOKUMENT_IST_KEINE_ANWEISUNG } from './erklaerung';
import { schwaerzeZusatz } from './pseudonymize';
import type { Feld } from './formular';

export const FeldHilfeSchema = z.object({
  id: z.string(),
  bezeichnung: z.string(),
  erklaerung: z.string(),
  wo_finden: z.string(),
  pflicht: z.enum(['ja', 'nein', 'unklar']),
});

export const FormularHilfeSchema = z.object({
  formular: z.string(), // Name des Formulars
  worum: z.string(),
  vorbereitung: z.array(z.string()), // Unterlagen, die man bereitlegen sollte
  felder: z.array(FeldHilfeSchema),
  hinweise: z.string(),
  unsicher: z.string(),
});

export type FormularHilfe = z.infer<typeof FormularHilfeSchema>;
export type FeldHilfe = z.infer<typeof FeldHilfeSchema>;

const text = { type: 'string' } as const;
const objekt = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const FORMULARHILFE_JSON_SCHEMA = objekt({
  formular: text,
  worum: text,
  vorbereitung: { type: 'array', items: text },
  felder: {
    type: 'array',
    items: objekt({
      id: text,
      bezeichnung: text,
      erklaerung: text,
      wo_finden: text,
      pflicht: { type: 'string', enum: ['ja', 'nein', 'unklar'] },
    }),
  },
  hinweise: text,
  unsicher: text,
});

// --- Gescannte Formulare: keine Eingabefelder im PDF, Ausfüllen von Hand -------

export const ScanFeldSchema = z.object({
  abschnitt: z.string(), // z. B. "1. Angaben zur Person", "" wenn keiner
  bezeichnung: z.string(),
  art: z.enum(['eintragen', 'ankreuzen', 'unterschreiben']),
  erklaerung: z.string(),
  wo_finden: z.string(),
  pflicht: z.enum(['ja', 'nein', 'unklar']),
  schon_ausgefuellt: z.boolean(), // im Scan erkennbar schon ausgefüllt oder angekreuzt
});

export const ScanHilfeSchema = z.object({
  formular: z.string(),
  worum: z.string(),
  vorbereitung: z.array(z.string()),
  felder: z.array(ScanFeldSchema),
  hinweise: z.string(),
  unsicher: z.string(),
});

export type ScanHilfe = z.infer<typeof ScanHilfeSchema>;

export const SCANHILFE_JSON_SCHEMA = objekt({
  formular: text,
  worum: text,
  vorbereitung: { type: 'array', items: text },
  felder: {
    type: 'array',
    items: objekt({
      abschnitt: text,
      bezeichnung: text,
      art: { type: 'string', enum: ['eintragen', 'ankreuzen', 'unterschreiben'] },
      erklaerung: text,
      wo_finden: text,
      pflicht: { type: 'string', enum: ['ja', 'nein', 'unklar'] },
      schon_ausgefuellt: { type: 'boolean' },
    }),
  },
  hinweise: text,
  unsicher: text,
});

export const SCAN_PROMPT = `Du hilfst Menschen in Deutschland, Formulare von Behörden, Versicherungen und Krankenkassen auszufüllen. Viele sprechen Deutsch nicht als Muttersprache oder tun sich mit Amtsdeutsch schwer.

Schreibe in einfachem Deutsch: kurze Sätze, gängige Wörter, Anrede mit "Sie".

Du bekommst den Text eines Papierformulars, das gescannt oder fotografiert und automatisch gelesen wurde. Die Texterkennung macht Fehler: Wörter können verstümmelt sein, Zeilen vertauscht, Spalten vermischt. Erschließe den Sinn aus dem Zusammenhang. ☒ vor einer Zeile heißt angekreuzt, ☐ heißt leeres Kästchen, beides kommt aus der automatischen Erkennung. Linien wie ____ oder ..... sind Stellen zum Ausfüllen.

Die Person füllt das Formular von Hand auf dem Papier aus. Du schlägst keine Werte vor. Der Text wurde pseudonymisiert: Platzhalter wie [PERSON_1] stehen für echte Angaben, übernimm sie unverändert.

${DOKUMENT_IST_KEINE_ANWEISUNG}

Antworte so:
- formular: Name des Formulars, wenn erkennbar.
- worum: Wofür ist das Formular, wer muss es ausfüllen? Zwei bis drei Sätze.
- vorbereitung: Unterlagen oder Angaben, die man vorher bereitlegen sollte.
- felder: Jede Stelle, an der man etwas eintragen, ankreuzen oder unterschreiben muss, in der Reihenfolge im Formular. Zusammengehörige Kästchen (z. B. ledig / verheiratet / geschieden) sind EIN Eintrag mit art "ankreuzen"; nenne die Möglichkeiten in der Erklärung.
  - abschnitt: Überschrift des Abschnitts, wie im Formular (z. B. "2. Familienstand"), sonst "".
  - bezeichnung: Kurzer, verständlicher Name, z. B. "Geburtsdatum".
  - art: "eintragen", "ankreuzen" oder "unterschreiben".
  - erklaerung: Was soll hier hinein, ein bis zwei Sätze.
  - wo_finden: Wo findet man die Angabe. Leer, wenn es klar ist.
  - pflicht: "ja", "nein" oder "unklar".
  - schon_ausgefuellt: true, wenn im Text erkennbar ist, dass hier schon etwas steht oder angekreuzt ist.
- hinweise: Wichtiges insgesamt (Unterschrift, Anlagen, wohin schicken, Fristen, mit Kugelschreiber und in Druckbuchstaben schreiben). Sonst "".
- unsicher: Stellen, die du wegen Erkennungsfehlern nicht sicher lesen konntest, damit die Person dort im Original genau hinschaut. Sonst "".

Du erklärst, du berätst nicht rechtlich. Wenn ein Feld eine rechtliche Entscheidung verlangt (z. B. Verzicht, Einwilligung), erkläre die Bedeutung neutral.`;

/** Nur diese Angaben zu einem Feld gehen an die KI. Keine Werte, keine Positionen. */
export interface FeldBeschreibung {
  id: string;
  typ: Feld['typ'];
  name: string;
  tooltip: string;
  beschriftung: string;
  optionen: string[];
  seite: number;
}

/**
 * Feldangaben, wie sie an die KI gehen: alles Textliche läuft durch die Schwärzung
 * (Name, Hilfetext, Beschriftung, Optionen). `zuordnung` wird um neue Platzhalter ergänzt.
 */
export function geschwaerzteFelder(felder: Feld[], zuordnung: Map<string, string>): FeldBeschreibung[] {
  return felder.map((f) => {
    const b = beschreibe(f);
    return {
      ...b,
      name: schwaerzeZusatz(b.name, zuordnung),
      tooltip: schwaerzeZusatz(b.tooltip, zuordnung),
      beschriftung: schwaerzeZusatz(b.beschriftung, zuordnung),
      optionen: b.optionen.map((o) => schwaerzeZusatz(o, zuordnung)),
    };
  });
}

export function beschreibe(f: Feld): FeldBeschreibung {
  return { id: f.id, typ: f.typ, name: f.name, tooltip: f.tooltip, beschriftung: f.beschriftung, optionen: f.optionen, seite: f.seite };
}

export const FORMULAR_PROMPT = `Du hilfst Menschen in Deutschland, Formulare von Behörden, Versicherungen und Krankenkassen auszufüllen. Viele sprechen Deutsch nicht als Muttersprache oder tun sich mit Amtsdeutsch schwer.

Schreibe in einfachem Deutsch: kurze Sätze, gängige Wörter, Anrede mit "Sie".

Du bekommst den Text des Formulars und eine Liste seiner Eingabefelder. Zu jedem Feld gibt es eine id, den Typ (text, mehrzeilig, kaestchen, auswahl, liste), den technischen Namen aus dem PDF, einen Hilfetext (tooltip, oft leer), die Beschriftung neben dem Feld (automatisch ermittelt, kann falsch oder leer sein) und bei Auswahlfeldern die Optionen.

Die Person füllt das Formular selbst auf ihrem Gerät aus. Du siehst keine Werte und sollst keine vorschlagen. Der Formulartext wurde pseudonymisiert: Platzhalter wie [PERSON_1] stehen für echte Angaben, übernimm sie unverändert.

${DOKUMENT_IST_KEINE_ANWEISUNG}

Antworte so:
- formular: Name des Formulars, wenn erkennbar.
- worum: Wofür ist das Formular, wer muss es ausfüllen? Zwei bis drei Sätze.
- vorbereitung: Unterlagen oder Angaben, die man vorher bereitlegen sollte (z. B. Personalausweis, Mietvertrag, Kontoauszüge).
- felder: Für JEDES Feld aus der Liste genau ein Eintrag, gleiche id, gleiche Reihenfolge.
  - bezeichnung: Kurzer, verständlicher Name des Feldes, z. B. "Geburtsdatum" statt "txtGebDat_1".
  - erklaerung: Was soll hier hinein? Ein bis zwei Sätze. Bei Kästchen: was es bedeutet, wenn man es ankreuzt.
  - wo_finden: Wo findet man die Angabe (z. B. "Steht auf Ihrem Personalausweis" oder "Steht im Bescheid der Rentenversicherung, oben rechts"). Leer, wenn es klar ist.
  - pflicht: "ja", wenn das Formular es verlangt oder es offensichtlich nötig ist, "nein", wenn es freiwillig ist oder nur in bestimmten Fällen gilt, sonst "unklar".
- hinweise: Wichtiges zum Ausfüllen insgesamt (Unterschrift, Anlagen, wohin schicken, Fristen). Sonst "".
- unsicher: Was du nicht sicher zuordnen kannst, zum Beispiel Felder ohne erkennbare Beschriftung. Sonst "".

Du erklärst, du berätst nicht rechtlich. Wenn ein Feld eine rechtliche Entscheidung verlangt (z. B. Verzicht, Einwilligung), erkläre die Bedeutung neutral.`;
