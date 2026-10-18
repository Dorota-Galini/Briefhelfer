// PDF-Formulare mit Eingabefeldern lesen und lokal ausfüllen (pdf-lib).
// Die eingegebenen Werte verlassen das Gerät nie. An die KI gehen nur Feldnamen und Beschriftungen.
import {
  PDFBool,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFHexString,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFRef,
  PDFString,
  PDFTextField,
  type PDFField,
} from 'pdf-lib';
import { findeBeschriftung, type Rechteck } from './beschriftung';
import type { Stueck } from './layout';

export type FeldTyp = 'text' | 'mehrzeilig' | 'kaestchen' | 'auswahl' | 'liste';

export interface Feld {
  id: string; // "F1", "F2", … in Reihenfolge auf den Seiten
  name: string; // technischer Name im PDF
  typ: FeldTyp;
  seite: number; // 1-basiert
  rechteck: Rechteck;
  tooltip: string; // Hilfetext aus dem PDF, oft die beste Beschriftung
  beschriftung: string; // Text neben oder über dem Feld
  optionen: string[]; // bei Auswahl und Liste
  maxLaenge: number | null;
}

export type Werte = Record<string, string | boolean>;

/** Liest alle ausfüllbaren Felder. `stueckeProSeite` sind die Textstücke aus pdf.js (für die Beschriftung). */
export async function liesFormular(bytes: ArrayBuffer | Uint8Array, stueckeProSeite: Stueck[][] = []): Promise<Feld[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const seitenRefs = doc.getPages().map((p) => p.ref);
  const annotsProSeite = doc.getPages().map((p) => {
    const annots = p.node.Annots();
    return annots ? annots.asArray().filter((a): a is PDFRef => a instanceof PDFRef).map((r) => r.toString()) : [];
  });

  const felder: Omit<Feld, 'id'>[] = [];
  for (const feld of doc.getForm().getFields()) {
    const typ = feldTyp(feld);
    if (!typ) continue; // Knöpfe, Unterschriftsfelder
    const widget = feld.acroField.getWidgets()[0];
    if (!widget) continue;
    const r = widget.getRectangle();
    const rechteck = { x: r.x, y: r.y, breite: r.width, hoehe: r.height };

    // Seite über /P oder über die Annotationsliste der Seiten finden
    let seite = -1;
    const p = widget.P();
    if (p) seite = seitenRefs.findIndex((ref) => ref.toString() === p.toString());
    if (seite < 0) {
      const ref = doc.context.getObjectRef(widget.dict)?.toString();
      seite = annotsProSeite.findIndex((liste) => ref !== undefined && liste.includes(ref));
    }
    if (seite < 0) seite = 0;

    felder.push({
      name: feld.getName(),
      typ,
      seite: seite + 1,
      rechteck,
      tooltip: tooltip(feld),
      beschriftung: stueckeProSeite[seite] ? findeBeschriftung(rechteck, stueckeProSeite[seite]) : '',
      optionen: optionen(feld),
      maxLaenge: feld instanceof PDFTextField ? (feld.getMaxLength() ?? null) : null,
    });
  }

  // Lesereihenfolge: Seite, dann von oben nach unten, dann von links nach rechts
  felder.sort((a, b) => a.seite - b.seite || b.rechteck.y - a.rechteck.y || a.rechteck.x - b.rechteck.x);
  return felder.map((f, i) => ({ ...f, id: `F${i + 1}` }));
}

/** Füllt das Formular mit den Werten und gibt das neue PDF zurück. Felder bleiben bearbeitbar. */
export async function fuelleFormular(bytes: ArrayBuffer | Uint8Array, felder: Feld[], werte: Werte): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  for (const f of felder) {
    const wert = werte[f.id];
    if (wert === undefined || wert === '') continue;
    const feld = form.getFieldMaybe(f.name);
    if (!feld) continue;
    if (feld instanceof PDFTextField) {
      const text = String(wert);
      const max = feld.getMaxLength();
      feld.setText(max ? text.slice(0, max) : text);
    } else if (feld instanceof PDFCheckBox) {
      if (wert === true) feld.check();
      else feld.uncheck();
    } else if (feld instanceof PDFRadioGroup || feld instanceof PDFDropdown || feld instanceof PDFOptionList) {
      if (typeof wert === 'string' && feld.getOptions().includes(wert)) feld.select(wert);
    }
  }
  try {
    return await doc.save();
  } catch {
    // Zeichen außerhalb der Standardschrift (z. B. ł, ş): Darstellung dem PDF-Programm überlassen
    form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True);
    return await doc.save({ updateFieldAppearances: false });
  }
}

function feldTyp(feld: PDFField): FeldTyp | null {
  if (feld instanceof PDFTextField) return feld.isMultiline() ? 'mehrzeilig' : 'text';
  if (feld instanceof PDFCheckBox) return 'kaestchen';
  if (feld instanceof PDFRadioGroup || feld instanceof PDFDropdown) return 'auswahl';
  if (feld instanceof PDFOptionList) return 'liste';
  return null;
}

function optionen(feld: PDFField): string[] {
  if (feld instanceof PDFRadioGroup || feld instanceof PDFDropdown || feld instanceof PDFOptionList) {
    return feld.getOptions();
  }
  return [];
}

function tooltip(feld: PDFField): string {
  const tu = feld.acroField.dict.lookup(PDFName.of('TU'));
  if (tu instanceof PDFString || tu instanceof PDFHexString) return tu.decodeText().trim();
  return '';
}
