// Parser de extractos de movimientos de BBVA (formato "Latest movements" /
// "Últimos movimientos") con columnas:
//   Date | Reason | Amount | Balance
//
// A diferencia de Openbank, BBVA pinta cada movimiento en una "fila visual" que
// ocupa 2-3 líneas verticales:
//   Y₁ (arriba):  DD/MM/YYYY           Reason (negrita)        -X,XX €   Y,YY €
//   Y₂:           Value date DD/MM/YYYY  Subtipo (p.ej. "Card payment")
//   Y₃ (opcional): texto extra del concepto (p.ej. "ENVIADO: ...", "From X")
//
// El PDF de BBVA no incluye número de cuenta ni titular, así que sintetizamos
// una cuenta "BBVA" única para que el deduplicado funcione contra sí mismo y
// el usuario vea todos los imports de BBVA agrupados en la misma cuenta.

import type {
  PdfPage,
  PdfItem,
  ParsedAccount,
  ParsedTransaction,
  ParsedStatement,
} from "./openbankParser";
import { toISODate } from "./openbankParser";

const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
// Importe BBVA: formato español con o sin separador de miles. BBVA NO usa
// separador para cantidades pequeñas: "1463,27 €" en vez de "1.463,27 €".
// Símbolo € opcional. Ejemplos: "-9,99 €", "1463,27 €", "1.234,56", "-1000,99 €".
const AMOUNT_RE = /^-?\d+(?:\.\d{3})*,\d{2}(?:\s?€)?$/;

// Cabeceras, pie de página y texto repetido que descartamos del concepto.
// pdf.js tokeniza muchas frases palabra a palabra; por eso aparecen sueltas
// "Latest", "movements", "Value", "date"… y hay que filtrarlas individualmente.
const NOISE_RE =
  /^(BBVA|Date|Reason|Amount|Balance|Latest|movements|Últimos|Value|date|valor|\d+\/\d+|BANCO BILBAO VIZCAYA|.*Plaza de San Nicolás.*|.*CIF A-?\d+.*|.*Registro Mercantil.*)$/i;

const isDate = (s: string): boolean => DATE_RE.test(s.trim());
const isAmount = (s: string): boolean => AMOUNT_RE.test(s.trim());

/** ¿El texto del PDF corresponde a un extracto de BBVA? */
export function isBbvaStatement(fullText: string): boolean {
  return (
    /BANCO BILBAO VIZCAYA ARGENTARIA/i.test(fullText) ||
    /\bBBVA\b.*Latest movements/i.test(fullText) ||
    /\bBBVA\b.*Últimos movimientos/i.test(fullText)
  );
}

/** "1.234,56 €" -> 1234.56. Acepta el € opcional. */
export function parseBbvaAmount(raw: string): number {
  const cleaned = raw
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  if (Number.isNaN(n)) throw new Error(`Importe BBVA no parseable: "${raw}"`);
  return n;
}

function parseHeader(_fullText: string): ParsedAccount {
  // El PDF "Latest movements" de BBVA no expone IBAN ni titular. Usamos un
  // identificador sintético estable para que el upsert de cuenta agrupe todos
  // los imports de BBVA bajo la misma cuenta.
  return {
    type: "checking",
    number: "BBVA",
    last4: "",
    holder: "",
    name: "Cuenta BBVA",
  };
}

interface Record {
  tokens: PdfItem[];
}

/**
 * Agrupa los tokens de una página en registros. Cada movimiento se ancla en la
 * fecha de operación (la fecha más arriba en la columna izquierda). La fecha de
 * valor aparece justo debajo en la misma columna y NO debe usarse como ancla;
 * la descartamos buscando dates muy cercanas en Y al ancla anterior.
 */
