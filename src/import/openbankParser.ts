// Parser de extractos de movimientos de Openbank (formato "HACE CONSTAR ...").
//
// El parser trabaja sobre tokens posicionados {str, x, y} que se obtienen de
// pdf.js (ver loadPdf.ts). Se mantiene agnóstico del DOM para poder probarlo
// de forma aislada en Node.
//
// Estructura de la tabla en el PDF:
//   Fecha Operación | Fecha Valor | Concepto (multilínea) | Importe | Saldo
//
// Estrategia:
//   1. Se detecta la cuenta (tipo, número, titular) de la cabecera.
//   2. Cada página se recorre en orden de lectura (y descendente, x ascendente).
//   3. Una transacción ("registro") se ancla en la fecha de la columna izquierda
//      (Fecha Operación). Todo lo que aparece hasta la siguiente fecha-ancla
//      pertenece al mismo registro (los conceptos ocupan varias líneas).
//   4. Dentro del registro:
//        - Los dos tokens de fecha más a la izquierda -> Operación y Valor.
//        - Los DOS tokens con formato importe situados más a la derecha ->
//          Importe (x menor) y Saldo (x mayor). Esto ignora importes que
//          aparecen dentro del concepto (p.ej. "COMISION 0,00").
//        - El resto de tokens -> Concepto.

export type PdfItem = { str: string; x: number; y: number };
export type PdfPage = PdfItem[];

export type AccountType = import("../types").AccountType;

export interface ParsedAccount {
  type: AccountType;
  /** Número de cuenta tal cual aparece, p.ej. "0073 0100 55 0123456789". */
  number: string;
  /** Últimos 4 dígitos, para mostrar enmascarado. */
  last4: string;
  /** Nombre del titular (se usa para detectar traspasos internos). */
  holder: string;
  /** Nombre a mostrar para la cuenta (si el parser lo sabe, p.ej. el banco). */
  name?: string;
}

export interface ParsedTransaction {
  /** Fecha de operación en ISO (YYYY-MM-DD). */
  fechaOperacion: string;
  /** Fecha valor en ISO (YYYY-MM-DD). */
  fechaValor: string;
  /** Concepto en bruto, tal cual aparece en el extracto. */
  concepto: string;
  /** Importe con signo (negativo = cargo, positivo = abono). */
  importe: number;
  /** Saldo resultante según el extracto. */
  saldo: number;
  /** Etiqueta del subtipo que algunos bancos imprimen al lado del comercio
   *  (p.ej. BBVA: "Card payment", "Direct debit", "Bizum payment"). Se separa
   *  para no contaminar el concepto y para inferir mejor el subtipo. */
  bankSubtypeLabel?: string;
}

export interface ParsedStatement {
  account: ParsedAccount;
  transactions: ParsedTransaction[];
  /** Avisos no fatales detectados durante el parseo. */
  warnings: string[];
}

const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
// Importe estilo español, con "EUR" opcional pegado: "-38,66 EUR" / "1.385,81 EUR" / "0,00"
const AMOUNT_RE = /^-?\d{1,3}(?:\.\d{3})*,\d{2}(?:\s?EUR)?$/;
// Cabeceras de columna, preámbulo legal y pie de página a descartar.
const NOISE_RE =
  /Open\s?Bank|Domicilio Social|entidad de cr[ée]dito|HACE CONSTAR|Que en esta entidad|mantiene abierta|se detalla a continuaci|Registro Mercantil|con NIF|Página:|P\.P\.|^Fecha$|^Operación$|^Fecha Valor$|^Concepto$|^Importe$|^Saldo$/i;

