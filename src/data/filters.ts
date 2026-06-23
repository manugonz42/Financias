// Construcción del WHERE SQL a partir de los filtros de la UI.
// La tabla `transactions` se referencia con alias `t`.

import type { TxFilters } from "../types";

export function buildWhere(f: TxFilters): { clause: string; params: unknown[] } {
  const c: string[] = [];
  const p: unknown[] = [];

  if (f.accountId && f.accountId !== "all") {
    c.push("t.account_id = ?");
    p.push(f.accountId);
  }
  if (f.month) {
    c.push("substr(t.fecha_operacion, 1, 7) = ?");
    p.push(f.month);
  } else {
    if (f.from) {
      c.push("t.fecha_operacion >= ?");
      p.push(f.from);
    }
    if (f.to) {
      c.push("t.fecha_operacion <= ?");
      p.push(f.to);
    }
  }
  if (f.categoryId) {
    c.push("t.category_id = ?");
    p.push(f.categoryId);
  }
  if (f.subtype) {
    c.push("t.subtype = ?");
    p.push(f.subtype);
  }
  if (f.search && f.search.trim()) {
    c.push("(UPPER(t.concepto) LIKE ? OR UPPER(COALESCE(t.merchant, '')) LIKE ?)");
    const s = `%${f.search.trim().toUpperCase()}%`;
    p.push(s, s);
  }
  if (f.minAmount != null) {
    c.push("ABS(t.importe) >= ?");
    p.push(f.minAmount);
  }
  if (f.maxAmount != null) {
    c.push("ABS(t.importe) <= ?");
    p.push(f.maxAmount);
  }
  if (f.excludeInternal) {
    c.push("t.is_internal = 0");
  }
  if (f.flow === "expense") {
    c.push("t.importe < 0 AND t.is_internal = 0");
  } else if (f.flow === "income") {
    c.push("t.importe > 0 AND t.is_internal = 0");
  }
  if (f.reconciled != null) {
    c.push("t.reconciled = ?");
    p.push(f.reconciled ? 1 : 0);
  }

  return { clause: c.length ? "WHERE " + c.join(" AND ") : "", params: p };
}
