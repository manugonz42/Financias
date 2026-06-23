// Conexión única a SQLite (vía tauri-plugin-sql) e inicialización idempotente
// del esquema + datos semilla.

import Database from "@tauri-apps/plugin-sql";
import { SCHEMA } from "./schema";
import { seed } from "./seed";

let dbPromise: Promise<Database> | null = null;

export function getDB(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await Database.load("sqlite:financias.db");
      for (const stmt of SCHEMA) {
        await db.execute(stmt);
      }
      await migrate(db);
      await seed(db);
      return db;
    })();
  }
  return dbPromise;
}

/**
 * Migraciones idempotentes para BDs ya creadas en versiones anteriores
 * (CREATE TABLE IF NOT EXISTS no añade columnas nuevas a tablas existentes).
 */
async function migrate(db: Database): Promise<void> {
  // parent_id en categories: jerarquía de categorías.
  const catCols = (await db.select(
    "PRAGMA table_info(categories)",
  )) as Array<{ name: string }>;
  if (!catCols.some((c) => c.name === "parent_id")) {
    await db.execute(
      "ALTER TABLE categories ADD COLUMN parent_id INTEGER REFERENCES categories(id)",
    );
  }

  // manual / class en accounts: cuentas manuales y patrimonio neto.
  const accCols = (await db.select(
    "PRAGMA table_info(accounts)",
  )) as Array<{ name: string }>;
  if (!accCols.some((c) => c.name === "manual")) {
    await db.execute("ALTER TABLE accounts ADD COLUMN manual INTEGER NOT NULL DEFAULT 0");
  }
  if (!accCols.some((c) => c.name === "class")) {
    await db.execute("ALTER TABLE accounts ADD COLUMN class TEXT NOT NULL DEFAULT 'activo'");
  }
}

/** Helper de selección tipada. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = await getDB();
  return (await db.select(sql, params)) as T[];
}

/** Helper de ejecución (INSERT/UPDATE/DELETE). */
export async function exec(sql: string, params: unknown[] = []) {
  const db = await getDB();
  return db.execute(sql, params);
}

/**
 * Borra todos los datos importados (movimientos, lotes y cuentas) y el titular
 * detectado, dejando la app como recién instalada. Conserva categorías, reglas,
 * presupuestos y el layout del dashboard.
 */
export async function resetData(): Promise<void> {
  const db = await getDB();
  await db.execute("DELETE FROM transactions");
  await db.execute("DELETE FROM import_batches");
  await db.execute("DELETE FROM accounts");
  await db.execute("DELETE FROM settings WHERE key = 'owner_name'");
}
