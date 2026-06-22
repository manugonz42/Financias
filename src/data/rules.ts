import { query, exec } from "../db/database";
import { normalize } from "../lib/text";
import type { RuleSeed, Subtype } from "../rules/categoryRules";

/** Carga las reglas de autocategorización editables desde la BD (las sembradas
 *  + las que el usuario ha ido creando al revisar). */
export async function loadRules(): Promise<RuleSeed[]> {
  const rows = await query<{
    pattern: string;
    category: string;
    subtype: string | null;
    priority: number;
  }>(
    `SELECT cr.pattern, c.name AS category, cr.subtype, cr.priority
       FROM category_rules cr
       JOIN categories c ON c.id = cr.category_id
      WHERE cr.enabled = 1
      ORDER BY cr.priority`,
  );
  return rows.map((r) => ({
    pattern: r.pattern,
    category: r.category,
    subtype: (r.subtype ?? undefined) as Subtype | undefined,
    priority: r.priority,
  }));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Crea una regla para que, en próximas importaciones, los movimientos con este
 *  comercio/concepto se categoricen solos. El patrón es el texto normalizado y
 *  escapado (coincidencia literal sobre el concepto normalizado). */
export async function addRuleForKey(
  key: string,
  categoryId: number,
): Promise<void> {
  const pattern = escapeRegex(normalize(key));
  if (!pattern) return;
  // Evita duplicar la misma regla.
  const dup = await query<{ n: number }>(
    "SELECT COUNT(*) AS n FROM category_rules WHERE pattern = ? AND category_id = ?",
    [pattern, categoryId],
  );
  if ((dup[0]?.n ?? 0) > 0) return;
  await exec(
    "INSERT INTO category_rules (pattern, category_id, subtype, priority) VALUES (?, ?, ?, ?)",
    [pattern, categoryId, null, 50],
  );
}
