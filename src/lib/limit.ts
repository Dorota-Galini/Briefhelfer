// Einfaches Tageslimit pro Adresse, im Speicher des Servers.
// Reicht für die Demo. Bei mehreren Server-Instanzen (Serverless) zählt jede für sich,
// deshalb zusätzlich immer ein Ausgabenlimit in der Anthropic Console setzen.

const PRO_TAG = Number(process.env.BRIEFHELFER_LIMIT_PRO_TAG ?? 5);
const zaehler = new Map<string, { tag: string; anzahl: number }>();

export function pruefeLimit(adresse: string, jetzt = new Date()): { erlaubt: boolean; verbleibend: number } {
  const tag = jetzt.toISOString().slice(0, 10);
  const eintrag = zaehler.get(adresse);
  const anzahl = eintrag?.tag === tag ? eintrag.anzahl : 0;
  if (anzahl >= PRO_TAG) return { erlaubt: false, verbleibend: 0 };
  zaehler.set(adresse, { tag, anzahl: anzahl + 1 });
  // Alte Einträge gelegentlich aufräumen
  if (zaehler.size > 10_000) for (const [k, v] of zaehler) if (v.tag !== tag) zaehler.delete(k);
  return { erlaubt: true, verbleibend: PRO_TAG - anzahl - 1 };
}
