// Kopiert Worker, Kern und deutsches Sprachpaket von Tesseract nach public/tesseract/.
// So lädt die Texterkennung nichts von fremden Servern (sonst: cdn.jsdelivr.net).
// Läuft automatisch vor "npm run dev" und "npm run build".
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';

const ziel = 'public/tesseract';
mkdirSync(`${ziel}/core`, { recursive: true });
mkdirSync(`${ziel}/lang`, { recursive: true });

cpSync('node_modules/tesseract.js/dist/worker.min.js', `${ziel}/worker.min.js`);
for (const datei of readdirSync('node_modules/tesseract.js-core')) {
  if (/^tesseract-core.*\.(wasm\.js|wasm)$/.test(datei)) {
    cpSync(`node_modules/tesseract.js-core/${datei}`, `${ziel}/core/${datei}`);
  }
}
// Gleiche Variante wie der Standard von Tesseract.js bei LSTM (OEM 1): best_int
cpSync('node_modules/@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz', `${ziel}/lang/deu.traineddata.gz`);

if (!existsSync(`${ziel}/lang/deu.traineddata.gz`)) throw new Error('Sprachpaket fehlt');
console.log('Tesseract nach public/tesseract kopiert');
