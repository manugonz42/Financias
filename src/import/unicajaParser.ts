// Parser de extractos de movimientos de Unicaja (formato
// "CONSULTA DE MOVIMIENTOS DEL IBAN/ALIAS: ...").
//
// A diferencia de Openbank, cada movimiento ocupa UNA sola línea con columnas
// fijas por coordenada x:
//   Fecha | Fecha Valor | Concepto (+ referencia) | Importe | Saldo | NºMov | Oficina
// El importe ya trae signo. NºMov y Oficina son enteros (sin decimales) que se
// descartan por estar a la derecha del saldo.

import type {
  PdfPage,
  PdfItem,
  ParsedAccount,
  ParsedTransaction,
  ParsedStatement,
} from "./openbankParser";
import { toISODate, parseSpanishAmount } from "./openbankParser";

const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
// Importe estilo español con "EUR" opcional: "-1.011,29 EUR" / "700,00 EUR".
const AMOUNT_RE = /^-?\d{1,3}(?:\.\d{3})*,\d{2}(?:\s?EUR)?$/;

const isDate = (s: string) => DATE_RE.test(s);
const isAmount = (s: string) => AMOUNT_RE.test(s);

/** ¿El texto del PDF corresponde a un extracto de Unicaja? */
export function isUnicajaStatement(fullText: string): boolean {
  return (
    /CONSULTA DE MOVIMIENTOS DEL IBAN/i.test(fullText) ||
    /\bUNICAJA\b/i.test(fullText)
  );
}

function parseHeader(fullText: string): ParsedAccount {
  // IBAN tras "IBAN/ALIAS:" o el primer IBAN español que aparezca.
  const m =
    /IBAN\/ALIAS:\s*([A-Z]{2}\d{2}(?:\s?\d{4}){4,6})/i.exec(fullText) ||
    /\b(ES\d{2}(?:\s?\d{4}){4,6})\b/.exec(fullText);
  const number = m ? m[1].replace(/\s+/g, " ").trim() : "";
  const last4 = number.replace(/\D/g, "").slice(-4);
  // No hay titular en la cabecera; se infiere del que ya esté guardado.
  return { type: "checking", number, last4, holder: "", name: "Cuenta Unicaja" };
}

/** Agrupa los tokens de una página por línea (coordenada y redondeada). */
function linesByY(page: PdfPage): PdfItem[][] {
  const byY = new Map<number, PdfItem[]>();
  for (const t of page) {
    if (t.str.trim() === "") continue;
    const key = Math.round(t.y);
    const arr = byY.get(key) ?? [];
    arr.push(t);
    byY.set(key, arr);
  }
  return [...byY.entries()]
    .sort((a, b) => b[0] - a[0]) // de arriba a abajo
    .map(([, arr]) => arr.sort((a, b) => a.x - b.x));
}

function buildTransaction(
  line: PdfItem[],
  warnings: string[],
): ParsedTransaction | null {
  const dates = line.filter((t) => isDate(t.str)).sort((a, b) => a.x - b.x);
  const amounts = line.filter((t) => isAmount(t.str)).sort((a, b) => a.x - b.x);
  // Una fila de movimiento tiene fecha + (al menos) importe y saldo.
  if (dates.length < 1 || amounts.length < 2) return null;

  const fechaOp = dates[0].str;
  const fechaVal = (dates[1] ?? dates[0]).str;
  const importeTok = amounts[amounts.length - 2];
  const saldoTok = amounts[amounts.length - 1];

  // Concepto = tokens de texto a la izquierda del importe (excluye fechas,
  // importes y las columnas NºMov/Oficina, que quedan a la derecha del saldo).
  const concepto = line
    .filter((t) => !isDate(t.str) && !isAmount(t.str) && t.x < importeTok.x)
    .map((t) => t.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  try {
    return {
      fechaOperacion: toISODate(fechaOp),
      fechaValor: toISODate(fechaVal),
      concepto,
      importe: parseSpanishAmount(importeTok.str),
      saldo: parseSpanishAmount(saldoTok.str),
    };
  } catch (e) {
    warnings.push(`Error parseando registro Unicaja: ${(e as Error).message}`);
    return null;
  }
}

/** Parsea un extracto completo de Unicaja. */
export function parseUnicajaStatement(pages: PdfPage[]): ParsedStatement {
  const warnings: string[] = [];
  const fullText = pages.map((p) => p.map((t) => t.str).join(" ")).join(" ");
  const account = parseHeader(fullText);
  if (!account.number) {
    warnings.push("No se detectó el IBAN en la cabecera del extracto de Unicaja.");
  }

  const transactions: ParsedTransaction[] = [];
  for (const page of pages) {
    for (const line of linesByY(page)) {
      const tx = buildTransaction(line, warnings);
      if (tx) transactions.push(tx);
    }
  }
  return { account, transactions, warnings };
}
