// Formularfelder erklären. Bekommt den pseudonymisierten Formulartext und die Feldliste, nie Werte.
import type { APIRoute } from 'astro';
import {
  FORMULARHILFE_JSON_SCHEMA,
  FORMULAR_PROMPT,
  FormularHilfeSchema,
  SCAN_PROMPT,
  SCANHILFE_JSON_SCHEMA,
  ScanHilfeSchema,
  type FeldBeschreibung,
} from '../../lib/formularhilfe';
import { antwort, fehler, frageKi, pruefeHerkunft, pruefeTageslimit } from '../../lib/server';

export const prerender = false;

const MAX_ZEICHEN = 100_000;
const MAX_FELDER = 300;
const TYPEN = new Set(['text', 'mehrzeilig', 'kaestchen', 'auswahl', 'liste']);

function istFeld(f: unknown): f is FeldBeschreibung {
  if (!f || typeof f !== 'object') return false;
  const o = f as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.typ === 'string' &&
    TYPEN.has(o.typ) &&
    typeof o.tooltip === 'string' &&
    typeof o.beschriftung === 'string' &&
    typeof o.seite === 'number' &&
    Array.isArray(o.optionen) &&
    o.optionen.every((x) => typeof x === 'string')
  );
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const verboten = pruefeHerkunft(request);
  if (verboten) return verboten;

  let text: unknown;
  let felder: unknown;
  let art: unknown;
  try {
    ({ text, felder, art } = await request.json());
  } catch {
    return fehler(400, 'Die Anfrage war fehlerhaft.');
  }

  // Gescanntes Papierformular: nur Text, die Person füllt von Hand aus
  if (art === 'scan') {
    if (typeof text !== 'string' || text.trim().length < 20) return fehler(400, 'Es wurde kein Formular übermittelt.');
    if (text.length > MAX_ZEICHEN) return fehler(413, 'Das Formular ist zu lang (mehr als etwa 40 Seiten).');
    const limit = pruefeTageslimit(clientAddress);
    if (limit.antwort) return limit.antwort;
    const r = await frageKi({
      route: 'formular-scan',
      system: SCAN_PROMPT,
      nachricht: `Gescanntes Formular (automatisch gelesen):\n<formular>\n${text}\n</formular>`,
      jsonSchema: SCANHILFE_JSON_SCHEMA,
      schema: ScanHilfeSchema,
    });
    if ('antwort' in r) return r.antwort;
    return antwort(200, { scan: r.daten, verbleibend: limit.verbleibend });
  }

  if (typeof text !== 'string' || !Array.isArray(felder) || felder.length === 0 || !felder.every(istFeld)) {
    return fehler(400, 'Es wurde kein Formular übermittelt.');
  }
  if (felder.length > MAX_FELDER) return fehler(413, `Das Formular hat mehr als ${MAX_FELDER} Felder.`);
  // Nur erlaubte Angaben weitergeben, alles andere (z. B. versehentlich mitgeschickte Werte) fällt weg
  const sauber: FeldBeschreibung[] = felder.map(({ id, typ, name, tooltip, beschriftung, optionen, seite }) => ({
    id, typ, name, tooltip, beschriftung, optionen, seite,
  }));
  const nachricht =
    `Formulartext:\n<formular>\n${text}\n</formular>\n\n` +
    `Eingabefelder (JSON):\n<felder>\n${JSON.stringify(sauber)}\n</felder>`;
  if (nachricht.length > MAX_ZEICHEN) {
    return fehler(413, 'Das Formular ist zu lang (mehr als etwa 40 Seiten).');
  }

  const limit = pruefeTageslimit(clientAddress);
  if (limit.antwort) return limit.antwort;

  const r = await frageKi({
    route: 'formular',
    system: FORMULAR_PROMPT,
    nachricht,
    jsonSchema: FORMULARHILFE_JSON_SCHEMA,
    schema: FormularHilfeSchema,
  });
  if ('antwort' in r) return r.antwort;

  // Nur Erklärungen zu Feldern zurückgeben, die es wirklich gibt
  const ids = new Set(felder.map((f) => f.id));
  const hilfe = { ...r.daten, felder: r.daten.felder.filter((f) => ids.has(f.id)) };
  return antwort(200, { hilfe, verbleibend: limit.verbleibend });
};
