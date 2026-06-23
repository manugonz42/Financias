// Copia de seguridad: exporta/importa toda la base de datos a un archivo JSON.
// Los datos viven solo en el directorio de la app; esto permite respaldarlos y
// restaurarlos (o moverlos a otro equipo).

import { save, open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { getDB } from "../db/database";

// Orden de inserción (padres antes que hijos por las claves foráneas). El borrado
// se hace en orden inverso. Mantener sincronizado con src/db/schema.ts.
const TABLES = [
  "accounts",
  "categories",
  "account_balances",
  "category_rules",
  "import_batches",
  "transactions",
  "budgets",
  "transaction_splits",
  "receipt_items",
  "item_rules",
  "pending_receipts",
  "scheduled_payments",
  "goals",
  "tags",
  "transaction_tags",
  "investments",
  "investment_lots",
  "settings",
  "dashboard_layout",
] as const;

const SCHEMA_VERSION = 1;

interface BackupFile {
  app: "financias";
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
}

async function tableExists(db: Awaited<ReturnType<typeof getDB>>, name: string): Promise<boolean> {
  const r = (await db.select(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    [name],
  )) as Array<{ name: string }>;
  return r.length > 0;
}

/** Construye el objeto de respaldo con el contenido de todas las tablas. */
export async function buildBackup(): Promise<BackupFile> {
  const db = await getDB();
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of TABLES) {
    if (!(await tableExists(db, t))) continue;
    tables[t] = (await db.select(`SELECT * FROM ${t}`)) as Record<string, unknown>[];
  }
  return {
    app: "financias",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

/** Abre el diálogo de guardado y escribe el respaldo JSON. Devuelve true si se guardó. */
export async function exportBackup(): Promise<boolean> {
  const backup = await buildBackup();
  const stamp = new Date().toISOString().slice(0, 10);
  const path = await save({
    defaultPath: `financias-backup-${stamp}.json`,
    filters: [{ name: "Copia de seguridad", extensions: ["json"] }],
  });
  if (!path) return false;
  await invoke("write_text_file", { path, contents: JSON.stringify(backup, null, 2) });
  return true;
}

function insertSQL(table: string, row: Record<string, unknown>): { sql: string; params: unknown[] } {
  const cols = Object.keys(row);
  const placeholders = cols.map(() => "?").join(", ");
  return {
    sql: `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
    params: cols.map((c) => row[c] as unknown),
  };
}

/** Restaura un respaldo: reemplaza TODO el contenido por el del archivo. */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  if (backup?.app !== "financias" || !backup.tables) {
    throw new Error("El archivo no es una copia de seguridad de Financias.");
  }
  const db = await getDB();

  // Borrar en orden inverso (hijos antes que padres).
  for (const t of [...TABLES].reverse()) {
    if (await tableExists(db, t)) await db.execute(`DELETE FROM ${t}`);
  }
  // Insertar en orden (padres primero).
  for (const t of TABLES) {
    const rows = backup.tables[t];
    if (!rows || !rows.length || !(await tableExists(db, t))) continue;
    for (const row of rows) {
      const { sql, params } = insertSQL(t, row);
      await db.execute(sql, params);
    }
  }
}

/** Abre el diálogo, lee el JSON y restaura. Devuelve true si se restauró. */
export async function importBackup(): Promise<boolean> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "Copia de seguridad", extensions: ["json"] }],
  });
  if (!selected || Array.isArray(selected)) return false;
  const bytes = await invoke<number[]>("read_file_bytes", { path: selected });
  const text = new TextDecoder().decode(new Uint8Array(bytes));
  const backup = JSON.parse(text) as BackupFile;
  await restoreBackup(backup);
  return true;
}
