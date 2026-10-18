import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { loadEnv } from 'vite';

// Geheimnisse (ANTHROPIC_API_KEY) liest der Server zur Laufzeit aus process.env, nie aus import.meta.env,
// damit sie beim Bauen nicht in dist/server landen. Für "npm run dev" holen wir sie hier aus .env.
// Bereits gesetzte Umgebungsvariablen haben Vorrang.
const modus = process.argv.includes('--mode') ? process.argv[process.argv.indexOf('--mode') + 1] : 'development';
for (const [name, wert] of Object.entries(loadEnv(modus, process.cwd(), ''))) {
  if (process.env[name] === undefined && !name.startsWith('PUBLIC_')) process.env[name] = wert;
}

// Seite statisch, nur /api/* läuft auf dem Server.
// Für das Hosting später ggf. den Adapter wechseln (z. B. Vercel mit Region Frankfurt).
export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  server: { port: 4321 },
  vite: {
    server: {
      // Die Werkstatt schreibt hier Antworten hinein. Ohne Ausnahme lädt Vite nach jeder Datei die Seite neu
      // und bricht die Werkstatt ab. Neue Antworten sind nach einem Neustart von "npm run dev" sichtbar.
      watch: { ignored: ['**/src/beispiele/antworten/**'] },
    },
  },
});
