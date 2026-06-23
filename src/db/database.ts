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
      await normalizeOrphans(db);
      return db;
    })();
  }
  return dbPromise;
}

/**
 * Saneamiento: movimientos que quedaron sin categoría (huérfanos por borrados de
 * categoría con versiones antiguas) se reasignan al fallback de su tipo, para que
 * vuelvan a contar en los análisis. Se ejecuta tras el seed (categorías ya creadas).
 */
async function normalizeOrphans(db: Database): Promise<void> {
  await db.execute(
    "UPDATE transactions SET category_id = (SELECT id FROM categories WHERE name = 'Otros gastos') WHERE category_id IS NULL AND importe < 0",
  );
  await db.execute(
    "UPDATE transactions SET category_id = (SELECT id FROM categories WHERE name = 'Otros ingresos') WHERE category_id IS NULL AND importe >= 0",
  );
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

  // reconciled en transactions: marcar movimientos como revisados/conciliados.
  const txCols = (await db.select(
    "PRAGMA table_info(transactions)",
  )) as Array<{ name: string }>;
  if (!txCols.some((c) => c.name === "reconciled")) {
    await db.execute("ALTER TABLE transactions ADD COLUMN reconciled INTEGER NOT NULL DEFAULT 0");
  }
  // receipt_path en transactions: ruta del recibo adjunto.
  if (!txCols.some((c) => c.name === "receipt_path")) {
    await db.execute("ALTER TABLE transactions ADD COLUMN receipt_path TEXT");
  }
  // transfer_match_id en transactions: id del movimiento contrario en la
  // conciliación de traspasos por importe.
  if (!txCols.some((c) => c.name === "transfer_match_id")) {
    await db.execute("ALTER TABLE transactions ADD COLUMN transfer_match_id INTEGER");
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
