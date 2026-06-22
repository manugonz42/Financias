import { query } from "../db/database";
import { buildWhere } from "./filters";
import type { Transaction, TxFilters } from "../types";

const SELECT = `
  SELECT t.id, t.account_id, a.name AS account_name, a.type AS account_type,
         t.fecha_operacion, t.fecha_valor, t.concepto, t.importe, t.saldo,
         t.category_id, c.name AS category_name, c.color AS category_color,
         c.kind AS category_kind, t.subtype, t.merchant, t.card_last4,
         t.is_internal, t.source_file
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  LEFT JOIN categories c ON c.id = t.category_id`;

export async function listTransactions(
  f: TxFilters,
  limit = 5000,
  offset = 0,
): Promise<Transaction[]> {
  const { clause, params } = buildWhere(f);
  return query<Transaction>(
    `${SELECT} ${clause} ORDER BY t.fecha_operacion DESC, t.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
}

export async function countTransactions(f: TxFilters): Promise<number> {
  const { clause, params } = buildWhere(f);
  const row = (await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM transactions t ${clause}`,
    params,
  ))[0];
  return row?.n ?? 0;
}

/** Suma de gastos (negativos) e ingresos (positivos) respetando los filtros. */
export async function sumFlows(
  f: TxFilters,
): Promise<{ expense: number; income: number }> {
  const { clause, params } = buildWhere(f);
  const row = (await query<{ expense: number; income: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN t.importe < 0 AND t.is_internal = 0 THEN -t.importe END), 0) AS expense,
       COALESCE(SUM(CASE WHEN t.importe > 0 AND t.is_internal = 0 THEN t.importe END), 0) AS income
     FROM transactions t ${clause}`,
    params,
  ))[0];
  return { expense: row?.expense ?? 0, income: row?.income ?? 0 };
}

/** Meses con movimientos, de más reciente a más antiguo ('YYYY-MM'). */
export async function distinctMonths(): Promise<string[]> {
  const rows = await query<{ m: string }>(
    "SELECT DISTINCT substr(fecha_operacion, 1, 7) AS m FROM transactions ORDER BY m DESC",
  );
  return rows.map((r) => r.m);
}

/** Rango de fechas con movimientos (mínima y máxima 'YYYY-MM-DD'). */
export async function dateBounds(): Promise<{ min: string; max: string } | null> {
  const row = (await query<{ min: string | null; max: string | null }>(
    "SELECT MIN(fecha_operacion) AS min, MAX(fecha_operacion) AS max FROM transactions",
  ))[0];
  if (!row?.min || !row?.max) return null;
  return { min: row.min, max: row.max };
}

/** Subtipos presentes (para el filtro por tipo de movimiento). */
export async function distinctSubtypes(): Promise<string[]> {
  const rows = await query<{ s: string }>(
    "SELECT DISTINCT subtype AS s FROM transactions WHERE subtype IS NOT NULL ORDER BY s",
  );
  return rows.map((r) => r.s);
}
