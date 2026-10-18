// Gemeinsame Teile der Server-Routen: Schlüssel, Antworten, Prüfungen, KI-Aufruf.
// Läuft nur auf dem Server. Protokolliert nie Inhalte, nur Fehlerarten.
import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';
import { pruefeLimit } from './limit';

// Wichtig: nur process.env, nie import.meta.env. Astro schreibt import.meta.env beim Bauen fest in den
// Server-Code, der Schlüssel stünde dann in dist/server. process.env wird erst beim Ausführen gelesen.
// In der Entwicklung füllt astro.config.mjs process.env aus der Datei .env.
export const MODELL = process.env.BRIEFHELFER_MODELL || 'claude-opus-5-5';

let client: Anthropic | null = null;
function anthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client ??= new Anthropic({ apiKey, maxRetries: 1, timeout: 180_000 });
  return client;
}

export const antwort = (status: number, daten: unknown) =>
  new Response(JSON.stringify(daten), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export const fehler = (status: number, meldung: string) => antwort(status, { fehler: meldung });

/** Nur Anfragen von der eigenen Seite. Gibt eine Fehlerantwort zurück oder null. */
export function pruefeHerkunft(request: Request): Response | null {
  const herkunft = request.headers.get('origin');
  if (herkunft && new URL(herkunft).host !== new URL(request.url).host) {
    return fehler(403, 'Diese Anfrage ist nicht erlaubt.');
  }
  return null;
}

export function pruefeTageslimit(adresse: string): { antwort: Response | null; verbleibend: number } {
  // In der Entwicklung kein Tageslimit (Werkstatt, Prüfsatz). Kosten begrenzt das Limit in der Anthropic Console.
  if (import.meta.env.DEV) return { antwort: null, verbleibend: 99 };
  const limit = pruefeLimit(adresse);
  return limit.erlaubt
    ? { antwort: null, verbleibend: limit.verbleibend }
    : { antwort: fehler(429, 'Sie haben heute schon 5 Dokumente erklären lassen. Morgen geht es wieder.'), verbleibend: 0 };
}

/**
 * Ruft Claude mit festem Antwortformat auf und prüft die Antwort gegen das Schema.
 * Gibt entweder die Daten oder eine fertige Fehlerantwort zurück.
 */
export async function frageKi<T>(opts: {
  route: string;
  system: string;
  nachricht: string;
  jsonSchema: Record<string, unknown>;
  schema: z.ZodType<T>;
}): Promise<{ daten: T } | { antwort: Response }> {
  const ki = anthropic();
  if (!ki) return { antwort: fehler(503, 'Der Briefhelfer ist gerade nicht eingerichtet.') };

  try {
    const r = await ki.beta.messages.create({
      model: MODELL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: opts.jsonSchema } },
      system: opts.system,
      messages: [{ role: 'user', content: opts.nachricht }],
    });

    if (r.stop_reason === 'refusal') return { antwort: fehler(422, 'Dieses Dokument kann leider nicht erklärt werden.') };
    if (r.stop_reason === 'max_tokens') {
      return { antwort: fehler(502, 'Die Antwort war zu lang. Bitte versuchen Sie es mit weniger Seiten.') };
    }

    const block = r.content.find((b) => b.type === 'text');
    let roh: unknown = null;
    try {
      roh = block && 'text' in block ? JSON.parse(block.text) : null;
    } catch {
      roh = null;
    }
    const geprueft = opts.schema.safeParse(roh);
    if (!geprueft.success) {
      return { antwort: fehler(502, 'Die Antwort konnte nicht gelesen werden. Bitte noch einmal versuchen.') };
    }
    return { daten: geprueft.data };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      console.error(`[${opts.route}] rate limit`);
      return { antwort: fehler(503, 'Gerade sind zu viele Anfragen unterwegs. Bitte in einer Minute noch einmal.') };
    }
    if (e instanceof Anthropic.AuthenticationError) {
      console.error(`[${opts.route}] API-Schlüssel ungültig`);
      return { antwort: fehler(503, 'Der Briefhelfer ist gerade nicht eingerichtet.') };
    }
    if (e instanceof Anthropic.APIError) console.error(`[${opts.route}] API-Fehler ${e.status}`);
    else console.error(`[${opts.route}] unerwarteter Fehler`, e instanceof Error ? e.name : typeof e);
    return { antwort: fehler(502, 'Es ist ein Fehler aufgetreten. Bitte später noch einmal versuchen.') };
  }
}
