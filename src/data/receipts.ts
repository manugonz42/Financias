import { query, exec } from "../db/database";
import type { ReceiptItem } from "../types";

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
  await exec("DELETE FROM receipt_items WHERE transaction_id = ?", [txId]);
  for (const it of items) {
    if (!it.description.trim()) continue;
    await exec(
      "INSERT INTO receipt_items (transaction_id, description, amount, category_id) VALUES (?, ?, ?, ?)",
      [txId, it.description.trim(), Math.abs(it.amount), it.category_id ?? null],
    );
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
