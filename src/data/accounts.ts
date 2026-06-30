import { query, exec } from "../db/database";
import type { Account, AccountBalance, AccountClass, AccountType } from "../types";

/** Metadatos de los tipos de cuenta manual: etiqueta y clase (activo/pasivo). */
export const MANUAL_ACCOUNT_TYPES: { type: AccountType; label: string; class: AccountClass }[] = [
  { type: "efectivo", label: "Efectivo", class: "activo" },
  { type: "inversion", label: "Inversión / Broker", class: "activo" },
  { type: "inmueble", label: "Inmueble", class: "activo" },
  { type: "otro_activo", label: "Otro activo", class: "activo" },
  { type: "tarjeta_credito", label: "Tarjeta de crédito", class: "pasivo" },
  { type: "prestamo", label: "Préstamo", class: "pasivo" },
  { type: "hipoteca", label: "Hipoteca", class: "pasivo" },
  { type: "otro_pasivo", label: "Otro pasivo", class: "pasivo" },
];

const TYPE_LABELS: Record<string, string> = {
  checking: "Cuenta corriente",
  savings: "Cuenta de ahorro",
  ...Object.fromEntries(MANUAL_ACCOUNT_TYPES.map((t) => [t.type, t.label])),
};

export function accountTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export function classOfType(type: AccountType): AccountClass {
  return MANUAL_ACCOUNT_TYPES.find((t) => t.type === type)?.class ?? "activo";
}

export async function listAccounts(): Promise<Account[]> {
  return query<Account>("SELECT * FROM accounts ORDER BY class, manual, type DESC, id");
}

// --- Cuentas manuales ---------------------------------------------------------

export async function createManualAccount(a: {
  name: string;
  type: AccountType;
}): Promise<number> {
  const res = await exec(
    "INSERT INTO accounts (name, type, manual, class) VALUES (?, ?, 1, ?)",
    [a.name.trim(), a.type, classOfType(a.type)],
  );
  return Number(res.lastInsertId);
}

export async function updateManualAccount(
  id: number,
  a: { name: string; type: AccountType },
): Promise<void> {
  await exec(
    "UPDATE accounts SET name = ?, type = ?, class = ? WHERE id = ? AND manual = 1",
    [a.name.trim(), a.type, classOfType(a.type), id],
  );
}

/** Borra una cuenta manual, sus saldos y datos asociados. No afecta a las cuentas importadas. */
export async function deleteManualAccount(id: number): Promise<void> {
  await exec("DELETE FROM transaction_splits WHERE transaction_id IN (SELECT id FROM transactions WHERE account_id = ?)", [id]);
  await exec("DELETE FROM receipt_items WHERE transaction_id IN (SELECT id FROM transactions WHERE account_id = ?)", [id]);
  await exec("DELETE FROM transactions WHERE account_id = ?", [id]);
  await exec("DELETE FROM account_balances WHERE account_id = ?", [id]);
  await exec("DELETE FROM accounts WHERE id = ? AND manual = 1", [id]);
}

// --- Saldos manuales (snapshots) ----------------------------------------------

export async function listBalanceSnapshots(accountId: number): Promise<AccountBalance[]> {
  return query<AccountBalance>(
    "SELECT * FROM account_balances WHERE account_id = ? ORDER BY date DESC, id DESC",
    [accountId],
  );
}

export async function addBalanceSnapshot(
  accountId: number,
  date: string,
  balance: number,
): Promise<void> {
  await exec(
    "INSERT INTO account_balances (account_id, date, balance) VALUES (?, ?, ?)",
    [accountId, date, balance],
  );
}

export async function deleteBalanceSnapshot(id: number): Promise<void> {
  await exec("DELETE FROM account_balances WHERE id = ?", [id]);
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

/**
 * Saldo actual de una cuenta. Para cuentas manuales = último snapshot; para
 * cuentas importadas = saldo del movimiento más reciente. Es la magnitud sin
 * signo: el patrimonio neto aplica el signo según la clase (activo/pasivo).
 */
export async function currentBalance(accountId: number): Promise<number> {
  const snap = (await query<{ balance: number }>(
    "SELECT balance FROM account_balances WHERE account_id = ? ORDER BY date DESC, id DESC LIMIT 1",
    [accountId],
  ))[0];
  if (snap) return snap.balance;
  const row = (await query<{ saldo: number }>(
    `SELECT saldo FROM transactions
     WHERE account_id = ? AND saldo IS NOT NULL
     ORDER BY fecha_operacion DESC, id DESC LIMIT 1`,
    [accountId],
  ))[0];
  return row?.saldo ?? 0;
}
