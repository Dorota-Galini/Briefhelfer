// Brief oder Vertrag erklären. Bekommt nur den pseudonymisierten Text.
import type { APIRoute } from 'astro';
import { ERKLAERUNG_JSON_SCHEMA, ErklaerungSchema, SYSTEM_PROMPT } from '../../lib/erklaerung';
import { antwort, fehler, frageKi, pruefeHerkunft, pruefeTageslimit } from '../../lib/server';

export const prerender = false;

// Etwa 40 Seiten. Längere Dokumente kosten deutlich mehr und dauern zu lange.
const MAX_ZEICHEN = 100_000;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const verboten = pruefeHerkunft(request);
  if (verboten) return verboten;

  let text: unknown;
  try {
    ({ text } = await request.json());
  } catch {
    return fehler(400, 'Die Anfrage war fehlerhaft.');
  }
  if (typeof text !== 'string' || text.trim().length < 20) {
    return fehler(400, 'Es wurde kein Brieftext übermittelt.');
  }
  if (text.length > MAX_ZEICHEN) {
    return fehler(413, 'Das Dokument ist zu lang (mehr als etwa 40 Seiten). Bitte nur die wichtigen Seiten verwenden.');
  }

  const limit = pruefeTageslimit(clientAddress);
  if (limit.antwort) return limit.antwort;

  const r = await frageKi({
    route: 'erklaeren',
    system: SYSTEM_PROMPT,
    nachricht: `Bitte erkläre diesen Brief:\n\n<brief>\n${text}\n</brief>`,
    jsonSchema: ERKLAERUNG_JSON_SCHEMA,
    schema: ErklaerungSchema,
  });
  if ('antwort' in r) return r.antwort;
  return antwort(200, { erklaerung: r.daten, verbleibend: limit.verbleibend });
};
