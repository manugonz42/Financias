import { query, exec } from "../db/database";
import { advanceDate } from "../lib/schedule";
import { detectSubscriptions } from "./stats";
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

/** Resultado de la auto-detección de pagos recurrentes. */
export interface AutoDetectResult {
  created: number;
  skipped: number;
  names: string[];
}

/**
 * Auto-genera pagos programados desde suscripciones detectadas.
 * Solo crea pagos para comercios que no tengan ya un pago programado activo con el mismo nombre.
 */
export async function autoGenerateFromSubscriptions(): Promise<AutoDetectResult> {
  const subs = await detectSubscriptions();
  const existing = await listScheduled();
  const existingNames = new Set(existing.map((s) => s.name.toLowerCase().trim()));

  let created = 0;
  let skipped = 0;
  const names: string[] = [];

  for (const sub of subs) {
    const name = sub.merchant?.trim();
    if (!name || existingNames.has(name.toLowerCase())) {
      skipped++;
      continue;
    }

    // Determinar próxima fecha: primer día del próximo mes
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const p = (n: number) => String(n).padStart(2, "0");
    const nextDate = `${nextMonth.getFullYear()}-${p(nextMonth.getMonth() + 1)}-${p(nextMonth.getDate())}`;

    await createScheduled({
      name,
      amount: Math.round(sub.avg_amount * 100) / 100,
      category_id: null,
      frequency: "mensual",
      next_date: nextDate,
    });

    created++;
    names.push(name);
    existingNames.add(name.toLowerCase());
  }

  return { created, skipped, names };
}
