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
import { parseUnicajaStatement, isUnicajaStatement } from "../src/import/unicajaParser";
import { parseBbvaStatement } from "../src/import/bbvaParser";
import { categorize, compileRules } from "../src/import/categorize";

const require = createRequire(import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
).href;

const NOMINA = resolve(__dirname, "../Movimientos de Cuenta.pdf");
const AHORRO = resolve(__dirname, "../Movimientos de Cuenta De ahorro.pdf");
const UNICAJA = resolve(__dirname, "../Movimientos Unicaja.pdf");

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

  it("detecta como interno un movimiento con solo el nombre del titular (sin 'TRANSFERENCIA')", () => {
    const rules = compileRules();
    const r = categorize(
      { fechaOperacion: "2026-06-01", fechaValor: "2026-06-01", concepto: "PEREZ GARCIA JUAN", importe: 700, saldo: 0 },
      rules,
      "PEREZ GARCIA JUAN",
    );
    expect(r.isInternal).toBe(true);
    // Un tercero con nombre distinto NO es interno.
    const other = categorize(
      { fechaOperacion: "2026-06-01", fechaValor: "2026-06-01", concepto: "MARIA LOPEZ SANZ", importe: 350, saldo: 0 },
      rules,
      "PEREZ GARCIA JUAN",
    );
    expect(other.isInternal).toBe(false);
  });
});

describe("Parser BBVA (tokens sintéticos)", () => {
  // El PDF real de BBVA contiene PII y no se versiona. Reproducimos su layout
  // (filas en 2 niveles verticales: cabecera con fecha+importe+saldo y línea
  // inferior con "Value date" + etiqueta del subtipo en inglés) con tokens
  // posicionados a mano para validar la extracción de bankSubtypeLabel.
  function row(
    yTop: number,
    op: string,
    val: string,
    merchantTokens: Array<[string, number]>,
    labelTokens: Array<[string, number]>,
    importe: string,
    saldo: string,
  ) {
    const tokens: Array<{ str: string; x: number; y: number }> = [];
    tokens.push({ str: op, x: 30, y: yTop });
    for (const [s, x] of merchantTokens) tokens.push({ str: s, x, y: yTop });
    tokens.push({ str: importe, x: 500, y: yTop });
    tokens.push({ str: saldo, x: 600, y: yTop });
    const yBot = yTop - 12;
    tokens.push({ str: "Value", x: 30, y: yBot });
    tokens.push({ str: "date", x: 45, y: yBot });
    tokens.push({ str: val, x: 60, y: yBot });
    for (const [s, x] of labelTokens) tokens.push({ str: s, x, y: yBot });
    return tokens;
  }

  it("separa Card payment del concepto", () => {
    const page = row(
      700,
      "13/06/2026",
      "13/06/2026",
      [["MERCADONA", 120], ["EJEMPLO", 175]],
      [["Card", 250], ["payment", 280]],
      "-9,99 €",
      "100,00 €",
    );
    const { transactions } = parseBbvaStatement([page]);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].bankSubtypeLabel).toBe("Card payment");
    expect(transactions[0].concepto).toBe("MERCADONA EJEMPLO");
    expect(transactions[0].importe).toBe(-9.99);
  });

  it("separa Direct debit y Bizum payment", () => {
    const direct = row(
      700,
      "01/06/2026",
      "01/06/2026",
      [["ENDESA", 120]],
      [["Direct", 250], ["debit", 290]],
      "-52,30 €",
      "200,00 €",
    );
    const bizum = row(
      660,
      "02/06/2026",
      "02/06/2026",
      [["MARIA", 120], ["LOPEZ", 170]],
      [["Bizum", 250], ["payment", 290]],
      "-15,00 €",
      "185,00 €",
    );
    const { transactions } = parseBbvaStatement([[...direct, ...bizum]]);
    expect(transactions).toHaveLength(2);
    expect(transactions[0].bankSubtypeLabel).toBe("Direct debit");
    expect(transactions[0].concepto).toBe("ENDESA");
    expect(transactions[1].bankSubtypeLabel).toBe("Bizum payment");
    expect(transactions[1].concepto).toBe("MARIA LOPEZ");
  });

  it("separa Bizum suelto, Others, Deposit from salary y Transfer from card", () => {
    const bizum = row(
      700, "08/06/2026", "07/06/2026",
      [["ENVIADO:", 120], ["Food", 165], ["payment", 200]],
      [["Bizum", 250]],
      "-7,00 €", "100,00 €",
    );
    const others = row(
      660, "04/06/2026", "04/06/2026",
      [["Bbva", 120], ["plan", 150], ["estarseguro", 180]],
      [["Others", 250]],
      "-17,22 €", "82,78 €",
    );
    const salary = row(
      620, "01/06/2026", "01/06/2026",
      [["Recibido:", 120], ["paga", 170]],
      [["Deposit", 250], ["from", 285], ["salary", 310], ["or", 345], ["pension", 360]],
      "1500,00 €", "1582,78 €",
    );
    const tfc = row(
      580, "25/05/2026", "25/05/2026",
      [["Credit-", 120], ["transfer", 155], ["from", 190], ["credit", 215], ["card", 240]],
      [["Transfer", 280], ["from", 320], ["card", 345]],
      "150,00 €", "1732,78 €",
    );
    const { transactions } = parseBbvaStatement([
      [...bizum, ...others, ...salary, ...tfc],
    ]);
    expect(transactions).toHaveLength(4);
    expect(transactions[0].bankSubtypeLabel).toBe("Bizum");
    expect(transactions[0].concepto).toBe("ENVIADO: Food payment");
    expect(transactions[1].bankSubtypeLabel).toBe("Others");
    // El parser filtra "Bbva" como cabecera de banco (NOISE_RE), así que la
    // regla de seguros casa sobre "plan estarseguro" sin el prefijo.
    expect(transactions[1].concepto).toBe("plan estarseguro");
    expect(transactions[2].bankSubtypeLabel).toBe("Deposit from salary or pension");
    expect(transactions[3].bankSubtypeLabel).toBe("Transfer from card");
  });
});

const hasUnicaja = existsSync(UNICAJA);
(hasUnicaja ? describe : describe.skip)("Parser de extractos Unicaja (PDF real)", () => {
  it("detecta el formato, parsea movimientos y el saldo encadena", async () => {
    const pages = await extract(UNICAJA);
    const fullText = pages.map((p) => p.map((t) => t.str).join(" ")).join(" ");
    expect(isUnicajaStatement(fullText)).toBe(true);

    const { account, transactions, warnings } = parseUnicajaStatement(pages);
    console.log(
      `UNICAJA -> ${transactions.length} movimientos, IBAN termina en ${account.last4}, warnings=${warnings.length}`,
    );
    expect(account.number.startsWith("ES")).toBe(true);
    expect(transactions.length).toBeGreaterThan(50);
    // El concepto no debe arrastrar las columnas NºMov + Oficina (dos grupos de
    // 4 dígitos seguidos al final). Un solo grupo de 4 (p. ej. últimos 4 de
    // tarjeta) es legítimo.
    const arrastra = transactions.filter((t) => /\d{4}\s+\d{4}\s*$/.test(t.concepto)).length;
    expect(arrastra).toBe(0);
    const mismatches = checkBalanceConsistency(transactions);
    console.log(`UNICAJA -> discrepancias de saldo: ${mismatches}`);
    expect(mismatches).toBeLessThanOrEqual(3);
  });
});
