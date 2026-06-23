import { query, exec } from "../db/database";
import { normalize } from "../lib/text";
import type { RuleSeed, Subtype } from "../rules/categoryRules";

export interface RuleRow {
  id: number;
  pattern: string;
  category_id: number;
  category_name: string;
  kind: string;
  color: string;
  icon: string;
  subtype: string | null;
  priority: number;
  enabled: number;
}

/** Todas las reglas (activas o no) con su categoría, para administrarlas. */
export async function listAllRules(): Promise<RuleRow[]> {
  return query<RuleRow>(
    `SELECT cr.id, cr.pattern, cr.category_id, c.name AS category_name, c.kind,
            c.color, c.icon, cr.subtype, cr.priority, cr.enabled
       FROM category_rules cr
       JOIN categories c ON c.id = cr.category_id
      ORDER BY cr.priority, c.name`,
  );
}

export async function createRule(r: {
  pattern: string;
  categoryId: number;
  subtype?: string | null;
  priority?: number;
}): Promise<void> {
  await exec(
    "INSERT INTO category_rules (pattern, category_id, subtype, priority, enabled) VALUES (?, ?, ?, ?, 1)",
    [r.pattern, r.categoryId, r.subtype ?? null, r.priority ?? 50],
  );
}

export async function updateRule(
  id: number,
  r: { pattern: string; categoryId: number; subtype?: string | null; priority: number; enabled: number },
): Promise<void> {
  await exec(
    "UPDATE category_rules SET pattern = ?, category_id = ?, subtype = ?, priority = ?, enabled = ? WHERE id = ?",
    [r.pattern, r.categoryId, r.subtype ?? null, r.priority, r.enabled, id],
  );
}

export async function setRuleEnabled(id: number, enabled: boolean): Promise<void> {
  await exec("UPDATE category_rules SET enabled = ? WHERE id = ?", [enabled ? 1 : 0, id]);
}

export async function deleteRule(id: number): Promise<void> {
  await exec("DELETE FROM category_rules WHERE id = ?", [id]);
}

/** Comprueba si un patrón es una expresión regular válida. */
export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reaplica las reglas a los movimientos que están en una categoría «fallback»
 * (Otros gastos / Otros ingresos), por si reglas nuevas ahora los clasifican.
 * Devuelve cuántos movimientos se recategorizaron. Útil tras editar reglas.
 */
export async function applyRulesToUncategorized(): Promise<number> {
  const rules = await listAllRules();
  const active = rules.filter((r) => r.enabled);
  if (active.length === 0) return 0;

  const pending = await query<{ id: number; concepto: string; importe: number }>(
    `SELECT t.id, t.concepto, t.importe FROM transactions t
       JOIN categories c ON c.id = t.category_id
      WHERE c.name IN ('Otros gastos', 'Otros ingresos')`,
  );
  let changed = 0;
  for (const tx of pending) {
    const n = normalize(tx.concepto);
    for (const r of active) {
      try {
        if (new RegExp(r.pattern).test(n)) {
          const internal = r.kind === "interno" ? 1 : 0;
          await exec(
            "UPDATE transactions SET category_id = ?, is_internal = ?, transfer_match_id = NULL WHERE id = ?",
            [r.category_id, internal, tx.id],
          );
          changed++;
          break;
        }
      } catch {
        // patrón inválido: se ignora.
      }
    }
  }
  return changed;
}

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
