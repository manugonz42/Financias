// Parseo de las líneas de texto de un recibo (devueltas por el OCR) en
// productos (descripción + importe) y la fecha. Heurística por posición:
// el importe es el número al final de la línea; el producto, el texto previo.
// Las líneas de total/IVA/pago se descartan. No pretende acertar siempre:
// el usuario revisa y corrige en el editor (y la app aprende por producto).

export interface ParsedReceipt {
  items: { description: string; amount: number }[];
  date: string | null; // 'YYYY-MM-DD' si se detecta
  total: number | null; // total del ticket (para emparejar con el movimiento)
}

// Líneas que NO son productos (totales, impuestos, formas de pago…).
const SKIP = /\b(total|subtotal|i\.?v\.?a|base imponible|cambio|efectivo|tarjeta|entregado|a\s*pagar|importe|devoluci|propina|redondeo)\b/i;

// Importe al final de la línea: 1.234,56 / 1234.56 / 12,34, con € opcional.
const TRAILING_AMOUNT = /(-?\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}|\d+[.,]\d{2})\s*€?\s*$/;

// Fecha dd/mm/aaaa con / . o - (acepta año de 2 o 4 dígitos).
const DATE = /\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/;

/** Convierte un importe en texto (es/en) a número. */
export function parseAmount(raw: string): number {
  const dec = raw.match(/[.,](\d{2})\s*€?\s*$/); // separador decimal = el de los 2 últimos dígitos
  if (!dec) return NaN;
  const decSep = raw[dec.index!];
  const thousands = decSep === "," ? "." : ",";
  const cleaned = raw
    .replace(/[€\s]/g, "")
    .split(thousands).join("")
    .replace(decSep, ".");
  return parseFloat(cleaned);
}

function toISO(m: RegExpMatchArray): string {
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${yy}-${mm}-${dd}`;
}

export function parseReceipt(lines: string[]): ParsedReceipt {
  const items: { description: string; amount: number }[] = [];
  let date: string | null = null;
  let total: number | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (!date) {
      const d = line.match(DATE);
      if (d) date = toISO(d);
    }
    // Total del ticket: línea con "total" (no "subtotal") y un importe.
    if (/\btotal\b/i.test(line) && !/sub-?\s*total/i.test(line)) {
      const am = line.match(TRAILING_AMOUNT);
      if (am) {
        const v = parseAmount(am[0]);
        if (!Number.isNaN(v)) total = v;
      }
    }
    if (SKIP.test(line)) continue;

    const am = line.match(TRAILING_AMOUNT);
    if (!am || am.index == null) continue;
    const amount = parseAmount(am[0]);
    if (Number.isNaN(amount) || amount <= 0) continue;

    const description = line.slice(0, am.index).replace(/[.\-–·:]+$/, "").trim();
    if (description.length < 2) continue; // descarta ruido sin descripción

    items.push({ description, amount });
  }

  // Si no se detectó un total explícito, usa la suma de las líneas.
  if (total == null && items.length) {
    total = +items.reduce((s, i) => s + i.amount, 0).toFixed(2);
  }

  return { items, date, total };
}
