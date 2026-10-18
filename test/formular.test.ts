import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName, PDFString, StandardFonts } from 'pdf-lib';
import { fuelleFormular, liesFormular } from '../src/lib/formular';
import { findeBeschriftung } from '../src/lib/beschriftung';
import type { Stueck } from '../src/lib/layout';

// Erzeugt ein kleines Antragsformular mit allen Feldarten
async function testformular(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const seite1 = doc.addPage([595, 842]);
  const seite2 = doc.addPage([595, 842]);
  const form = doc.getForm();

  seite1.drawText('Antrag auf Wohngeld', { x: 50, y: 790, size: 16, font });

  const name = form.createTextField('txtName');
  name.addToPage(seite1, { x: 200, y: 700, width: 250, height: 20 });
  name.acroField.dict.set(PDFName.of('TU'), PDFString.of('Familienname, Vorname'));

  const anschrift = form.createTextField('txtAnschrift');
  anschrift.enableMultiline();
  anschrift.addToPage(seite1, { x: 200, y: 600, width: 250, height: 60 });

  const plz = form.createTextField('txtPLZ');
  plz.setMaxLength(5);
  plz.addToPage(seite1, { x: 200, y: 560, width: 80, height: 20 });

  const verheiratet = form.createCheckBox('chkVerh');
  verheiratet.addToPage(seite1, { x: 50, y: 500, width: 12, height: 12 });

  const art = form.createRadioGroup('rbArt');
  art.addOptionToPage('Miete', seite2, { x: 50, y: 700, width: 12, height: 12 });
  art.addOptionToPage('Eigentum', seite2, { x: 150, y: 700, width: 12, height: 12 });

  const kasse = form.createDropdown('ddKasse');
  kasse.setOptions(['AOK', 'TK', 'Barmer']);
  kasse.addToPage(seite2, { x: 200, y: 650, width: 150, height: 20 });

  form.createButton('btnDrucken').addToPage('Drucken', seite2, { x: 50, y: 50, width: 80, height: 20 });
  return await doc.save();
}

describe('liesFormular', () => {
  it('findet alle ausfüllbaren Felder in Lesereihenfolge, ohne Knöpfe', async () => {
    const felder = await liesFormular(await testformular());
    expect(felder.map((f) => [f.id, f.name, f.typ, f.seite])).toEqual([
      ['F1', 'txtName', 'text', 1],
      ['F2', 'txtAnschrift', 'mehrzeilig', 1],
      ['F3', 'txtPLZ', 'text', 1],
      ['F4', 'chkVerh', 'kaestchen', 1],
      ['F5', 'rbArt', 'auswahl', 2],
      ['F6', 'ddKasse', 'auswahl', 2],
    ]);
    expect(felder[0].tooltip).toBe('Familienname, Vorname');
    expect(felder[2].maxLaenge).toBe(5);
    expect(felder[4].optionen).toEqual(['Miete', 'Eigentum']);
    expect(felder[5].optionen).toEqual(['AOK', 'TK', 'Barmer']);
  });

  it('nutzt die Textstücke der Seite für die Beschriftung', async () => {
    const stuecke: Stueck[][] = [
      [
        { str: 'Name, Vorname:', x: 50, y: 705, breite: 90, hoehe: 10 },
        { str: 'Ich bin verheiratet', x: 70, y: 501, breite: 100, hoehe: 10 },
      ],
    ];
    const felder = await liesFormular(await testformular(), stuecke);
    expect(felder[0].beschriftung).toBe('Name, Vorname:');
    expect(felder[3].beschriftung).toBe('Ich bin verheiratet');
  });
});

describe('fuelleFormular', () => {
  it('trägt Werte ein, kürzt auf die Maximallänge und lässt Leeres leer', async () => {
    const pdf = await testformular();
    const felder = await liesFormular(pdf);
    const neu = await fuelleFormular(pdf, felder, {
      F1: 'Müller, Jürgen',
      F3: '123450',
      F4: true,
      F5: 'Eigentum',
      F6: 'TK',
      F2: '',
    });
    const form = (await PDFDocument.load(neu)).getForm();
    expect(form.getTextField('txtName').getText()).toBe('Müller, Jürgen');
    expect(form.getTextField('txtPLZ').getText()).toBe('12345');
    expect(form.getTextField('txtAnschrift').getText()).toBeUndefined();
    expect(form.getCheckBox('chkVerh').isChecked()).toBe(true);
    expect(form.getRadioGroup('rbArt').getSelected()).toBe('Eigentum');
    expect(form.getDropdown('ddKasse').getSelected()).toEqual(['TK']);
  });

  it('kommt mit Zeichen außerhalb der Standardschrift zurecht (ł, ş)', async () => {
    const pdf = await testformular();
    const felder = await liesFormular(pdf);
    const neu = await fuelleFormular(pdf, felder, { F1: 'Łukasz Wiśniewski, Ayşe' });
    const form = (await PDFDocument.load(neu)).getForm();
    expect(form.getTextField('txtName').getText()).toBe('Łukasz Wiśniewski, Ayşe');
  });
});

describe('findeBeschriftung', () => {
  const feld = { x: 200, y: 700, breite: 200, hoehe: 20 };
  it('nimmt Text links daneben vor Text darüber', () => {
    expect(
      findeBeschriftung(feld, [
        { str: 'Geburtsdatum', x: 80, y: 705, breite: 70, hoehe: 10 },
        { str: 'Angaben zur Person', x: 200, y: 730, breite: 100, hoehe: 10 },
      ]),
    ).toBe('Geburtsdatum');
  });
  it('nimmt Text darüber, wenn links nichts steht', () => {
    expect(findeBeschriftung(feld, [{ str: 'Straße, Hausnummer', x: 200, y: 724, breite: 100, hoehe: 9 }])).toBe(
      'Straße, Hausnummer',
    );
  });
  it('liefert leer, wenn nichts in der Nähe ist', () => {
    expect(findeBeschriftung(feld, [{ str: 'Weit weg', x: 50, y: 100, breite: 40, hoehe: 10 }])).toBe('');
  });
});
