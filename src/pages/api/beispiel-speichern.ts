// Nur in der Entwicklung: speichert eine vorab erzeugte Antwort für die Demo
// nach src/beispiele/antworten/<id>.json. Im gebauten Projekt antwortet die Route immer mit 404.
import type { APIRoute } from 'astro';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BEISPIELE } from '../../beispiele';
import { MODELL, antwort, fehler, pruefeHerkunft } from '../../lib/server';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.DEV) return new Response('Not found', { status: 404 });
  const verboten = pruefeHerkunft(request);
  if (verboten) return verboten;

  const { id, gesendet, antwort: inhalt } = await request.json();
  if (!BEISPIELE.some((b) => b.id === id) || typeof gesendet !== 'string' || !inhalt) {
    return fehler(400, 'Unbekanntes Beispiel oder leere Antwort.');
  }
  mkdirSync('src/beispiele/antworten', { recursive: true });
  const daten = { id, erzeugt: new Date().toISOString().slice(0, 10), modell: MODELL, gesendet, antwort: inhalt };
  writeFileSync(`src/beispiele/antworten/${id}.json`, JSON.stringify(daten, null, 2) + '\n', 'utf-8');
  return antwort(200, { gespeichert: `src/beispiele/antworten/${id}.json` });
};
