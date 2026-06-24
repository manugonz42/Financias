// Conexión única a SQLite (vía tauri-plugin-sql) e inicialización idempotente
// del esquema + datos semilla.

import Database from "@tauri-apps/plugin-sql";
import { SCHEMA } from "./schema";
import { seed } from "./seed";
import { CATEGORIES } from "../rules/categoryRules";

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
  // seed_key en categories: ancla a la semilla original para que renombres y
  // borrados de categorías sembradas persistan entre arranques.
  if (!catCols.some((c) => c.name === "seed_key")) {
    await db.execute("ALTER TABLE categories ADD COLUMN seed_key TEXT");
    // Backfill: las filas con nombre = nombre de semilla son las sembradas.
    for (const c of CATEGORIES) {
      await db.execute(
        "UPDATE categories SET seed_key = ? WHERE name = ? AND seed_key IS NULL",
        [c.name, c.name],
      );
    }
  }
  await db.execute(
    "CREATE TABLE IF NOT EXISTS deleted_seed_categories (key TEXT PRIMARY KEY)",
  );

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
  // manual_category en transactions: 1 = el usuario asignó la categoría a mano
  // (vía la vista Categorizar). Sirve para poder revertirla en bloque.
  if (!txCols.some((c) => c.name === "manual_category")) {
    await db.execute(
      "ALTER TABLE transactions ADD COLUMN manual_category INTEGER NOT NULL DEFAULT 0",
    );
  }
  // bank_subtype_label en transactions: etiqueta del banco que el parser separa
  // del concepto (BBVA: "Card payment", "Bizum", "Direct debit"…). Persistirla
  // permite que la re-clasificación posterior la siga viendo y casar reglas.
  if (!txCols.some((c) => c.name === "bank_subtype_label")) {
    await db.execute("ALTER TABLE transactions ADD COLUMN bank_subtype_label TEXT");
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
 * Borra todos los datos importados (movimientos, splits, líneas de recibo,
 * recibos pendientes, saldos manuales, lotes y cuentas) y el titular detectado,
 * dejando la app como recién instalada. Conserva categorías, reglas,
 * presupuestos y el layout del dashboard. Orden de borrado de hijos a padres
 * para evitar quedarse pillado si en el futuro se activan foreign keys. Si
 * alguna tabla no existe en una BD muy antigua, se ignora y continúa con el
 * resto en vez de abortar la operación entera.
 */
export async function resetData(): Promise<void> {
  const db = await getDB();
  const tables = [
    "transaction_splits",
    "receipt_items",
    "pending_receipts",
    "account_balances",
    "transactions",
    "import_batches",
    "accounts",
  ];
  const errors: string[] = [];
  for (const t of tables) {
    try {
      await db.execute(`DELETE FROM ${t}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/no such table/i.test(msg)) errors.push(`${t}: ${msg}`);
    }
  }
  try {
    await db.execute("DELETE FROM settings WHERE key = 'owner_name'");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`settings: ${msg}`);
  }
  if (errors.length > 0) {
    throw new Error(`No se pudo borrar todo: ${errors.join("; ")}`);
  }
}
