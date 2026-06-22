// Enriquecimiento de un movimiento parseado: categoría, subtipo, comercio,
// últimos 4 de tarjeta y detección de traspaso interno.

import { normalize } from "../lib/text";
import type { ParsedTransaction } from "./openbankParser";
import {
  RULES,
  type RuleSeed,
  type Subtype,
  FALLBACK_EXPENSE,
  FALLBACK_INCOME,
  INTERNAL_CATEGORY,
} from "../rules/categoryRules";

export interface CategorizedFields {
  category: string;
  subtype: Subtype;
  merchant: string | null;
  cardLast4: string | null;
  isInternal: boolean;
}

export interface CompiledRule {
  re: RegExp;
  category: string;
  subtype?: Subtype;
}

/** Compila y ordena las reglas por prioridad (menor primero). */
export function compileRules(rules: RuleSeed[] = RULES): CompiledRule[] {
  return [...rules]
    .sort((a, b) => a.priority - b.priority)
    .map((r) => ({ re: new RegExp(r.pattern), category: r.category, subtype: r.subtype }));
}

/** Extrae el comercio del concepto en bruto, según el tipo de movimiento. */
export function extractMerchant(concepto: string): string | null {
  // Compras con tarjeta: "COMPRA EN <X>, CON LA TARJETA" (con o sin "Google/Apple pay:")
  let m = /COMPRA EN\s+(.+?)\s*,?\s*CON LA TARJETA/i.exec(concepto);
  if (m) return clean(m[1]);
  // Recibos domiciliados: "RECIBO <X> Nº RECIBO" / "RECIBO <X> N° RECIBO"
  m = /RECIBO\s+(.+?)\s+N[º°]\s*RECIBO/i.exec(concepto);
  if (m) return clean(m[1]);
  // Transferencias a favor de un tercero
  m = /A FAVOR DE\s+(.+?)(?:\s+CONCEPTO|\s*$)/i.exec(concepto);
  if (m) return clean(m[1]);
  // Transferencias recibidas
  m = /TRANSFERENCIA(?:\s+INMEDIATA)?\s+DE\s+(.+?)(?:,?\s*CONCEPTO|\s*$)/i.exec(concepto);
  if (m) return clean(m[1]);
  return null;
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Últimos 4 dígitos de la tarjeta si aparece en el concepto. */
export function extractCardLast4(concepto: string): string | null {
  const m = /TARJETA\s*:?\s*(\d{12,19})/i.exec(concepto);
  return m ? m[1].slice(-4) : null;
}

/** Infiere el subtipo a partir del concepto normalizado. */
function inferSubtype(n: string): Subtype {
  if (/DISPOSICION EN CAJERO/.test(n)) return "cajero";
  if (/COMPRA EN|COMPRA REALIZ/.test(n)) return "compra";
  if (/RECIBO/.test(n)) return "recibo";
  if (/TRANSFERENCIA/.test(n)) return "transferencia";
  if (/LIQUIDACION/.test(n)) return "interes";
  if (/ABONO|REGULARIZACION|BONIFICACION/.test(n)) return "abono";
  if (/COMISION/.test(n)) return "comision";
  return "otro";
}

/**
 * ¿El tercero de una transferencia es el propio titular? Se considera interno
 * si comparte al menos 3 tokens (nombre/apellidos) con el nombre del titular.
 */
export function matchesOwner(counterpartyNorm: string, ownerNorm: string): boolean {
  const ownerTokens = ownerNorm.split(" ").filter((t) => t.length >= 3);
  if (ownerTokens.length === 0) return false;
  const hits = ownerTokens.filter((t) => counterpartyNorm.includes(t)).length;
  return hits >= Math.min(3, ownerTokens.length);
}

export function categorize(
  tx: ParsedTransaction,
  rules: CompiledRule[],
  ownerName: string,
): CategorizedFields {
  const n = normalize(tx.concepto);
  const ownerNorm = normalize(ownerName || "");
  const merchant = extractMerchant(tx.concepto);
  const cardLast4 = extractCardLast4(tx.concepto);

  // Detección de traspaso interno (transferencia hacia/desde el propio titular).
  let isInternal = false;
  if (/TRANSFERENCIA/.test(n) && ownerNorm) {
    const counterparty = merchant ? normalize(merchant) : n;
    isInternal = matchesOwner(counterparty, ownerNorm);
  }
  if (isInternal) {
    return { category: INTERNAL_CATEGORY, subtype: "transferencia", merchant, cardLast4, isInternal };
  }

  // Primera regla que casa (por prioridad).
  for (const rule of rules) {
    if (rule.re.test(n)) {
      return {
        category: rule.category,
        subtype: rule.subtype ?? inferSubtype(n),
        merchant,
        cardLast4,
        isInternal: false,
      };
    }
  }

  // Sin regla: categoría por defecto según el signo del importe.
  return {
    category: tx.importe < 0 ? FALLBACK_EXPENSE : FALLBACK_INCOME,
    subtype: inferSubtype(n),
    merchant,
    cardLast4,
    isInternal: false,
  };
}
