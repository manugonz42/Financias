import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createRequire } from "module";
import { pathToFileURL } from "url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  parseOpenbankStatement,
  checkBalanceConsistency,
  type PdfPage,
} from "../src/import/openbankParser";
import { categorize, compileRules } from "../src/import/categorize";

const require = createRequire(import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
).href;

const NOMINA = resolve(__dirname, "../Movimientos de Cuenta.pdf");
const AHORRO = resolve(__dirname, "../Movimientos de Cuenta De ahorro.pdf");

async function extract(path: string): Promise<PdfPage[]> {
  const data = new Uint8Array(readFileSync(path));
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: PdfPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items
      .filter(
        (it: any) => typeof it.str === "string" && it.str.trim() !== "",
      )
      .map((it: any) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));
    pages.push(items);
  }
  return pages;
}

const hasPdfs = existsSync(NOMINA) && existsSync(AHORRO);
const maybe = hasPdfs ? describe : describe.skip;

maybe("Parser de extractos Openbank (PDFs reales)", () => {
  it("parsea la cuenta nómina y el saldo encadena", async () => {
    const pages = await extract(NOMINA);
    const { account, transactions, warnings } = parseOpenbankStatement(pages);
    console.log(
      `NÓMINA -> ${transactions.length} movimientos, titular="${account.holder}", tipo=${account.type}, warnings=${warnings.length}`,
    );
    expect(account.type).toBe("checking");
    expect(account.holder.length).toBeGreaterThan(0);
    expect(transactions.length).toBeGreaterThan(200);
    const mismatches = checkBalanceConsistency(transactions);
    console.log(`NÓMINA -> discrepancias de saldo: ${mismatches}`);
    expect(mismatches).toBeLessThanOrEqual(3);
  });

  it("parsea la cuenta de ahorro y el saldo encadena", async () => {
    const pages = await extract(AHORRO);
    const { account, transactions } = parseOpenbankStatement(pages);
    console.log(
      `AHORRO -> ${transactions.length} movimientos, tipo=${account.type}`,
    );
    expect(account.type).toBe("savings");
    expect(transactions.length).toBeGreaterThan(30);
    const mismatches = checkBalanceConsistency(transactions);
    console.log(`AHORRO -> discrepancias de saldo: ${mismatches}`);
    expect(mismatches).toBeLessThanOrEqual(3);
  });

  it("categoriza correctamente conceptos representativos", async () => {
    const rules = compileRules();
    // Datos sintéticos (no reales) para no exponer información personal.
    const owner = "PEREZ GARCIA JUAN";
    const cases: Array<[string, number, string, boolean]> = [
      ["RECIBO ENERGIA XXI Nº RECIBO 0073 0100 755 ABCDEFG", -38.66, "Suministros", false],
      ["Google pay: COMPRA EN MERCADONA EJEMPLO, CON LA TARJETA : 0000 EL 2026-06-13", -51.93, "Supermercado", false],
      ["DISPOSICION EN CAJERO CON LA TARJETA 0000, COMISION 0,00, EL 2026-06-08", -150, "Cajero / Efectivo", false],
      ["TRANSFERENCIA INMEDIATA A FAVOR DE Juan Perez Garcia CONCEPTO Casa", -1100, "Traspaso interno", true],
      ["TRANSFERENCIA DE EMPRESA EJEMPLO S.L., CONCEPTO Pago Nomina 01-2026", 1500, "Nómina", false],
      ["RECIBO DIGI SPAIN TELECOM SA Nº RECIBO 0073", -22.34, "Telefonía e Internet", false],
      ["COMPRA EN KFC, CON LA TARJETA : 0000 EL 2026-06-03", -1.48, "Restauración", false],
      ["TRANSFERENCIA INMEDIATA A FAVOR DE Tercero Ejemplo S L CONCEPTO Resto del pago", -999, "Otros gastos", false],
    ];
    for (const [concepto, importe, expectedCat, expectedInternal] of cases) {
      const r = categorize(
        { fechaOperacion: "2026-06-01", fechaValor: "2026-06-01", concepto, importe, saldo: 0 },
        rules,
        owner,
      );
      expect(r.category, `concepto: ${concepto}`).toBe(expectedCat);
      expect(r.isInternal, `interno: ${concepto}`).toBe(expectedInternal);
    }
  });
});
