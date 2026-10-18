// Erzeugt die Beispieldokumente für die Demo unter public/beispiele/.
// Alle Personen, Adressen, Nummern und Absender sind erfunden.
// Aufruf: node scripts/beispiele-erzeugen.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from 'pdf-lib';

const ZIEL = 'public/beispiele';
mkdirSync(ZIEL, { recursive: true });

const A4 = [595.28, 841.89];
const RAND = 70;

async function brief({ datei, absenderZeile, absenderKopf, empfaenger, datum, zeichen, betreff, text }) {
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const fett = await doc.embedFont(StandardFonts.HelveticaBold);
  const seite = doc.addPage(A4);
  const breite = A4[0] - 2 * RAND;

  // Briefkopf rechts oben
  let y = 790;
  absenderKopf.forEach((z, i) => {
    seite.drawText(z, { x: 360, y: y - i * 13, size: i === 0 ? 12 : 9, font: i === 0 ? fett : normal });
  });

  // Rücksendeangabe und Anschrift (Fensterbereich nach DIN 5008)
  seite.drawText(absenderZeile, { x: RAND, y: 705, size: 7, font: normal, color: rgb(0.3, 0.3, 0.3) });
  empfaenger.forEach((z, i) => seite.drawText(z, { x: RAND, y: 685 - i * 14, size: 11, font: normal }));

  // Zeichen und Datum
  y = 590;
  zeichen.forEach((z, i) => seite.drawText(z, { x: 360, y: y - i * 13, size: 9, font: normal }));
  seite.drawText(datum, { x: 360, y: y - zeichen.length * 13 - 6, size: 9, font: normal });

  // Betreff
  y = 520;
  seite.drawText(betreff, { x: RAND, y, size: 11, font: fett });
  y -= 30;

  // Fließtext mit Umbruch
  for (const absatz of text) {
    if (absatz === '') {
      y -= 8;
      continue;
    }
    for (const zeile of umbrechen(absatz, normal, 10.5, breite)) {
      seite.drawText(zeile, { x: RAND, y, size: 10.5, font: normal });
      y -= 15;
    }
    y -= 6;
  }
  writeFileSync(`${ZIEL}/${datei}`, await doc.save());
  console.log(`${ZIEL}/${datei}`);
}

function umbrechen(text, font, groesse, breite) {
  const zeilen = [];
  let zeile = '';
  for (const wort of text.split(' ')) {
    const probe = zeile ? `${zeile} ${wort}` : wort;
    if (font.widthOfTextAtSize(probe, groesse) > breite && zeile) {
      zeilen.push(zeile);
      zeile = wort;
    } else zeile = probe;
  }
  if (zeile) zeilen.push(zeile);
  return zeilen;
}

// 1. Jobcenter: Aufforderung zur Mitwirkung
await brief({
  datei: 'jobcenter-mitwirkung.pdf',
  absenderZeile: 'Jobcenter Musterkreis · Postfach 1234 · 49000 Musterstadt',
  absenderKopf: ['Jobcenter Musterkreis', 'Am Markt 5', '49000 Musterstadt', 'Telefon 0441 000000-0'],
  empfaenger: ['Herrn', 'Jan Nowak', 'Kirchweg 7', '49377 Vechta'],
  zeichen: ['BG-Nummer: 12345BG0067890', 'Ihr Zeichen: –'],
  datum: '14.10.2026',
  betreff: 'Aufforderung zur Mitwirkung',
  text: [
    'Sehr geehrter Herr Nowak,',
    'Ihr Antrag auf Bürgergeld vom 02.09.2026 ist noch unvollständig. Für die Prüfung Ihres Anspruchs benötige ich folgende Unterlagen:',
    '- Kontoauszüge aller Ihrer Konten der letzten drei Monate',
    '- die ausgefüllte Mietbescheinigung (Vordruck liegt bei)',
    'Bitte reichen Sie die Unterlagen bis zum 30.10.2026 ein. Sie können sie persönlich abgeben, per Post schicken oder über jobcenter.digital hochladen.',
    'Kommen Sie Ihrer Mitwirkungspflicht nach §§ 60 ff. SGB I bis zu diesem Tag nicht nach, können die Leistungen nach § 66 SGB I bis zur Nachholung der Mitwirkung ganz oder teilweise versagt werden.',
    '',
    'Mit freundlichen Grüßen',
    'Im Auftrag',
    'Petra Sommer',
  ],
});

// 2. Krankenkasse: Familienversicherung, zwei Personen
await brief({
  datei: 'krankenkasse-familienversicherung.pdf',
  absenderZeile: 'Krankenkasse Musterland · 26000 Musterhafen',
  absenderKopf: ['Krankenkasse Musterland', 'Kundenservice', 'Hafenstraße 12', '26000 Musterhafen'],
  empfaenger: ['Frau', 'Anna Kowalski', 'Lindenweg 3', '49393 Lohne'],
  zeichen: ['Versichertennummer: K123456789', 'Unser Zeichen: FV-2026-4471'],
  datum: '09.10.2026',
  betreff: 'Familienversicherung Ihres Ehemannes Herrn Jan Kowalski',
  text: [
    'Sehr geehrte Frau Kowalski,',
    'Ihr Ehemann Herr Jan Kowalski ist bei uns über Sie familienversichert. Einmal im Jahr prüfen wir, ob die Voraussetzungen dafür noch vorliegen.',
    'Bitte senden Sie uns den beiliegenden Fragebogen zur Familienversicherung ausgefüllt und unterschrieben zurück. Fügen Sie bitte einen Nachweis über das Einkommen von Herrn Jan Kowalski bei, zum Beispiel die letzte Gehaltsabrechnung oder den aktuellen Rentenbescheid.',
    'Bitte schicken Sie uns die Unterlagen bis zum 20.11.2026.',
    'Liegt das monatliche Gesamteinkommen Ihres Ehemannes über 535 Euro, endet die Familienversicherung. Er muss sich dann selbst versichern. Erhalten wir keine Antwort, müssen wir die Familienversicherung beenden.',
    '',
    'Mit freundlichen Grüßen',
    'Ihre Krankenkasse Musterland',
  ],
});