function segmentRecords(page: PdfPage): Record[] {
  const clean = page.filter((t) => !NOISE_RE.test(t.str.trim()));
  const dateTokens = clean.filter((t) => isDate(t.str));
  if (dateTokens.length === 0) return [];

  // x de la columna de fechas = mínimo x entre los tokens de fecha (ignoramos
  // posibles fechas embebidas en el concepto, que estarán más a la derecha).
  const col0X = Math.min(...dateTokens.map((t) => t.x));
  const leftDates = dateTokens
    .filter((t) => Math.abs(t.x - col0X) <= 10)
    .sort((a, b) => b.y - a.y); // de arriba a abajo

  // Anclas = fechas de operación. Saltamos las que estén "pegadas" debajo de
  // un ancla (son la fecha de valor del mismo movimiento).
  const VALUE_DATE_GAP = 18; // px aproximados entre operación y valor en una fila
  const anchors: PdfItem[] = [];
  for (const d of leftDates) {
    const last = anchors[anchors.length - 1];
    if (last && last.y - d.y < VALUE_DATE_GAP) continue;
    anchors.push(d);
  }
  if (anchors.length === 0) return [];

  const groups: Record[] = anchors.map(() => ({ tokens: [] }));
  for (const t of clean) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < anchors.length; i++) {
      const d = Math.abs(t.y - anchors[i].y);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    groups[best].tokens.push(t);
  }
  return groups;
}

/** Construye una transacción a partir de los tokens de un registro BBVA. */
function buildTransaction(rec: Record, warnings: string[]): ParsedTransaction | null {
  const dates = rec.tokens.filter((t) => isDate(t.str));
  const amounts = rec.tokens.filter((t) => isAmount(t.str));

  if (dates.length < 1 || amounts.length < 2) {
    warnings.push(
      `Registro BBVA descartado (faltan fechas o importes): "${rec.tokens.map((t) => t.str).join(" ").slice(0, 80)}"`,
    );
    return null;
  }

  // Operación = fecha más alta (mayor y); valor = la siguiente debajo.
  const sortedDates = [...dates].sort((a, b) => b.y - a.y);
  const fechaOp = sortedDates[0].str;
  const fechaVal = (sortedDates[1] ?? sortedDates[0]).str;

  // Importe y saldo = los dos importes más a la derecha de la fila de la
  // operación (mismo Y que el ancla, aprox.).
  const sortedAmounts = [...amounts].sort((a, b) => a.x - b.x);
  const importeTok = sortedAmounts[sortedAmounts.length - 2];
  const saldoTok = sortedAmounts[sortedAmounts.length - 1];

  // Concepto = resto de tokens, quitando "Value date" (etiqueta de la fila
  // inferior) y conservando el subtipo (p.ej. "Card payment") como texto.
  const excluded = new Set<PdfItem>([sortedDates[0], importeTok, saldoTok]);
  if (sortedDates[1]) excluded.add(sortedDates[1]);
  const conceptoTokens = rec.tokens
    .filter((t) => !excluded.has(t))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const concepto = conceptoTokens
    .map((t) => t.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim();

  try {
    return {
      fechaOperacion: toISODate(fechaOp),
      fechaValor: toISODate(fechaVal),
      concepto,
      importe: parseBbvaAmount(importeTok.str),
      saldo: parseBbvaAmount(saldoTok.str),
    };
  } catch (e) {
    warnings.push(`Error parseando registro BBVA: ${(e as Error).message}`);
    return null;
  }
}

/** Parsea un extracto completo (todas las páginas) de BBVA. */
export function parseBbvaStatement(pages: PdfPage[]): ParsedStatement {
  const warnings: string[] = [];
  const fullText = pages.map((p) => p.map((t) => t.str).join(" ")).join(" ");
  const account = parseHeader(fullText);

  const transactions: ParsedTransaction[] = [];
  for (const page of pages) {
    for (const rec of segmentRecords(page)) {
      const tx = buildTransaction(rec, warnings);
      if (tx) transactions.push(tx);
    }
  }

  return { account, transactions, warnings };
}
