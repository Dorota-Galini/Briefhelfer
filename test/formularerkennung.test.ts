import { describe, expect, it } from 'vitest';
import { schaetzeFormular } from '../src/lib/formularerkennung';

const SCAN_FORMULAR = `Antrag auf Leistungen zur Teilhabe
Bitte vollständig ausfüllen und Zutreffendes ankreuzen.

1. Angaben zur Person
Familienname:
Vorname:
Geburtsdatum:
Anschrift: ______________________________

2. Familienstand
☐ ledig  ☐ verheiratet  ☒ geschieden  ☐ verwitwet

3. Krankenversicherung
gesetzlich ☐  privat ☐
Name der Kasse: ................................

Ort, Datum ____________   Unterschrift ________________`;

const BRIEF = `Jobcenter Musterkreis

Sehr geehrter Herr Nowak,

Ihr Antrag auf Bürgergeld ist unvollständig. Bitte reichen Sie bis zum 30.10.2026
Ihre Kontoauszüge ein.

Mit freundlichen Grüßen
Im Auftrag`;

describe('schaetzeFormular', () => {
  it('erkennt ein gescanntes Formular', () => {
    const e = schaetzeFormular(SCAN_FORMULAR);
    expect(e.istFormular).toBe(true);
    expect(e.gruende.join(' ')).toMatch(/Kästchen/);
  });

  it('hält einen normalen Brief nicht für ein Formular, auch wenn "Antrag" vorkommt', () => {
    expect(schaetzeFormular(BRIEF).istFormular).toBe(false);
  });

  it('erkennt ein Formular auch ohne Kästchen, nur mit Linien und Beschriftungen', () => {
    const t = `Erklärung zum Einkommen\nName:\nVorname:\nArbeitgeber:\nBrutto im Monat:\n____________\n____________\nDatum, Unterschrift`;
    expect(schaetzeFormular(t).istFormular).toBe(true);
  });
});