// 3. Stadtwerke: Jahresabrechnung ohne Nachzahlung (Verneinung)
await brief({
  datei: 'stadtwerke-jahresabrechnung.pdf',
  absenderZeile: 'Stadtwerke Musterstadt · Werkstraße 1 · 49000 Musterstadt',
  absenderKopf: ['Stadtwerke Musterstadt', 'Werkstraße 1', '49000 Musterstadt'],
  empfaenger: ['Frau', 'Erika Beispiel', 'Gartenstraße 18', '49393 Lohne'],
  zeichen: ['Kundennummer: 4471108', 'Vertragskonto: 70-2219-33'],
  datum: '06.10.2026',
  betreff: 'Ihre Jahresabrechnung Strom 2025',
  text: [
    'Sehr geehrte Frau Beispiel,',
    'anbei erhalten Sie Ihre Jahresabrechnung für Strom vom 01.01.2025 bis 31.12.2025. Ihr Verbrauch lag bei 2.180 kWh.',
    'Ihre monatlichen Abschläge haben die Kosten vollständig gedeckt. Eine Nachzahlung ist nicht erforderlich. Das Guthaben von 23,40 € überweisen wir in den nächsten Tagen auf Ihr Konto.',
    'Ihr neuer monatlicher Abschlag beträgt ab dem 01.11.2026 weiterhin 62,00 €.',
    'Bitte senden Sie uns den beigefügten Bogen mit Ihrem aktuellen Zählerstand bis zum 15.11.2026 zurück. Damit können wir den Abschlag genauer berechnen.',
    '',
    'Mit freundlichen Grüßen',
    'Ihre Stadtwerke Musterstadt',
  ],
});

// 4. Ausfüllbares PDF-Formular: Antrag auf Wohngeld (vereinfacht, erfunden)
{
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const fett = await doc.embedFont(StandardFonts.HelveticaBold);
  const s = doc.addPage(A4);
  const form = doc.getForm();
  const text = (t, x, y, size = 10, font = normal) => s.drawText(t, { x, y, size, font });
  const feld = (name, x, y, w, tooltip, h = 18) => {
    const f = form.createTextField(name);
    f.addToPage(s, { x, y, width: w, height: h });
    if (tooltip) f.acroField.dict.set(PDFName.of('TU'), PDFString.of(tooltip));
    return f;
  };

  text('Antrag auf Wohngeld (Mietzuschuss)', RAND, 780, 16, fett);
  text('Beispielformular des Briefhelfers. Kein echtes Formular einer Behörde.', RAND, 762, 8);

  text('1. Angaben zur antragstellenden Person', RAND, 725, 11, fett);
  text('Familienname, Vorname:', RAND, 700);
  feld('txtName', 200, 695, 300, 'Familienname, Vorname');
  text('Geburtsdatum:', RAND, 672);
  feld('txtGeb', 200, 667, 120, '');
  text('Straße, Hausnummer:', RAND, 644);
  feld('txtStrasse', 200, 639, 300, '');
  text('PLZ, Ort:', RAND, 616);
  feld('txtOrt', 200, 611, 300, '');

  text('2. Wohnung', RAND, 575, 11, fett);
  text('Wohnfläche in m²:', RAND, 550);
  feld('txtFlaeche', 200, 545, 80, '');
  text('Bruttokaltmiete im Monat in EUR:', RAND, 522);
  feld('txtMiete', 250, 517, 100, 'Miete ohne Heizung und Warmwasser');
  text('Wohnverhältnis:', RAND, 494);
  const art = form.createRadioGroup('rbWohnart');
  art.addOptionToPage('Hauptmieter', s, { x: 200, y: 491, width: 11, height: 11 });
  text('Hauptmieter', 215, 494, 9);
  art.addOptionToPage('Untermieter', s, { x: 300, y: 491, width: 11, height: 11 });
  text('Untermieter', 315, 494, 9);
  art.addOptionToPage('Heimbewohner', s, { x: 400, y: 491, width: 11, height: 11 });
  text('Heimbewohner', 415, 494, 9);

  text('3. Haushalt und Einkommen', RAND, 455, 11, fett);
  text('Anzahl der Personen im Haushalt:', RAND, 430);
  feld('txtPersonen', 250, 425, 50, '');
  form.createCheckBox('chkLeistung').addToPage(s, { x: RAND, y: 398, width: 11, height: 11 });
  text('Ich oder ein Haushaltsmitglied beziehe Bürgergeld, Grundsicherung oder Sozialhilfe.', RAND + 18, 400, 9);
  text('Monatliches Bruttoeinkommen des Haushalts in EUR:', RAND, 372);
  feld('txtEinkommen', 330, 367, 100, '');

  text('4. Erklärung', RAND, 330, 11, fett);
  text('Ich versichere, dass meine Angaben vollständig und richtig sind. Änderungen teile ich unverzüglich mit.', RAND, 310, 9);
  text('Ort, Datum:', RAND, 280);
  feld('txtOrtDatum', 200, 275, 200, '');
  text('Unterschrift: ________________________________', RAND, 240);

  writeFileSync(`${ZIEL}/wohngeld-antrag.pdf`, await doc.save());
  console.log(`${ZIEL}/wohngeld-antrag.pdf`);
}
