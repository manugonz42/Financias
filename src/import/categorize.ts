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

/** Compila y ordena las reglas por prioridad (menor primero).
 *  Las reglas con expresión regular inválida se descartan (no rompen el import). */
export function compileRules(rules: RuleSeed[] = RULES): CompiledRule[] {
  const out: CompiledRule[] = [];
  for (const r of [...rules].sort((a, b) => a.priority - b.priority)) {
    try {
      out.push({ re: new RegExp(r.pattern), category: r.category, subtype: r.subtype });
    } catch {
      // patrón inválido (p. ej. regla escrita a mano): se ignora.
    }
  }
  return out;
}

/** Extrae el comercio del concepto en bruto, según el tipo de movimiento. */
export function extractMerchant(concepto: string): string | null {
  // Compras con tarjeta: "COMPRA EN <X>, CON LA TARJETA" (con o sin "Google/Apple pay:")
  let m = /COMPRA EN\s+(.+?)\s*,?\s*CON LA TARJETA/i.exec(concepto);
  if (m) return clean(m[1]);
  // Recibos domiciliados: "RECIBO <X> Nº RECIBO" / "RECIBO <X> N° RECIBO"
  m = /RECIBO\s+(.+?)\s+N[º°]\s*RECIBO/i.exec(concepto);
  if (m) return clean(m[1]);
  // Bizum (contraparte): "BIZUM ENVIADO/RECIBIDO/A FAVOR DE/DE <X>" o
  // "BIZUM TO/FROM <X>". Se prueba antes que las transferencias para que el
  // patrón de transferencia no se trague el "DE/A FAVOR DE" del Bizum.
  // Orden de alternativas: las largas (con preposición incluida) ANTES que las
  // cortas para que "ENVIADO A" gane sobre "ENVIADO" suelto.
  m = /\bBIZUM(?:\s+(?:A\s+FAVOR\s+DE|ENVIADO\s+A|RECIBIDO\s+DE|ENVIADO|RECIBIDO|PAGO|DE|TO|FROM))?\s+(.+?)(?:\s+CONCEPTO|\s*$)/i.exec(concepto);
  if (m) return clean(m[1]);
  // Pago por móvil (Openbank): "PAGO MOVIL <X> ..."
  m = /^PAGO MOVIL(?:\s+EN)?\s+(.+?)(?:\s+\d|\s*$)/i.exec(concepto);
  if (m) return clean(m[1]);
  // Transferencias a favor de un tercero
  m = /A FAVOR DE\s+(.+?)(?:\s+CONCEPTO|\s*$)/i.exec(concepto);
  if (m) return clean(m[1]);
  // Transferencias recibidas
  m = /TRANSFERENCIA(?:\s+INMEDIATA)?\s+DE\s+(.+?)(?:,?\s*CONCEPTO|\s*$)/i.exec(concepto);
  if (m) return clean(m[1]);
  // Recibos sin el sufijo "Nº RECIBO" (formato resumido).
  m = /^RECIBO\s+(.{2,60}?)(?:\s+IMPORTE|\s+REF|\s+REC\b|\s*$)/i.exec(concepto);
  if (m) return clean(m[1]);
  // Heurística para BBVA con concepto ya limpio (sin etiqueta de subtipo): si
  // queda una cadena corta (≤ 6 palabras, sin secuencias largas de dígitos),
  // la tomamos como nombre del comercio. Permite agrupar bien en Categorizar.
  const trimmed = concepto.trim();
  if (
    trimmed.length > 0 &&
    trimmed.length <= 60 &&
    trimmed.split(/\s+/).length <= 6 &&
    !/\d{6,}/.test(trimmed)
  ) {
    return clean(trimmed);
  }
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

/** Infiere el subtipo a partir del concepto normalizado y de la etiqueta de
 *  subtipo opcional que algunos bancos imprimen (BBVA: "Card payment"…). */
function inferSubtype(n: string, label?: string): Subtype {
  if (label) {
    const l = label.toLowerCase();
    if (l.includes("deposit from salary")) return "nomina";
    if (l.includes("fees") && l.includes("interest")) return "comision";
    if (l.includes("loan instalment")) return "recibo";
    if (l.includes("devuelto")) return "abono";
    if (l.includes("card payment") || l.includes("subscription")) return "compra";
    if (l.includes("direct debit")) return "recibo";
    if (l.includes("atm") || l.includes("cash withdrawal")) return "cajero";
    if (l.includes("cash deposit")) return "transferencia";
    if (l.includes("monthly card debit") || l.includes("transfer from card")) return "transferencia";
    if (l.includes("transfer") || l.includes("bizum")) return "transferencia";
    if (l.includes("interest")) return "interes";
    if (l.includes("fee")) return "comision";
  }
  if (/DISPOSICION EN CAJERO|ATM WITHDRAWAL|CASH WITHDRAWAL|RETIRADA (?:DE )?EFECTIVO/.test(n)) return "cajero";
  if (/COMPRA EN|COMPRA REALIZ|CARD PAYMENT/.test(n)) return "compra";
  if (/RECIBO|DIRECT DEBIT|LOAN INSTALMENT/.test(n)) return "recibo";
  if (/TRANSFERENCIA|TRANSFER|BIZUM|FUNDED CARD OPERATION|MONTHLY CARD DEBIT/.test(n)) return "transferencia";
  if (/LIQUIDACION|INTEREST/.test(n)) return "interes";
  if (/ABONO|REGULARIZACION|BONIFICACION|DEVUELTO/.test(n)) return "abono";
  if (/COMISION|\bFEE\b|FEES,EXPENSES/.test(n)) return "comision";
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
  // Concatenamos la etiqueta de subtipo del banco (BBVA: "Card payment"…) al
  // texto normalizado para que las reglas la vean a la hora de casar (p.ej.
  // "Bizum payment" → categoría Bizum sin depender del concepto).
  const label = tx.bankSubtypeLabel ?? "";
  const n = normalize(`${tx.concepto} ${label}`).trim();
  const ownerNorm = normalize(ownerName || "");
  const merchant = extractMerchant(tx.concepto);
  const cardLast4 = extractCardLast4(tx.concepto);

  // Detección de traspaso interno: el tercero de la operación es el propio
  // titular (transferencias/Bizum/ingresos entre tus cuentas, incluso en bancos
  // que solo muestran el nombre sin la palabra "TRANSFERENCIA").
  let isInternal = false;
  if (ownerNorm) {
    const counterparty = merchant ? normalize(merchant) : n;
    isInternal = matchesOwner(counterparty, ownerNorm);
  }
  if (isInternal) {
    return { category: INTERNAL_CATEGORY, subtype: "transferencia", merchant, cardLast4, isInternal };
  }

  // Primera regla que casa (por prioridad). Si la regla asigna la categoría
  // interna (p. ej. ingresos de efectivo propios), se excluye del análisis.
  for (const rule of rules) {
    if (rule.re.test(n)) {
      return {
        category: rule.category,
        subtype: rule.subtype ?? inferSubtype(n, label),
        merchant,
        cardLast4,
        isInternal: rule.category === INTERNAL_CATEGORY,
      };
    }
  }

  // Sin regla: categoría por defecto según el signo del importe.
  return {
    category: tx.importe < 0 ? FALLBACK_EXPENSE : FALLBACK_INCOME,
    subtype: inferSubtype(n, label),
    merchant,
    cardLast4,
    isInternal: false,
  };
}
