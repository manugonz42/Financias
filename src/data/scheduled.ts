import { query, exec } from "../db/database";
import { advanceDate } from "../lib/schedule";
import type { Frequency, ScheduledPayment } from "../types";

export interface ScheduledRow extends ScheduledPayment {
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
}

/** Pagos programados activos, ordenados por próxima fecha. */
export async function listScheduled(): Promise<ScheduledRow[]> {
  return query<ScheduledRow>(
    `SELECT sp.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
       FROM scheduled_payments sp
       LEFT JOIN categories c ON c.id = sp.category_id
      WHERE sp.active = 1
      ORDER BY sp.next_date`,
  );
}

export async function createScheduled(s: {
  name: string;
  amount: number;
  category_id: number | null;
  frequency: Frequency;
  next_date: string;
}): Promise<void> {
  await exec(
    "INSERT INTO scheduled_payments (name, amount, category_id, frequency, next_date) VALUES (?, ?, ?, ?, ?)",
    [s.name.trim(), Math.abs(s.amount), s.category_id, s.frequency, s.next_date],
  );
}

export async function updateScheduled(
  id: number,
  s: { name: string; amount: number; category_id: number | null; frequency: Frequency; next_date: string },
): Promise<void> {
  await exec(
    "UPDATE scheduled_payments SET name = ?, amount = ?, category_id = ?, frequency = ?, next_date = ? WHERE id = ?",
    [s.name.trim(), Math.abs(s.amount), s.category_id, s.frequency, s.next_date, id],
  );
}

/** Marca como pagado: avanza la próxima fecha según la frecuencia. */
export async function markPaid(id: number): Promise<void> {
  const row = (await query<{ next_date: string; frequency: Frequency }>(
    "SELECT next_date, frequency FROM scheduled_payments WHERE id = ?",
    [id],
  ))[0];
  if (!row) return;
  await exec("UPDATE scheduled_payments SET next_date = ? WHERE id = ?", [
    advanceDate(row.next_date, row.frequency),
    id,
  ]);
}

export async function deleteScheduled(id: number): Promise<void> {
  await exec("DELETE FROM scheduled_payments WHERE id = ?", [id]);
}
