// Carga de PDF en el navegador (Tauri webview) con pdf.js.
// Devuelve, por página, los tokens de texto con su posición {str, x, y}.

import * as pdfjs from "pdfjs-dist";
// Vite resuelve el worker como URL y lo empaqueta.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PdfPage } from "./openbankParser";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractPages(data: Uint8Array): Promise<PdfPage[]> {
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: PdfPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const raw = content.items as Array<{ str?: string; transform?: number[] }>;
    const items = raw
      .filter((it) => typeof it.str === "string" && it.str.trim() !== "" && Array.isArray(it.transform))
      .map((it) => ({
        str: it.str as string,
        x: (it.transform as number[])[4],
        y: (it.transform as number[])[5],
      }));
    pages.push(items);
  }
  await doc.destroy();
  return pages;
}
