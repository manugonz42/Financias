import { query, exec } from "../db/database";
import type { Category } from "../types";

export async function listCategories(): Promise<Category[]> {
  return query<Category>("SELECT * FROM categories ORDER BY kind, name");
}

export async function categoryByName(name: string): Promise<Category | undefined> {
  return (await query<Category>("SELECT * FROM categories WHERE name = ?", [name]))[0];
}

/** Mapa nombre -> id, útil al importar. */
export async function categoryIdMap(): Promise<Map<string, number>> {
  const cats = await query<{ id: number; name: string }>("SELECT id, name FROM categories");
  return new Map(cats.map((c) => [c.name, c.id]));
}

export async function reassignCategory(txId: number, categoryId: number): Promise<void> {
  // Al reasignar manualmente, marca interno=0 salvo que sea la categoría interna.
  const cat = (await query<{ kind: string }>("SELECT kind FROM categories WHERE id = ?", [
    categoryId,
  ]))[0];
  const internal = cat?.kind === "interno" ? 1 : 0;
  await exec("UPDATE transactions SET category_id = ?, is_internal = ? WHERE id = ?", [
    categoryId,
    internal,
    txId,
  ]);
}

/**
 * Reasigna la categoría de un movimiento y de TODOS los que comparten el mismo
 * elemento (comercio o, si no lo hay, concepto), como en la pantalla de
 * categorizar. Devuelve cuántos movimientos se actualizaron.
 */
export async function reassignCategoryByElement(
  txId: number,
  categoryId: number,
): Promise<number> {
  const cat = (await query<{ kind: string }>("SELECT kind FROM categories WHERE id = ?", [
    categoryId,
  ]))[0];
  const internal = cat?.kind === "interno" ? 1 : 0;
  const tx = (await query<{ key: string }>(
    "SELECT COALESCE(NULLIF(merchant, ''), concepto) AS key FROM transactions WHERE id = ?",
    [txId],
  ))[0];
  if (!tx) return 0;
  const res = await exec(
    `UPDATE transactions
        SET category_id = ?, is_internal = ?
      WHERE COALESCE(NULLIF(merchant, ''), concepto) = ?`,
    [categoryId, internal, tx.key],
  );
  return Number(res.rowsAffected ?? 0);
}
