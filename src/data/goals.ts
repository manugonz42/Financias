import { query, exec } from "../db/database";
import type { Goal } from "../types";

export async function listGoals(): Promise<Goal[]> {
  return query<Goal>("SELECT * FROM goals ORDER BY created_at, id");
}

export async function createGoal(g: {
  name: string;
  target_amount: number;
  current_amount?: number;
  target_date?: string | null;
  color?: string;
  icon?: string;
}): Promise<void> {
  await exec(
    "INSERT INTO goals (name, target_amount, current_amount, target_date, color, icon) VALUES (?, ?, ?, ?, ?, ?)",
    [
      g.name.trim(),
      g.target_amount,
      g.current_amount ?? 0,
      g.target_date || null,
      g.color ?? "#6366f1",
      g.icon ?? "🎯",
    ],
  );
}

export async function updateGoal(
  id: number,
  g: {
    name: string;
    target_amount: number;
    current_amount: number;
    target_date?: string | null;
    color?: string;
    icon?: string;
  },
): Promise<void> {
  await exec(
    "UPDATE goals SET name = ?, target_amount = ?, current_amount = ?, target_date = ?, color = ?, icon = ? WHERE id = ?",
    [g.name.trim(), g.target_amount, g.current_amount, g.target_date || null, g.color ?? "#6366f1", g.icon ?? "🎯", id],
  );
}

/** Suma (o resta, si es negativo) una aportación al ahorro actual de la meta. */
export async function addContribution(id: number, amount: number): Promise<void> {
  await exec(
    "UPDATE goals SET current_amount = MAX(0, current_amount + ?) WHERE id = ?",
    [amount, id],
  );
}

export async function deleteGoal(id: number): Promise<void> {
  await exec("DELETE FROM goals WHERE id = ?", [id]);
}
