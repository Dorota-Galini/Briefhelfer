// Gemeinsame Schritte von Startseite und Werkstatt, damit beide exakt gleich verarbeiten.
// Wichtig für die Demo: Die vorab erzeugten Antworten passen nur, wenn der gesendete Text identisch ist.

/** Text nach dem Einlesen: Zeilenenden vereinheitlichen, Leerzeilen am Anfang weg, Einrückungen bleiben. */
export function vorbereiten(roh: string): string {
  return roh.replace(/\r\n/g, '\n').replace(/^\s*\n/, '').trimEnd();
}
