import { query, exec } from "../db/database";
import type { Account } from "../types";

export async function listAccounts(): Promise<Account[]> {
  return query<Account>("SELECT * FROM accounts ORDER BY type DESC, id");
}

/**
 * Inserta la cuenta si no existe (por número) y devuelve su id. Si ya existe,
 * actualiza el titular/últimos4 por si faltaban.
 */
export async function upsertAccount(a: {
  name: string;
  type: string;
  number: string;
  last4: string;
  holder: string;
}): Promise<number> {
  const existing = (await query<{ id: number }>(
    "SELECT id FROM accounts WHERE number = ?",
    [a.number],
  ))[0];
  if (existing) {
    await exec("UPDATE accounts SET holder = ?, last4 = ?, name = ? WHERE id = ?", [
      a.holder,
      a.last4,
      a.name,
      existing.id,
    ]);
    return existing.id;
  }
  // Usar el lastInsertId del propio INSERT: con el pool de conexiones de
  // tauri-plugin-sql, un `SELECT last_insert_rowid()` aparte puede caer en otra
  // conexión y devolver 0 (lo que rompería el FK de transactions.account_id).
  const res = await exec(
    "INSERT INTO accounts (name, type, number, last4, holder) VALUES (?, ?, ?, ?, ?)",
    [a.name, a.type, a.number, a.last4, a.holder],
  );
  return Number(res.lastInsertId);
}

/** Saldo actual de una cuenta = saldo del movimiento más reciente. */
export async function currentBalance(accountId: number): Promise<number> {
  const row = (await query<{ saldo: number }>(
    `SELECT saldo FROM transactions
     WHERE account_id = ? AND saldo IS NOT NULL
     ORDER BY fecha_operacion DESC, id DESC LIMIT 1`,
    [accountId],
  ))[0];
  return row?.saldo ?? 0;
}
