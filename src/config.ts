// Angaben zur Anbieterin. Übernommen aus der Konfiguration der Website galini-studio.de, Stand 18.10.2026.
// Ändert sich dort etwas, hier mit ändern. Nie im Markup verstreuen, immer von hier holen.

export const marke = {
  name: 'Galini Studio',
  inhaberin: 'Dorota Mikolajczyk',
  url: 'https://galini-studio.de',
  quellcode: 'https://github.com/Dorota-Galini/Briefhelfer',
};

export const kontakt = {
  mail: 'kontakt@galini-studio.de',
  telefonAnzeige: '0155 67684966',
  telefonLink: '+4915567684966',
};

export const adresse = {
  strasse: 'Landwehrstr. 81 F',
  plz: '49393',
  ort: 'Lohne',
};

export const steuer = {
  ustIdNr: 'DE465201548',
};

// Betriebsart, beim Bauen festgelegt (Umgebungsvariable PUBLIC_BRIEFHELFER_MODUS):
//   "demo" – öffentliche Demo: nur Beispielbriefe, kein Upload, Antworten vorab erzeugt, nichts geht an eine KI
//   "voll" – zum Selbst-Betreiben: eigene Briefe, eigener API-Schlüssel (Standard)
export const MODUS: 'demo' | 'voll' = import.meta.env.PUBLIC_BRIEFHELFER_MODUS === 'demo' ? 'demo' : 'voll';

// Was erst beim Livegang feststeht. Solange etwas leer ist, zeigen die Rechtsseiten einen Entwurfs-Hinweis.
// Gilt für die öffentliche Demo. Netlify nutzt Dorota schon für ihre Website (mit AVV, wie dort
// in der Datenschutzerklärung beschrieben). Wer den Briefhelfer selbst betreibt, trägt hier die eigenen Angaben ein.
export const betrieb = {
  hoster: 'Netlify, Inc., 44 Montgomery Street, Suite 300, San Francisco, California 94104, USA',
  hosterDatenschutz: 'https://www.netlify.com/privacy/',
  feedbackSpeicherdauer: '12 Monate',
  stand: '18.10.2026',
};
