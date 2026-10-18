import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { BEISPIELE } from '../src/beispiele';
import { ErklaerungSchema } from '../src/lib/erklaerung';
import { FormularHilfeSchema, ScanHilfeSchema } from '../src/lib/formularhilfe';
import { pruefeBeleg } from '../src/lib/belegpruefung';

// Prüft die vorab erzeugten Demo-Antworten (src/beispiele/antworten/*.json)
const ORDNER = 'src/beispiele/antworten';
const lade = (id: string) => JSON.parse(readFileSync(`${ORDNER}/${id}.json`, 'utf-8'));

describe('Demo-Antworten', () => {
  it('gibt es für jedes Beispiel', () => {
    const vorhanden = readdirSync(ORDNER).map((d) => d.replace('.json', ''));
    for (const b of BEISPIELE) expect(vorhanden, b.id).toContain(b.id);
  });

  it('passen zum Antwortformat', () => {
    for (const b of BEISPIELE) {
      const { antwort } = lade(b.id);
      const schema = b.art === 'brief' ? ErklaerungSchema : b.art === 'formular' ? FormularHilfeSchema : ScanHilfeSchema;
      expect(schema.safeParse(antwort).success, b.id).toBe(true);
    }
  });

  it('kein erfundener Name aus den Beispielen ist ungeschwärzt bei der KI angekommen', () => {
    const namen = ['Nowak', 'Kowalski', 'Erika', 'Beispiel,', 'Kirchweg', 'Lindenweg', 'Gartenstraße', 'K123456789', '12345BG0067890', '4471108', 'Musterfrau', '412 345 678', '9876543', 'Gartenweg'];
    for (const b of BEISPIELE) {
      const { gesendet } = lade(b.id);
      for (const n of namen) expect(gesendet, `${b.id}: ${n}`).not.toContain(n);
    }
  });

  it('Belege der Briefe stehen wörtlich im gesendeten Text', () => {
    for (const b of BEISPIELE.filter((x) => x.art === 'brief')) {
      const { antwort, gesendet } = lade(b.id);
      const e = ErklaerungSchema.parse(antwort);
      const aussagen = [...e.forderungen, ...e.fristen, ...e.folgen].filter((a) => a.beleg);
      expect(aussagen.length, b.id).toBeGreaterThan(0);
      for (const a of aussagen) expect(pruefeBeleg(a.beleg, gesendet).status, `${b.id}: ${a.beleg}`).toBe('gefunden');
    }
  });
});
