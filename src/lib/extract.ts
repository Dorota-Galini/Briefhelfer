// Liest Text aus PDF oder Foto. Alles passiert im Browser, die Datei wird nirgends hochgeladen.
// Tesseract (Worker, Kern, Sprachpaket) liegt unter public/tesseract und kommt vom eigenen Server.

import { baueLayout, type Stueck } from './layout';
import { findeKaestchen, type Kaestchen } from './kaestchen';
import { baueText } from './ocrtext';

export type Fortschritt = (meldung: string, anteil?: number) => void;

export async function leseDatei(datei: File, fortschritt: Fortschritt): Promise<string> {
  if (datei.type === 'application/pdf' || datei.name.toLowerCase().endsWith('.pdf')) {
    const text = await lesePdf(datei, fortschritt);
    // Gescannte PDFs haben oft keine Textebene. Dann ist das Ergebnis (fast) leer.
    if (text.replace(/\s/g, '').length > 40) return text;
    fortschritt('Das PDF enthält keinen Text. Es wird als Bild gelesen …');
    return await lesePdfAlsBild(datei, fortschritt);
  }
  if (datei.type.startsWith('image/')) {
    return await leseBild(datei, fortschritt);
  }
  throw new Error('Bitte ein PDF oder ein Foto (JPG, PNG) auswählen.');
}

async function ladePdfJs() {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

async function lesePdf(datei: File, fortschritt: Fortschritt): Promise<string> {
  const seiten = await lesePdfStuecke(datei, fortschritt);
  return seiten.map(baueLayout).join('\n\n');
}

/** Textstücke jeder Seite mit Position in PDF-Koordinaten (auch für die Formular-Beschriftungen). */
export async function lesePdfStuecke(datei: File, fortschritt: Fortschritt = () => {}): Promise<Stueck[][]> {
  const pdfjs = await ladePdfJs();
  const doc = await pdfjs.getDocument({ data: await datei.arrayBuffer() }).promise;
  const seiten: Stueck[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    fortschritt(`Seite ${i} von ${doc.numPages} wird gelesen …`, i / doc.numPages);
    const seite = await doc.getPage(i);
    const inhalt = await seite.getTextContent();
    const stuecke: Stueck[] = [];
    for (const item of inhalt.items) {
      if (!('str' in item)) continue;
      const [a, b, , , x, y] = item.transform;
      stuecke.push({ str: item.str, x, y, breite: item.width, hoehe: item.height || Math.hypot(a, b) });
    }
    seiten.push(stuecke);
  }
  return seiten;
}

// Tesseract liest Scans mit etwa dieser Breite deutlich besser als kleinere
// (auf einem A4-Testscan rund 15 % mehr richtig erkannte Wörter als bei 2500 Pixeln).
const OCR_BREITE = 3200;

async function lesePdfAlsBild(datei: File, fortschritt: Fortschritt): Promise<string> {
  const pdfjs = await ladePdfJs();
  const doc = await pdfjs.getDocument({ data: await datei.arrayBuffer() }).promise;
  const bilder: HTMLCanvasElement[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const seite = await doc.getPage(i);
    const ansicht = seite.getViewport({ scale: OCR_BREITE / seite.getViewport({ scale: 1 }).width });
    const canvas = document.createElement('canvas');
    canvas.width = ansicht.width;
    canvas.height = ansicht.height;
    await seite.render({ canvasContext: canvas.getContext('2d')!, viewport: ansicht }).promise;
    bilder.push(canvas);
  }
  return await ocr(bilder, fortschritt);
}

async function leseBild(datei: File, fortschritt: Fortschritt): Promise<string> {
  return await ocr([await vergroessere(datei)], fortschritt);
}

// Kleine Fotos und Scans auf OCR_BREITE hochrechnen, große bleiben, wie sie sind
async function vergroessere(bild: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(bild);
  const faktor = Math.min(2, Math.max(1, OCR_BREITE / bitmap.width));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * faktor);
  canvas.height = Math.round(bitmap.height * faktor);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

async function ocr(bilder: HTMLCanvasElement[], fortschritt: Fortschritt): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  fortschritt('Texterkennung wird vorbereitet …');
  let seite = 1;
  // Alles vom eigenen Server (public/tesseract), nichts von fremden CDNs
  const basis = `${location.origin}/tesseract`;
  const worker = await createWorker('deu', 1, {
    workerPath: `${basis}/worker.min.js`,
    corePath: `${basis}/core`,
    langPath: `${basis}/lang`,
    logger: (m) => {
      if (m.status === 'recognizing text') {
        fortschritt(`Text wird erkannt (Seite ${seite} von ${bilder.length}) …`, m.progress);
      }
    },
  });
  try {
    const texte: string[] = [];
    for (const bild of bilder) {
      const kaestchen = sucheKaestchen(bild);
      const { data } = await worker.recognize(bild, {}, { text: true, blocks: true });
      texte.push(data.blocks ? baueText(data.blocks, kaestchen) : data.text);
      seite++;
    }
    return texte.join('\n\n');
  } finally {
    await worker.terminate();
  }
}

// Die Kästchensuche ist auf etwa diese Breite abgestimmt (Linienstärke, Abstände)
const KAESTCHEN_BREITE = 1272;

function sucheKaestchen(bild: HTMLCanvasElement): Kaestchen[] {
  try {
    const faktor = Math.min(1, KAESTCHEN_BREITE / bild.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bild.width * faktor);
    canvas.height = Math.round(bild.height * faktor);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    // Ohne hohe Qualität verschluckt das Verkleinern die oft blassen Kästchenlinien
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bild, 0, 0, canvas.width, canvas.height);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return findeKaestchen({ breite: width, hoehe: height, daten: data }, bild.width / width);
  } catch {
    // Ohne Kästchen geht es auch, dann eben nur der erkannte Text
    return [];
  }
}
