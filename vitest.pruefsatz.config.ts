// Eigene Konfiguration für den Prüfsatz gegen die echte API (npm run pruefsatz).
// Liest den Schlüssel aus .env, damit er nicht in der Kommandozeile stehen muss.
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig({
  test: {
    include: ['pruefsatz/**/*.pruef.ts'],
    env: loadEnv('pruefsatz', process.cwd(), ''),
    testTimeout: 180_000,
    // Nacheinander, um Ratenlimits zu schonen
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
