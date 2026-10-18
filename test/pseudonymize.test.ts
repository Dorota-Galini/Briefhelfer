import { describe, expect, it } from 'vitest';
import { findePersonendaten, pseudonymisiere, schwaerzeZusatz, setzeZurueck } from '../src/lib/pseudonymize';

// Erfundener Beispielbrief, keine echten Daten.
const BRIEF = `Finanzamt Musterstadt
Frau Anna Kowalski
Lindenstraße 12a
12345 Beispielhausen

Steuernummer: 64/123/45678
Steuer-ID: 12 345 678 901
Telefon: 030 1234567
E-Mail: anna.kowalski@example.de

Sehr geehrte Frau Kowalski,

für das Jahr 2025 setzen wir eine Nachzahlung von 412,50 € fest.
Bitte überweisen Sie den Betrag bis zum 15.11.2026 auf das Konto
DE89 3704 0044 0532 0130 00. Gegen diesen Bescheid können Sie
innerhalb eines Monats Einspruch einlegen (§ 355 AO).
Geburtsdatum: 03.04.1981`;

describe('findePersonendaten', () => {
  const funde = findePersonendaten(BRIEF);
  const werte = funde.map((f) => f.original);
  const kategorie = (wert: string) => funde.find((f) => f.original === wert)?.kategorie;

  it('findet Namen nach Anrede, auch wiederholt', () => {
    expect(werte).toContain('Anna Kowalski');
    expect(funde.filter((f) => f.kategorie === 'PERSON').length).toBeGreaterThanOrEqual(2);
    expect(werte).toContain('Kowalski');
  });

  it('findet Adresse, PLZ/Ort, Kontakt', () => {
    expect(kategorie('Lindenstraße 12a')).toBe('ADRESSE');
    expect(kategorie('12345 Beispielhausen')).toBe('PLZ_ORT');
    expect(kategorie('030 1234567')).toBe('TELEFON');
    expect(kategorie('anna.kowalski@example.de')).toBe('EMAIL');
  });

  it('findet Steuer- und Bankdaten', () => {
    expect(kategorie('64/123/45678')).toBe('STEUERNUMMER');
    expect(kategorie('12 345 678 901')).toBe('STEUER_ID');
    expect(kategorie('DE89 3704 0044 0532 0130 00')).toBe('IBAN');
    expect(kategorie('03.04.1981')).toBe('GEBURTSDATUM');
  });

  it('lässt Fristen, Beträge und Paragrafen stehen', () => {
    const { text } = pseudonymisiere(BRIEF, funde);
    expect(text).toContain('15.11.2026');
    expect(text).toContain('412,50 €');
    expect(text).toContain('§ 355 AO');
    expect(text).toContain('Finanzamt Musterstadt');
    expect(text).not.toContain('Kowalski');
    expect(text).not.toContain('Beispielhausen');
  });
});

// Erfundener Versicherungsbrief: Name ohne Anrede im Adressfeld, Policennummer
const VERSICHERUNG = `Muster Versicherung AG · Postfach 1234 · 20000 Hamburg
Frau
MAREIKE BEISPIEL
Am Kirchweg 7
12345 Beispielhausen

Policennummer: 1A-4711 0815
Versicherungsschein-Nr. 98 7654 3210
Ihre Vorgangsnummer 2025-00042

Sehr geehrte Frau Beispiel,
Ihr Beitrag von 89,90 € ist am 01.12.2026 fällig.`;

describe('Versicherungsbrief', () => {
  const funde = findePersonendaten(VERSICHERUNG);
  const { text } = pseudonymisiere(VERSICHERUNG, funde);

  it('schwärzt den Namen im Adressfeld, auch in Großbuchstaben', () => {
    expect(text).not.toContain('MAREIKE');
    expect(text).not.toContain('BEISPIEL');
    expect(text).not.toContain('Beispiel');
  });

  it('schwärzt Policen-, Versicherungsschein- und Vorgangsnummer', () => {
    expect(text).not.toContain('1A-4711');
    expect(text).not.toContain('0815');
    expect(text).not.toContain('98 7654 3210');
    expect(text).not.toContain('2025-00042');
  });

  it('lässt Absender, Frist und Betrag stehen', () => {
    expect(text).toContain('Muster Versicherung AG');
    expect(text).toContain('01.12.2026');
    expect(text).toContain('89,90 €');
  });
});

