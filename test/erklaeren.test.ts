import { beforeEach, describe, expect, it, vi } from 'vitest';
import { baueIcs } from '../src/lib/kalender';

// Claude API nachbilden: kein echter Schlüssel, keine Kosten.
const create = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    status = 500;
  }
  class RateLimitError extends APIError {}
  class AuthenticationError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    static AuthenticationError = AuthenticationError;
    beta = { messages: { create } };
  }
  return { default: Anthropic };
});

const BEISPIEL = {
  absender: 'Jobcenter Musterkreis',
  worum: 'Ihr Antrag ist unvollständig, [PERSON_1].',
  forderungen: [{ text: 'Das Jobcenter verlangt Kontoauszüge.', beleg: 'Bitte bis 30.10.2026 einreichen.', unsicher: '' }],
  fristen: [
    { datum: '30.10.2026', datum_iso: '2026-10-30', was: 'Kontoauszüge einreichen', beleg: 'Bitte bis 30.10.2026 einreichen.', unsicher: '' },
  ],
  folgen: [{ text: 'Laut Brief kann die Leistung versagt werden.', beleg: '', unsicher: 'Steht nicht direkt im Brief.' }],
  begriffe: [{ wort: 'Mitwirkungspflicht', erklaerung: 'Sie müssen Unterlagen liefern.' }],
  unsicher: '',
};

const anfrage = (body: unknown, origin = 'http://localhost:4321') =>
  new Request('http://localhost:4321/api/erklaeren', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  });

const TEXT = 'Sehr geehrter Herr [PERSON_1], Ihr Antrag ist unvollständig. Bitte bis 30.10.2026 einreichen.';

async function route() {
  vi.resetModules();
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-schluessel');
  vi.stubEnv('DEV', false); // wie im echten Betrieb, mit Tageslimit
  return (await import('../src/pages/api/erklaeren')).POST;
}

describe('/api/erklaeren', () => {
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify(BEISPIEL) }],
    });
  });

  it('gibt die geprüfte Erklärung zurück und schickt nur den übergebenen Text', async () => {
    const POST = await route();
    const r = await POST({ request: anfrage({ text: TEXT }), clientAddress: '1.1.1.1' } as never);
    expect(r.status).toBe(200);
    const daten = await r.json();
    expect(daten.erklaerung.worum).toContain('[PERSON_1]');
    expect(daten.verbleibend).toBe(4);

    const aufruf = create.mock.calls[0][0];
    expect(aufruf.model).toBe('claude-opus-5-5');
    expect(aufruf.fallbacks).toBe('default');
    expect(aufruf.output_config.format.type).toBe('json_schema');
    expect(aufruf.messages[0].content).toContain(TEXT);
  });

  it('lehnt fremde Herkunft, zu kurzen und zu langen Text ab', async () => {
    const POST = await route();
    const ctx = (req: Request) => ({ request: req, clientAddress: '2.2.2.2' }) as never;
    expect((await POST(ctx(anfrage({ text: TEXT }, 'https://boese.example')))).status).toBe(403);
    expect((await POST(ctx(anfrage({ text: 'kurz' })))).status).toBe(400);
    expect((await POST(ctx(anfrage({ text: 'x'.repeat(100_001) })))).status).toBe(413);
    expect(create).not.toHaveBeenCalled();
  });

  it('begrenzt auf 5 Anfragen pro Tag', async () => {
    const POST = await route();
    const ctx = () => ({ request: anfrage({ text: TEXT }), clientAddress: '3.3.3.3' }) as never;
    for (let i = 0; i < 5; i++) expect((await POST(ctx())).status).toBe(200);
    expect((await POST(ctx())).status).toBe(429);
  });

  it('meldet Ablehnung und unlesbare Antwort verständlich', async () => {
    const POST = await route();
    create.mockResolvedValueOnce({ stop_reason: 'refusal', content: [] });
    expect((await POST({ request: anfrage({ text: TEXT }), clientAddress: '4.4.4.4' } as never)).status).toBe(422);
    create.mockResolvedValueOnce({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"falsch":1}' }] });
    expect((await POST({ request: anfrage({ text: TEXT }), clientAddress: '4.4.4.4' } as never)).status).toBe(502);
  });

  it('ohne Schlüssel: verständliche Meldung statt Absturz', async () => {
    vi.resetModules();
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const { POST } = await import('../src/pages/api/erklaeren');
    const r = await POST({ request: anfrage({ text: TEXT }), clientAddress: '5.5.5.5' } as never);
    expect(r.status).toBe(503);
  });
});

describe('baueIcs', () => {
  it('erzeugt ganztägige Termine mit Erinnerung, ohne ungültige Daten', () => {
    const ics = baueIcs(
      [
        { datumIso: '2026-10-30', titel: 'Frist: Unterlagen, bitte' },
        { datumIso: '', titel: 'innerhalb eines Monats' },
      ],
      new Date('2026-10-18T10:00:00Z'),
    );
    expect(ics).toContain('DTSTART;VALUE=DATE:20261030');
    expect(ics).toContain('DTEND;VALUE=DATE:20261031');
    expect(ics).toContain('SUMMARY:Frist: Unterlagen\\, bitte');
    expect(ics).toContain('TRIGGER:-P3D');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it('passt die Erinnerung an knappe Fristen an', () => {
    const jetzt = new Date('2026-10-18T10:00:00');
    expect(baueIcs([{ datumIso: '2026-10-21', titel: 'x' }], jetzt)).toContain('TRIGGER:-P1D');
    expect(baueIcs([{ datumIso: '2026-10-19', titel: 'x' }], jetzt)).not.toContain('VALARM');
  });
});
