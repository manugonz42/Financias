import { query, exec } from "../db/database";
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
 */
export const EFFECTIVE_TX = `(
  SELECT account_id, fecha_operacion, fecha_valor, concepto, merchant, subtype,
         importe, is_internal, category_id, ABS(importe) AS amt
    FROM transactions
   WHERE id NOT IN (SELECT transaction_id FROM transaction_splits)
  UNION ALL
  SELECT t.account_id, t.fecha_operacion, t.fecha_valor, t.concepto, t.merchant, t.subtype,
         t.importe, t.is_internal, s.category_id, s.amount AS amt
    FROM transactions t
    JOIN transaction_splits s ON s.transaction_id = t.id
)`;

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
  await exec("DELETE FROM transaction_splits WHERE transaction_id = ?", [txId]);
  for (const p of parts) {
    await exec(
      "INSERT INTO transaction_splits (transaction_id, category_id, amount, note) VALUES (?, ?, ?, ?)",
      [txId, p.category_id, Math.abs(p.amount), p.note ?? null],
    );
  }
}

/** Quita la división: el movimiento vuelve a usar su categoría propia. */
export async function clearSplits(txId: number): Promise<void> {
  await exec("DELETE FROM transaction_splits WHERE transaction_id = ?", [txId]);
}
