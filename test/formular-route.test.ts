import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ersetzeBekannte } from '../src/lib/pseudonymize';

const create = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    status = 500;
  }
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = class extends APIError {};
    static AuthenticationError = class extends APIError {};
    beta = { messages: { create } };
  }
  return { default: Anthropic };
});

const FELDER = [
  { id: 'F1', typ: 'text', name: 'txtName', tooltip: '', beschriftung: 'Name, Vorname', optionen: [], seite: 1 },
  { id: 'F2', typ: 'kaestchen', name: 'chkVerh', tooltip: '', beschriftung: 'verheiratet', optionen: [], seite: 1 },
];

const HILFE = {
  formular: 'Antrag auf Wohngeld',
  worum: 'Mit dem Formular beantragen Sie Wohngeld.',
  vorbereitung: ['Mietvertrag'],
  felder: [
    { id: 'F1', bezeichnung: 'Ihr Name', erklaerung: 'Familienname, dann Vorname.', wo_finden: '', pflicht: 'ja' },
    { id: 'F2', bezeichnung: 'Verheiratet', erklaerung: 'Ankreuzen, wenn Sie verheiratet sind.', wo_finden: '', pflicht: 'nein' },
    { id: 'F99', bezeichnung: 'Erfunden', erklaerung: 'gibt es nicht', wo_finden: '', pflicht: 'unklar' },
  ],
  hinweise: 'Unterschreiben nicht vergessen.',
  unsicher: '',
};

const anfrage = (body: unknown) =>
  new Request('http://localhost:4321/api/formular', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:4321' },
    body: JSON.stringify(body),
  });

async function route() {
  vi.resetModules();
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-schluessel');
  return (await import('../src/pages/api/formular')).POST;
}

describe('/api/formular', () => {
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(HILFE) }] });
  });

  it('erklärt die Felder und verwirft erfundene Feld-IDs', async () => {
    const POST = await route();
    const r = await POST({ request: anfrage({ text: 'Antrag auf Wohngeld', felder: FELDER }), clientAddress: '1.1.1.1' } as never);
    expect(r.status).toBe(200);
    const { hilfe } = await r.json();
    expect(hilfe.felder.map((f: { id: string }) => f.id)).toEqual(['F1', 'F2']);

    const gesendet = create.mock.calls[0][0].messages[0].content as string;
    expect(gesendet).toContain('txtName');
    expect(gesendet).toContain('Name, Vorname');
  });

  it('lehnt fehlende oder falsch aufgebaute Felder ab', async () => {
    const POST = await route();
    const ctx = (body: unknown) => ({ request: anfrage(body), clientAddress: '2.2.2.2' }) as never;
    expect((await POST(ctx({ text: 'x', felder: [] }))).status).toBe(400);
    expect((await POST(ctx({ text: 'x', felder: [{ id: 'F1', typ: 'boese' }] }))).status).toBe(400);
    expect((await POST(ctx({ text: 'x', felder: [{ ...FELDER[0], wert: 'geheim', typ: 'unbekannt' }] }))).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('gibt nur erlaubte Feldangaben an die KI weiter', async () => {
    const POST = await route();
    const mitWert = [{ ...FELDER[0], wert: 'Geheimer Wert 4711' }];
    const r = await POST({ request: anfrage({ text: 'Antrag', felder: mitWert }), clientAddress: '6.6.6.6' } as never);
    expect(r.status).toBe(200);
    expect(create.mock.calls[0][0].messages[0].content).not.toContain('Geheimer Wert');
  });

  it('lehnt zu viele Felder ab', async () => {
    const POST = await route();
    const viele = Array.from({ length: 301 }, (_, i) => ({ ...FELDER[0], id: `F${i + 1}` }));
    const r = await POST({ request: anfrage({ text: 'x', felder: viele }), clientAddress: '3.3.3.3' } as never);
    expect(r.status).toBe(413);
  });
});

describe('/api/formular mit art "scan"', () => {
  const SCAN = {
    formular: 'Antrag auf Teilhabe',
    worum: 'Damit beantragen Sie Leistungen.',
    vorbereitung: [],
    felder: [
      {
        abschnitt: '2. Familienstand',
        bezeichnung: 'Familienstand',
        art: 'ankreuzen',
        erklaerung: 'Kreuzen Sie ledig, verheiratet, geschieden oder verwitwet an.',
        wo_finden: '',
        pflicht: 'ja',
        schon_ausgefuellt: true,
      },
    ],
    hinweise: '',
    unsicher: 'Abschnitt 3 war schwer lesbar.',
  };

  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(SCAN) }] });
  });

  it('erklärt ein gescanntes Formular ohne Feldliste', async () => {
    const POST = await route();
    const text = 'Antrag auf Teilhabe\n2. Familienstand\n☐ ledig ☒ geschieden\nUnterschrift ______';
    const r = await POST({ request: anfrage({ art: 'scan', text }), clientAddress: '7.7.7.7' } as never);
    expect(r.status).toBe(200);
    const { scan } = await r.json();
    expect(scan.felder[0].art).toBe('ankreuzen');
    const aufruf = create.mock.calls[0][0];
    expect(aufruf.system).toContain('von Hand');
    expect(aufruf.output_config.format.schema.properties.felder.items.properties).toHaveProperty('schon_ausgefuellt');
  });

  it('lehnt leeren Scan-Text ab', async () => {
    const POST = await route();
    const r = await POST({ request: anfrage({ art: 'scan', text: 'kurz' }), clientAddress: '8.8.8.8' } as never);
    expect(r.status).toBe(400);
  });
});

describe('ersetzeBekannte', () => {
  it('ersetzt bekannte Angaben in Beschriftungen, längere zuerst', () => {
    const zuordnung = new Map([
      ['[PERSON_1]', 'Jan Nowak'],
      ['[PERSON_1_NACHNAME]', 'Nowak'],
    ]);
    expect(ersetzeBekannte('Antragsteller Jan Nowak, Herr Nowak', zuordnung)).toBe(
      'Antragsteller [PERSON_1], Herr [PERSON_1_NACHNAME]',
    );
    expect(ersetzeBekannte('Nowakowski bleibt', zuordnung)).toBe('Nowakowski bleibt');
  });
});
