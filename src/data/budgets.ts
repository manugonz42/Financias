import { query, exec } from "../db/database";
import { EFFECTIVE_TX } from "./splits";
import { getBudgetRollover } from "./settings";

export interface BudgetRow {
  category_id: number;
  category_name: string;
  color: string;
  icon: string;
  amount: number;
  /** Gasto real del mes consultado (valor absoluto). */
  spent: number;
  /** Acumulado de meses anteriores (rollover); 0 si está desactivado. */
  carryover: number;
  /** Disponible este mes = límite + acumulado. */
  available: number;
}

export async function setBudget(categoryId: number, amount: number): Promise<void> {
  await exec(
    "INSERT INTO budgets (category_id, amount) VALUES (?, ?) ON CONFLICT(category_id) DO UPDATE SET amount = excluded.amount",
    [categoryId, amount],
  );
}

export async function deleteBudget(categoryId: number): Promise<void> {
  await exec("DELETE FROM budgets WHERE category_id = ?", [categoryId]);
}

function monthIndex(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return y * 12 + (m - 1);
}

/** Gasto (magnitud) por categoría según un filtro de mes, considerando splits. */
async function spentByCat(monthClause: string, params: unknown[]): Promise<Map<number, number>> {
  const rows = await query<{ id: number; v: number }>(
    `SELECT t.category_id AS id, SUM(t.amt) AS v
       FROM ${EFFECTIVE_TX} t
      WHERE t.is_internal = 0 AND t.importe < 0 AND t.category_id IS NOT NULL AND ${monthClause}
      GROUP BY t.category_id`,
    params,
  );
  return new Map(rows.map((r) => [r.id, r.v]));
}

/**
 * Acumulado (rollover) por categoría presupuestada para el mes dado:
 * límite·(meses desde el primer movimiento hasta el mes anterior) − gastado en ese rango.
 * Puede ser negativo (sobregasto que se arrastra). Vacío si no hay rango previo.
 */
async function carryoverByCat(month: string, amounts: Map<number, number>): Promise<Map<number, number>> {
  const fm = (await query<{ m: string | null }>(
    "SELECT MIN(substr(fecha_operacion, 1, 7)) AS m FROM transactions",
  ))[0]?.m;
  const out = new Map<number, number>();
  if (!fm || monthIndex(fm) >= monthIndex(month)) return out;
  const n = monthIndex(month) - monthIndex(fm);
  const prior = await spentByCat(
    "substr(t.fecha_operacion, 1, 7) >= ? AND substr(t.fecha_operacion, 1, 7) < ?",
    [fm, month],
  );
  for (const [catId, amount] of amounts) {
    out.set(catId, +(amount * n - (prior.get(catId) ?? 0)).toFixed(2));
  }
  return out;
}

/** Presupuestos con el gasto real del mes indicado ('YYYY-MM') y, si el rollover
 *  está activado, el acumulado y el disponible. */
export async function listBudgets(month: string): Promise<BudgetRow[]> {
  const rollover = await getBudgetRollover();
  const budgets = await query<{ category_id: number; category_name: string; color: string; icon: string; amount: number }>(
    `SELECT b.category_id, c.name AS category_name, c.color, c.icon, b.amount
       FROM budgets b JOIN categories c ON c.id = b.category_id
      ORDER BY c.name`,
  );
  const spentNow = await spentByCat("substr(t.fecha_operacion, 1, 7) = ?", [month]);
  const amounts = new Map(budgets.map((b) => [b.category_id, b.amount]));
  const carry = rollover ? await carryoverByCat(month, amounts) : new Map<number, number>();

  return budgets.map((b) => {
    const spent = spentNow.get(b.category_id) ?? 0;
    const carryover = carry.get(b.category_id) ?? 0;
    return { ...b, spent, carryover, available: +(b.amount + carryover).toFixed(2) };
  });
}

/** Acumulado por categoría (para la vista de Presupuestos). Vacío si rollover off. */
export async function budgetCarryovers(month: string): Promise<Map<number, number>> {
  if (!(await getBudgetRollover())) return new Map();
  const rows = await query<{ category_id: number; amount: number }>(
    "SELECT category_id, amount FROM budgets",
  );
  return carryoverByCat(month, new Map(rows.map((r) => [r.category_id, r.amount])));
}