/** Convierte "1.234,56" (es) a number. Lanza si no es válido. */
export function parseSpanishAmount(raw: string): number {
  const cleaned = raw.replace(/\s|EUR/gi, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  if (Number.isNaN(n)) throw new Error(`Importe no parseable: "${raw}"`);
  return n;
}

/** Convierte "dd/mm/yyyy" a "yyyy-mm-dd". */
export function toISODate(ddmmyyyy: string): string {
  const m = DATE_RE.exec(ddmmyyyy);
  if (!m) throw new Error(`Fecha no parseable: "${ddmmyyyy}"`);
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function isDate(s: string): boolean {
  return DATE_RE.test(s);
}
function isAmount(s: string): boolean {
  return AMOUNT_RE.test(s);
}

/** Detecta la cuenta a partir del texto completo de la primera(s) página(s). */
export function parseAccountHeader(fullText: string): ParsedAccount {
  // Tipo + número: "(CUENTA NÓMINA OPEN) 0073 0100 55 0123456789"
  //                "(CUENTA DE AHORRO OPENBANK) 0073 0100 58 0123456789"
  const acctRe =
    /\(CUENTA\s+(.+?)\)\s*([0-9]{4}\s+[0-9]{4}\s+[0-9]{2}\s+[0-9]+)/i;
  const am = acctRe.exec(fullText);
  let type: AccountType = "checking";
  let number = "";
  if (am) {
    const desc = am[1].toUpperCase();
    type = /AHORRO/.test(desc) ? "savings" : "checking";
    number = am[2].replace(/\s+/g, " ").trim();
  }
  const digits = number.replace(/\D/g, "");
  const last4 = digits.slice(-4);

  // Titular: "a nombre de DON/DÑA <NOMBRE>, con NIF"
  const holderRe = /a\s+nombre\s+de\s+DON\/D[ÑN]A\s+(.+?),\s*con\s+NIF/i;
  const hm = holderRe.exec(fullText);
  const holder = hm ? hm[1].replace(/\s+/g, " ").trim() : "";

  return { type, number, last4, holder };
}

interface Record {
  tokens: PdfItem[];
}

/**
 * Agrupa los tokens de una página en registros. Cada fila de la tabla se ancla
 * en la fecha de la primera columna (Fecha Operación). El resto de tokens
 * (fecha valor, líneas de concepto, importe y saldo) se asignan al ancla cuya
 * coordenada `y` está más cerca: las líneas de un mismo movimiento quedan a ~5px
 * de su fecha, mientras que los movimientos contiguos distan ~20px.
 */
function segmentRecords(page: PdfPage): Record[] {
  const clean = page.filter((t) => !NOISE_RE.test(t.str.trim()));
  const dateTokens = clean.filter((t) => isDate(t.str));
  if (dateTokens.length === 0) return [];

  // x de la primera columna de fechas = mínimo x entre los tokens de fecha.
  const col0X = Math.min(...dateTokens.map((t) => t.x));
  const anchors = dateTokens
    .filter((t) => Math.abs(t.x - col0X) <= 25)
    .sort((a, b) => b.y - a.y); // de arriba a abajo
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

/** Construye una transacción a partir de los tokens de un registro. */
function buildTransaction(rec: Record, warnings: string[]): ParsedTransaction | null {
  const dates = rec.tokens.filter((t) => isDate(t.str)).sort((a, b) => a.x - b.x);
  const amounts = rec.tokens.filter((t) => isAmount(t.str)).sort((a, b) => a.x - b.x);

  if (dates.length < 1 || amounts.length < 2) {
    warnings.push(
      `Registro descartado (faltan fechas o importes): "${rec.tokens.map((t) => t.str).join(" ").slice(0, 80)}"`,
    );
    return null;
  }

  const fechaOp = dates[0].str;
  const fechaVal = (dates[1] ?? dates[0]).str;

  // Importe y saldo = los dos importes situados más a la derecha.
  const saldoTok = amounts[amounts.length - 1];
  const importeTok = amounts[amounts.length - 2];

  // Concepto = resto de tokens (ni fechas ni los dos importes finales),
  // en orden de lectura.
  const excluded = new Set<PdfItem>([dates[0], saldoTok, importeTok]);
  if (dates[1]) excluded.add(dates[1]);
  const conceptoTokens = rec.tokens
    .filter((t) => !excluded.has(t))
    .sort((a, b) => (b.y - a.y) || (a.x - b.x));
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
      importe: parseSpanishAmount(importeTok.str),
      saldo: parseSpanishAmount(saldoTok.str),
    };
  } catch (e) {
    warnings.push(`Error parseando registro: ${(e as Error).message}`);
    return null;
  }
}

/** Parsea un extracto completo (todas las páginas) de Openbank. */
export function parseOpenbankStatement(pages: PdfPage[]): ParsedStatement {
  const warnings: string[] = [];
  const fullText = pages
    .map((p) => p.map((t) => t.str).join(" "))
    .join(" ");

  const account = parseAccountHeader(fullText);
  if (!account.number) {
    warnings.push("No se pudo detectar el número de cuenta en la cabecera.");
  }

  const transactions: ParsedTransaction[] = [];
  for (const page of pages) {
    for (const rec of segmentRecords(page)) {
      const tx = buildTransaction(rec, warnings);
      if (tx) transactions.push(tx);
    }
  }

  return { account, transactions, warnings };
}

/**
 * Validación de integridad: usando el saldo del extracto, comprueba que
 * saldo[i-1] + importe[i-1]... encadene. En estos extractos el orden es
 * descendente (más reciente primero), así que verificamos que
 * saldo(fila) - importe(fila) == saldo(fila siguiente, más antigua).
 * Devuelve el número de discrepancias (0 = perfecto).
 */
export function checkBalanceConsistency(txs: ParsedTransaction[]): number {
  let mismatches = 0;
  for (let i = 0; i < txs.length - 1; i++) {
    const expectedPrev = +(txs[i].saldo - txs[i].importe).toFixed(2);
    if (Math.abs(expectedPrev - txs[i + 1].saldo) > 0.015) mismatches++;
  }
  return mismatches;
}
