import { query, exec, getDB } from "../db/database";
import { normalize } from "../lib/text";
import type { ReceiptItem } from "../types";

/** Recuerda la categoría asignada a un producto para la próxima vez. */
export async function learnItemCategory(description: string, categoryId: number): Promise<void> {
  const pattern = normalize(description);
  if (!pattern) return;
  await exec(
    "INSERT INTO item_rules (pattern, category_id) VALUES (?, ?) ON CONFLICT(pattern) DO UPDATE SET category_id = excluded.category_id",
    [pattern, categoryId],
  );
}

/** Categoría aprendida para un producto (o null si no se conoce). */
export async function suggestItemCategory(description: string): Promise<number | null> {
  const pattern = normalize(description);
  if (!pattern) return null;
  const row = (await query<{ category_id: number }>(
    "SELECT category_id FROM item_rules WHERE pattern = ?",
    [pattern],
  ))[0];
  return row?.category_id ?? null;
}

export async function setReceiptPath(txId: number, path: string | null): Promise<void> {
  await exec("UPDATE transactions SET receipt_path = ? WHERE id = ?", [path, txId]);
}

export async function listReceiptItems(txId: number): Promise<ReceiptItem[]> {
  return query<ReceiptItem>(
    "SELECT * FROM receipt_items WHERE transaction_id = ? ORDER BY id",
    [txId],
  );
}

/** Reemplaza las líneas de desglose de un recibo. */
export async function setReceiptItems(
  txId: number,
  items: { description: string; amount: number; category_id?: number | null }[],
): Promise<void> {
  const db = await getDB();
  await db.execute("BEGIN");
  try {
    await db.execute("DELETE FROM receipt_items WHERE transaction_id = ?", [txId]);
    for (const it of items) {
      if (!it.description.trim()) continue;
      await db.execute(
        "INSERT INTO receipt_items (transaction_id, description, amount, category_id) VALUES (?, ?, ?, ?)",
        [txId, it.description.trim(), Math.abs(it.amount), it.category_id ?? null],
      );
      // Aprende la categoría del producto para autoasignarla la próxima vez.
      if (it.category_id != null) await learnItemCategory(it.description, it.category_id);
    }
    await db.execute("COMMIT");
  } catch (e) {
    await db.execute("ROLLBACK");
    throw e;
  }
}

export interface ItemAggregate {
  description: string;
  total: number;
  n: number;
}

/**
 * Productos agregados por descripción (normalizada a mayúsculas) en todos los
 * recibos: en qué se gasta y cuánto. Para análisis y detectar dónde ahorrar.
 */
export async function topReceiptItems(limit = 20): Promise<ItemAggregate[]> {
  return query<ItemAggregate>(
    `SELECT UPPER(TRIM(description)) AS description, SUM(amount) AS total, COUNT(*) AS n
       FROM receipt_items
      GROUP BY UPPER(TRIM(description))
      ORDER BY total DESC
      LIMIT ?`,
    [limit],
  );
}
