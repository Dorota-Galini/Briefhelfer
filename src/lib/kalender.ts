// Erzeugt eine .ics-Datei mit ganztägigen Terminen für die Fristen. Läuft nur im Browser.
// Titel und Beschreibung sollen neutral sein: Kalender werden oft in die Cloud synchronisiert.

export interface Termin {
  datumIso: string; // JJJJ-MM-TT
  titel: string;
  beschreibung?: string;
}

/** Erinnerung passend zum Abstand: 3 Tage vorher, bei knappen Fristen 1 Tag vorher, sonst keine. */
export function erinnerungTage(datumIso: string, jetzt: Date): number | null {
  const frist = Date.UTC(+datumIso.slice(0, 4), +datumIso.slice(5, 7) - 1, +datumIso.slice(8, 10));
  const heute = Date.UTC(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
  const tage = Math.round((frist - heute) / 86_400_000);
  if (tage >= 7) return 3;
  if (tage >= 2) return 1;
  return null;
}

export function baueIcs(termine: Termin[], jetzt = new Date()): string {
  const stempel = jetzt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const zeilen = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Briefhelfer//DE', 'CALSCALE:GREGORIAN'];
  termine
    .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.datumIso))
    .forEach((t, i) => {
      const tag = t.datumIso.replace(/-/g, '');
      const vorher = erinnerungTage(t.datumIso, jetzt);
      zeilen.push(
        'BEGIN:VEVENT',
        `UID:${stempel}-${i}@briefhelfer`,
        `DTSTAMP:${stempel}`,
        `DTSTART;VALUE=DATE:${tag}`,
        `DTEND;VALUE=DATE:${naechsterTag(t.datumIso)}`,
        `SUMMARY:${escape(t.titel)}`,
        ...(t.beschreibung ? [`DESCRIPTION:${escape(t.beschreibung)}`] : []),
        ...(vorher === null
          ? []
          : ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escape(t.titel)}`, `TRIGGER:-P${vorher}D`, 'END:VALARM']),
        'END:VEVENT',
      );
    });
  zeilen.push('END:VCALENDAR');
  return zeilen.join('\r\n') + '\r\n';
}

function naechsterTag(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function escape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}
