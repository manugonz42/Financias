import { query, exec } from "../db/database";

export interface BudgetRow {
  category_id: number;
  category_name: string;
  color: string;
  icon: string;
  amount: number;
  /** Gasto real del mes consultado (valor absoluto). */
  spent: number;
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

/** Presupuestos con el gasto real del mes indicado ('YYYY-MM'). */
export async function listBudgets(month: string): Promise<BudgetRow[]> {
  return query<BudgetRow>(
    `SELECT b.category_id, c.name AS category_name, c.color, c.icon, b.amount,
            COALESCE((
              SELECT SUM(ABS(t.importe)) FROM transactions t
              WHERE t.category_id = b.category_id
                AND t.is_internal = 0 AND t.importe < 0
                AND substr(t.fecha_operacion, 1, 7) = ?
            ), 0) AS spent
     FROM budgets b
     JOIN categories c ON c.id = b.category_id
     ORDER BY c.name`,
    [month],
  );
}
