import { query } from "../db/database";
import { buildWhere } from "./filters";
import { listAccounts, currentBalance } from "./accounts";
import { EFFECTIVE_TX } from "./splits";
import type { TxFilters } from "../types";

export interface CategorySlice {
  name: string;
  color: string;
  value: number;
}

/** Gasto por categoría (importes negativos, sin traspasos internos). Considera
 *  los movimientos divididos (cada parte cuenta en su categoría). */
export async function spendByCategory(f: TxFilters): Promise<CategorySlice[]> {
  const { clause, params } = buildWhere({ ...f, flow: "expense" });
  return query<CategorySlice>(
    `SELECT c.name AS name, c.color AS color, SUM(t.amt) AS value
     FROM ${EFFECTIVE_TX} t
     JOIN categories c ON c.id = t.category_id
     ${clause}
     GROUP BY c.id
     ORDER BY value DESC`,
    params,
  );
}

export interface CategoryValue {
  id: number;
  value: number;
}

/**
 * Gasto crudo por `category_id` (sin agrupar por jerarquía). Sirve para que el
 * cliente haga el roll-up por subárbol (donut con drill-down). El filtro `flow`
 * de gasto garantiza que el WHERE no esté vacío.
 */
export async function spendByCategoryId(f: TxFilters): Promise<CategoryValue[]> {
  const { clause, params } = buildWhere({ ...f, flow: "expense" });
  return query<CategoryValue>(
    `SELECT t.category_id AS id, SUM(t.amt) AS value
     FROM ${EFFECTIVE_TX} t
     ${clause ? clause + " AND" : "WHERE"} t.category_id IS NOT NULL
     GROUP BY t.category_id`,
    params,
  );
}

export interface MonthlyFlow {
  month: string;
  expense: number;
  income: number;
}

/** Gastos e ingresos por mes (respeta cuenta y rango de fechas del filtro). */
export async function monthlyFlows(f: TxFilters): Promise<MonthlyFlow[]> {
  const { clause, params } = buildWhere(f);
  return query<MonthlyFlow>(
    `SELECT substr(t.fecha_operacion, 1, 7) AS month,
            COALESCE(SUM(CASE WHEN t.importe < 0 AND t.is_internal = 0 THEN -t.importe END), 0) AS expense,
            COALESCE(SUM(CASE WHEN t.importe > 0 AND t.is_internal = 0 THEN t.importe END), 0) AS income
     FROM transactions t ${clause}
     GROUP BY month ORDER BY month`,
    params,
  );
}

export interface BalancePoint {
  month: string;
  saldo: number;
}

/** Saldo de cierre por mes de una cuenta importada (a partir de movimientos). */
export async function balanceSeries(accountId: number): Promise<BalancePoint[]> {
  return query<BalancePoint>(
    `SELECT month, saldo FROM (
        SELECT substr(fecha_operacion, 1, 7) AS month, saldo,
               ROW_NUMBER() OVER (
                 PARTITION BY substr(fecha_operacion, 1, 7)
                 ORDER BY fecha_operacion DESC, id DESC
               ) AS rn
        FROM transactions
        WHERE account_id = ? AND saldo IS NOT NULL
     ) WHERE rn = 1 ORDER BY month`,
    [accountId],
  );
}

/** Saldo de cierre por mes de una cuenta manual (a partir de snapshots). */
export async function snapshotBalanceSeries(accountId: number): Promise<BalancePoint[]> {
  return query<BalancePoint>(
    `SELECT month, balance AS saldo FROM (
        SELECT substr(date, 1, 7) AS month, balance,
               ROW_NUMBER() OVER (
                 PARTITION BY substr(date, 1, 7)
                 ORDER BY date DESC, id DESC
               ) AS rn
        FROM account_balances
        WHERE account_id = ?
     ) WHERE rn = 1 ORDER BY month`,
    [accountId],
  );
}

/** Serie de saldo de una cuenta, eligiendo la fuente según sea manual o no. */
export async function accountBalanceSeries(accountId: number): Promise<BalancePoint[]> {
  const acc = (await listAccounts()).find((a) => a.id === accountId);
  if (!acc) return [];
  return acc.manual ? snapshotBalanceSeries(accountId) : balanceSeries(accountId);
}

/**
 * Patrimonio neto por mes = activos − pasivos. Para cada cuenta se toma el saldo
 * de cierre mensual (movimientos o snapshots), se arrastra el último conocido
 * (forward-fill) y se resta si la cuenta es un pasivo.
 */
export async function netWorthSeries(): Promise<BalancePoint[]> {
  const accounts = await listAccounts();
  if (accounts.length === 0) return [];

  const perAccount = await Promise.all(
    accounts.map(async (a) => ({
      sign: a.class === "pasivo" ? -1 : 1,
      points: a.manual ? await snapshotBalanceSeries(a.id) : await balanceSeries(a.id),
    })),
  );

  // Rango de meses global.
  const allMonths = new Set<string>();
  for (const a of perAccount) for (const p of a.points) allMonths.add(p.month);
  if (allMonths.size === 0) return [];
  const months = [...allMonths].sort();

  const result: BalancePoint[] = [];
  for (const m of months) {
    let total = 0;
    for (const a of perAccount) {
      // último saldo conocido <= m (forward-fill).
      let last = 0;
      for (const p of a.points) {
        if (p.month <= m) last = p.saldo;
        else break;
      }
      total += a.sign * last;
    }
    result.push({ month: m, saldo: +total.toFixed(2) });
  }
  return result;
}

