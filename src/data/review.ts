import { query, exec } from "../db/database";
import { FALLBACK_EXPENSE } from "../rules/categoryRules";

export interface UncatGroup {
  /** Clave de agrupación: comercio si existe, si no el concepto en bruto. */
  key: string;
  /** Número de movimientos con esta clave dentro de «Otros gastos». */
  count: number;
  /** Suma del gasto (valor absoluto). */
  total: number;
  /** Fecha del movimiento más reciente del grupo. */
  last_seen: string;
}

/**
 * Grupos de movimientos sin clasificar = los que cayeron en «Otros gastos»,
 * agrupados por comercio/concepto. Se revisan uno por uno; al asignar categoría
 * se aplica a todos los del mismo grupo.
 */
export async function listUncategorized(
  categoryName = FALLBACK_EXPENSE,
): Promise<UncatGroup[]> {
  return query<UncatGroup>(
    `SELECT COALESCE(NULLIF(t.merchant, ''), t.concepto) AS key,
            COUNT(*) AS count,
            SUM(ABS(t.importe)) AS total,
            MAX(t.fecha_operacion) AS last_seen
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
      WHERE c.name = ?
      GROUP BY key
      ORDER BY count DESC, total DESC`,
    [categoryName],
  );
}

/**
 * Asigna una categoría a todos los movimientos de «Otros gastos» que comparten
 * la misma clave (comercio/concepto). Devuelve cuántos se actualizaron.
 */
export async function assignGroup(
  key: string,
  categoryId: number,
  fromCategory = FALLBACK_EXPENSE,
): Promise<number> {
  const cat = (await query<{ kind: string }>(
    "SELECT kind FROM categories WHERE id = ?",
    [categoryId],
  ))[0];
  const internal = cat?.kind === "interno" ? 1 : 0;
  const res = await exec(
    `UPDATE transactions
        SET category_id = ?, is_internal = ?
      WHERE COALESCE(NULLIF(merchant, ''), concepto) = ?
        AND category_id = (SELECT id FROM categories WHERE name = ?)`,
    [categoryId, internal, key, fromCategory],
  );
  return Number(res.rowsAffected ?? 0);
}