describe('Lange Nummern ohne Stichwort', () => {
  it('schwärzt 7+ Ziffern, aber keine Datumsangaben', () => {
    const t = 'Nummer 123 4567 89 und Frist 15.11.2026';
    const { text } = pseudonymisiere(t, findePersonendaten(t));
    expect(text).not.toContain('4567');
    expect(text).toContain('15.11.2026');
  });
});

describe('Eigene Angaben', () => {
  it('werden überall geschwärzt, auch ohne Anrede und in anderer Schreibweise', () => {
    const t = 'Versicherungsnehmerin: kowalczyk, anna\nVielen Dank, Anna.';
    const { text } = pseudonymisiere(t, findePersonendaten(t, { eigeneAngaben: ['Anna Kowalczyk'] }));
    expect(text).not.toMatch(/anna/i);
    expect(text).not.toMatch(/kowalczyk/i);
  });
});

describe('pseudonymisiere / setzeZurueck', () => {
  it('gleiche Werte bekommen denselben Platzhalter und kommen zurück', () => {
    const text = 'Herr Jan Nowak wohnt hier. Herr Jan Nowak zahlt.';
    const e = pseudonymisiere(text, findePersonendaten(text));
    expect(e.text).toBe('Herr [PERSON_1] wohnt hier. Herr [PERSON_1] zahlt.');
    expect(setzeZurueck('Bitte, [PERSON_1], zahlen Sie.', e.zuordnung)).toBe('Bitte, Jan Nowak, zahlen Sie.');
  });

  it('Nachname allein wird derselben Person zugeordnet', () => {
    const text = 'Herrn Jan Nowak\nKirchweg 7\n\nSehr geehrter Herr Nowak,';
    const e = pseudonymisiere(text, findePersonendaten(text));
    expect(e.text).toContain('Herrn [PERSON_1]');
    expect(e.text).toContain('Herr [PERSON_1_NACHNAME],');
    expect(setzeZurueck('Herr [PERSON_1_NACHNAME], Sie ([PERSON_1])', e.zuordnung)).toBe('Herr Nowak, Sie (Jan Nowak)');
  });

  it('schwärzt Nummern nach beliebigen "-nummer"-Wörtern und gemischte Kennungen', () => {
    const t = 'BG-Nummer: 12345BG0067890\nBeitragsnummer 554 123 987\nVorgang FV2026A4471\nAm 30.10.2026 um 10 Uhr';
    const { text } = pseudonymisiere(t, findePersonendaten(t));
    expect(text).not.toMatch(/12345BG0067890|554 123 987|FV2026A4471/);
    expect(text).toContain('30.10.2026');
  });

  it('Stichwort am Zeilenende schwärzt nicht die nächste Zeile', () => {
    const t = 'Beitragsnummer:\n2. Grund der Befreiung';
    expect(pseudonymisiere(t, findePersonendaten(t)).text).toBe(t);
  });

  it('Absender im Adressfeld (Krankenkasse, Stadtwerke, Landratsamt) ist keine Person', () => {
    for (const absender of ['Krankenkasse Muster', 'Stadtwerke Musterstadt', 'Landratsamt Musterkreis', 'Deutsche Rentenversicherung']) {
      const t = `${absender}\nFrau Anna Kowalski\nKirchweg 7\n54321 Beispielstadt`;
      const { text } = pseudonymisiere(t, findePersonendaten(t));
      expect(text, absender).toContain(absender);
      expect(text).not.toContain('Kowalski');
    }
  });

  it('schwaerzeZusatz nutzt bekannte Platzhalter und vergibt neue fortlaufend', () => {
    const zuordnung = new Map([['[PERSON_1]', 'Jan Nowak']]);
    expect(schwaerzeZusatz('Antragsteller: Jan Nowak', zuordnung)).toBe('Antragsteller: [PERSON_1]');
    expect(schwaerzeZusatz('Ehefrau Frau Anna Nowak', zuordnung)).toBe('Ehefrau Frau [PERSON_2]');
    expect(zuordnung.get('[PERSON_2]')).toBe('Anna Nowak');
    expect(schwaerzeZusatz('IBAN DE02 1203 0000 0000 2020 51', zuordnung)).toBe('IBAN [IBAN_1]');
    expect(schwaerzeZusatz('txtGeburtsdatum', zuordnung)).toBe('txtGeburtsdatum');
  });

  it('unbekannte Platzhalter bleiben unverändert', () => {
    expect(setzeZurueck('[PERSON_9]', new Map())).toBe('[PERSON_9]');
  });
});