export interface NetWorthNow {
  assets: number;
  liabilities: number;
  net: number;
}

/** Patrimonio neto actual: activos, pasivos (magnitud) y neto = activos − pasivos. */
export async function netWorthNow(): Promise<NetWorthNow> {
  const accounts = await listAccounts();
  let assets = 0;
  let liabilities = 0;
  for (const a of accounts) {
    const bal = await currentBalance(a.id);
    if (a.class === "pasivo") liabilities += bal;
    else assets += bal;
  }
  return { assets, liabilities, net: +(assets - liabilities).toFixed(2) };
}

export interface CashPoint {
  month: string;
  total: number;
  count: number;
}

/** Disposiciones de efectivo en cajero por mes. */
export async function cashByMonth(f: TxFilters): Promise<CashPoint[]> {
  const { clause, params } = buildWhere({ ...f, subtype: "cajero" });
  return query<CashPoint>(
    `SELECT substr(t.fecha_operacion, 1, 7) AS month,
            SUM(ABS(t.importe)) AS total, COUNT(*) AS count
     FROM transactions t ${clause}
     GROUP BY month ORDER BY month`,
    params,
  );
}

export interface DailySpend {
  day: string; // 'YYYY-MM-DD'
  value: number;
}

/** Gasto por día (negativos, sin traspasos) para el heatmap calendario. */
export async function dailySpend(f: TxFilters): Promise<DailySpend[]> {
  const { clause, params } = buildWhere(f);
  return query<DailySpend>(
    `SELECT substr(t.fecha_operacion, 1, 10) AS day,
            COALESCE(SUM(CASE WHEN t.importe < 0 AND t.is_internal = 0 THEN -t.importe END), 0) AS value
     FROM transactions t ${clause}
     GROUP BY day HAVING value > 0 ORDER BY day`,
    params,
  );
}

export interface Subscription {
  merchant: string;
  category: string | null;
  months: number;
  n: number;
  avg_amount: number;
  last_seen: string;
}

/** Comercios recurrentes (aparecen en >= 3 meses distintos) = suscripciones. */
export async function detectSubscriptions(): Promise<Subscription[]> {
  return query<Subscription>(
    `SELECT t.merchant AS merchant, c.name AS category,
            COUNT(DISTINCT substr(t.fecha_operacion, 1, 7)) AS months,
            COUNT(*) AS n, AVG(ABS(t.importe)) AS avg_amount,
            MAX(t.fecha_operacion) AS last_seen
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.importe < 0 AND t.is_internal = 0 AND t.merchant IS NOT NULL AND t.merchant <> ''
     GROUP BY UPPER(t.merchant)
     HAVING months >= 3
     ORDER BY months DESC, avg_amount DESC`,
  );
}

export interface KpiSummary {
  expense: number;
  income: number;
  net: number;
  savingsRate: number; // % del ingreso que se ahorra
}

export async function kpis(f: TxFilters): Promise<KpiSummary> {
  const { clause, params } = buildWhere(f);
  const row = (await query<{ expense: number; income: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN t.importe < 0 AND t.is_internal = 0 THEN -t.importe END), 0) AS expense,
       COALESCE(SUM(CASE WHEN t.importe > 0 AND t.is_internal = 0 THEN t.importe END), 0) AS income
     FROM transactions t ${clause}`,
    params,
  ))[0];
  const expense = row?.expense ?? 0;
  const income = row?.income ?? 0;
  const net = income - expense;
  const savingsRate = income > 0 ? (net / income) * 100 : 0;
  return { expense, income, net, savingsRate };
}

/* ---- Debug: desglose de ingresos por categoría y mes ---- */

export interface IncomeDebugRow {
  month: string;
  category: string;
  kind: string | null;
  cnt: number;
  total: number;
}

export async function debugIncomeBreakdown(from?: string, to?: string): Promise<IncomeDebugRow[]> {
  const conditions = ["t.importe > 0", "t.is_internal = 0"];
  const params: unknown[] = [];
  if (from) { conditions.push("t.fecha_operacion >= ?"); params.push(from); }
  if (to) { conditions.push("t.fecha_operacion <= ?"); params.push(to); }
  return query<IncomeDebugRow>(
    `SELECT substr(t.fecha_operacion, 1, 7) AS month,
            COALESCE(c.name, '(sin categoría)') AS category,
            c.kind,
            COUNT(*) AS cnt,
            ROUND(SUM(t.importe), 2) AS total
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE ${conditions.join(" AND ")}
     GROUP BY month, c.name
     ORDER BY month, total DESC`,
    params,
  );
}
