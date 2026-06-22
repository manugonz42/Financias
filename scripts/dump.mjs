import { readFileSync } from "fs";
import { createRequire } from "module";
import { pathToFileURL } from "url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
).href;

const path = process.argv[2] ?? "Movimientos de Cuenta.pdf";
const data = new Uint8Array(readFileSync(path));
const doc = await pdfjs.getDocument({ data }).promise;
const page = await doc.getPage(1);
const content = await page.getTextContent();
const items = content.items
  .filter((it) => typeof it.str === "string" && it.str.trim() !== "")
  .map((it) => ({ str: it.str, x: +it.transform[4].toFixed(1), y: +it.transform[5].toFixed(1) }));
console.log("total items pág.1:", items.length);
for (const it of items.slice(0, 60)) {
  console.log(`x=${String(it.x).padStart(7)}  y=${String(it.y).padStart(7)}  |${it.str}|`);
}
