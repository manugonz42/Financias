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
      await seed(db);
      return db;
    })();
  }
  return dbPromise;
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
