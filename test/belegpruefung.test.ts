import { describe, expect, it } from 'vitest';
import { fristBelegt, pruefeBeleg } from '../src/lib/belegpruefung';

const BRIEF = `Sehr geehrter Herr [PERSON_1_NACHNAME],

bitte reichen Sie bis zum 30.10.2026 Ihre Konto-
auszüge der letzten drei Monate ein. Eine Zahlung ist
nicht erforderlich.
Kommen Sie Ihrer Mitwirkungspflicht nicht nach, können die Leistungen „ganz oder teilweise“ versagt werden.`;

describe('pruefeBeleg', () => {
  it('findet wörtliche Zitate über Zeilenumbrüche, Trennung und Anführungszeichen hinweg', () => {
    expect(pruefeBeleg('bitte reichen Sie bis zum 30.10.2026 Ihre Kontoauszüge der letzten drei Monate ein.', BRIEF).status).toBe(
      'gefunden',
    );
    expect(pruefeBeleg('können die Leistungen "ganz oder teilweise" versagt werden', BRIEF).status).toBe('gefunden');
    expect(pruefeBeleg('Sehr geehrter Herr [PERSON_1_NACHNAME]', BRIEF).status).toBe('gefunden');
  });

  it('ein fehlendes "nicht" ist kein Treffer, sondern höchstens ähnlich', () => {
    const e = pruefeBeleg('Eine Zahlung ist erforderlich.', BRIEF);
    expect(e.status).toBe('aehnlich');
    expect(e.stelle).toContain('nicht');
  });

  it('Platzhalter sind keine Joker: andere Person ist kein Treffer', () => {
    expect(pruefeBeleg('Sehr geehrter Herr [PERSON_2_NACHNAME]', BRIEF).status).not.toBe('gefunden');
  });

  it('erfundene Zitate werden nicht gefunden, leere fehlen', () => {
    expect(pruefeBeleg('Sie erhalten eine Erstattung von 500 Euro auf Ihr Konto.', BRIEF).status).toBe('nicht');
    expect(pruefeBeleg('', BRIEF).status).toBe('fehlt');
  });

  it('ein Zahlendreher im Datum ist kein Treffer', () => {
    expect(pruefeBeleg('bitte reichen Sie bis zum 03.10.2026 Ihre Kontoauszüge', BRIEF).status).toBe('aehnlich');
  });
});

describe('fristBelegt', () => {
  it('verlangt, dass das Datum in der gefundenen Stelle selbst steht', () => {
    expect(fristBelegt('30.10.2026', 'bitte reichen Sie bis zum 30.10.2026 Ihre Kontoauszüge', BRIEF)).toBe(true);
    expect(fristBelegt('30.10.2026', 'Eine Zahlung ist nicht erforderlich.', BRIEF)).toBe(false);
    expect(fristBelegt('', 'bitte reichen Sie bis zum 30.10.2026', BRIEF)).toBe(false);
  });
});
