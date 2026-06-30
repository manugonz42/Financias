import { query, exec, getDB } from "../db/database";
import type { TransactionSplit } from "../types";

/**
 * Filas "efectivas" para agregaciones POR CATEGORÍA: cada movimiento sin dividir
 * aporta una fila con su categoría e importe; cada movimiento dividido aporta una
 * fila por parte (con la categoría y el importe de la parte). Sustituye a
 * `transactions t` en las consultas de gasto por categoría y presupuestos.
 *
 * Columna `amt` = magnitud a sumar (ABS del importe, o el importe de la parte).
 * El resto de columnas se arrastran del movimiento padre para que los filtros
 * (cuenta, fecha, interno, signo, concepto) sigan funcionando con alias `t`.
 *
 * Nota: ahora es una VIEW en SQLite (`effective_tx`), pero se mantiene esta
 * referencia como string para compatibilidad con las queries que usan `FROM ${EFFECTIVE_TX} t`.
 */
export const EFFECTIVE_TX = "effective_tx";

export async function listSplits(txId: number): Promise<TransactionSplit[]> {
  return query<TransactionSplit>(
    "SELECT * FROM transaction_splits WHERE transaction_id = ? ORDER BY id",
    [txId],
  );
}

/** Reemplaza todas las partes de un movimiento por las indicadas. */
export async function setSplits(
  txId: number,
  parts: { category_id: number; amount: number; note?: string | null }[],
): Promise<void> {
  const db = await getDB();
  await db.execute("BEGIN");
  try {
    await db.execute("DELETE FROM transaction_splits WHERE transaction_id = ?", [txId]);
    for (const p of parts) {
      await db.execute(
        "INSERT INTO transaction_splits (transaction_id, category_id, amount, note) VALUES (?, ?, ?, ?)",
        [txId, p.category_id, Math.abs(p.amount), p.note ?? null],
      );
    }
    await db.execute("COMMIT");
  } catch (e) {
    await db.execute("ROLLBACK");
    throw e;
  }
}

/** Quita la división: el movimiento vuelve a usar su categoría propia. */
export async function clearSplits(txId: number): Promise<void> {
  await exec("DELETE FROM transaction_splits WHERE transaction_id = ?", [txId]);
}
