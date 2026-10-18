import { describe, expect, it } from 'vitest';
import { findePersonendaten, pseudonymisiere } from '../src/lib/pseudonymize';

const schwaerze = (t: string) => pseudonymisiere(t, findePersonendaten(t)).text;

describe('Namen über die Vornamen-Liste', () => {
  it('findet Vor- und Nachnamen ohne Anrede', () => {
    const t = 'VORSTAND Thomas Muster (Vors.), Petra Beispiel';
    const s = schwaerze(t);
    expect(s).not.toContain('Thomas');
    expect(s).not.toContain('Muster');
    expect(s).not.toContain('Petra');
    expect(s).not.toContain('Beispiel');
    expect(s).toContain('VORSTAND');
    expect(s).toContain('(Vors.)');
  });

  it('findet Namen in Großbuchstaben und mit Zusatz', () => {
    const s = schwaerze('Sachbearbeitung: ANDREAS TESTMANN\nAnsprechpartner Karl-Heinz von Musterhausen');
    expect(s).not.toMatch(/ANDREAS|TESTMANN|Karl-Heinz|Musterhausen/);
  });

  it('findet polnische, türkische und arabische Namen', () => {
    const s = schwaerze('Łukasz Wiśniewski, Ayşe Yılmazoğlu und Mohammed Al Hassani');
    expect(s).not.toMatch(/Łukasz|Wiśniewski|Ayşe|Yılmazoğlu|Mohammed|Hassani/);
  });

  it('schwärzt einen Vornamen allein in der Anrede', () => {
    expect(schwaerze('Liebe Ewa, danke.')).toBe('Liebe [PERSON_1], danke.');
  });

  it('lässt Straßen, Monate und normale Wörter stehen', () => {
    const t = 'in der Martin-Luther-Straße\nam 3. Jan. 2026\nNur bis zum 01.12.2026 im August';
    expect(schwaerze(t)).toContain('Martin-Luther-Straße');
    expect(schwaerze(t)).toContain('Jan. 2026');
    expect(schwaerze(t)).toContain('Nur bis');
    expect(schwaerze(t)).toContain('August');
  });

  it('nimmt das Wort nach dem Vornamen nicht, wenn es eine Einrichtung ist', () => {
    expect(schwaerze('Elisabeth Krankenhaus Musterstadt')).toContain('Krankenhaus Musterstadt');
  });
});
