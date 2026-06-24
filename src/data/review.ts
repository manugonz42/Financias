import { getDB, query, exec } from "../db/database";
import { FALLBACK_EXPENSE, FALLBACK_INCOME } from "../rules/categoryRules";
import { categorize, compileRules } from "../import/categorize";
import { loadRules } from "./rules";
import { categoryIdMap } from "./categories";
import { getOwnerName } from "./settings";
import type { ParsedTransaction } from "../import/openbankParser";

// Etiquetas BBVA que pueden aparecer dentro del concepto en movimientos
// importados antes de que el parser separase la etiqueta a una columna propia.
// Buscando en orden de mayor a menor longitud evita que "Bizum" se trague
// "Bizum payment".
const BBVA_LABEL_HINTS = [
  "Deposit from salary or pension",
  "Fees,expenses and interest paid",
  "Transfer from card",
  "Monthly card debit",
  "Loan instalment",
  "ATM withdrawal",
  "Cash withdrawal",
  "Cash deposit",
  "Card payment",
  "Direct debit",
  "Bizum payment",
  "Bizum received",
  "Transfer received",
  "Transfer in",
  "Transfer out",
  "Subscription",
  "Interest",
  "Devuelto",
  "Others",
  "Bizum",
  "Fee",
];

function deriveBankSubtypeLabel(concepto: string): string | undefined {
  const c = concepto.toLowerCase();
  for (const l of BBVA_LABEL_HINTS) {
    if (c.includes(l.toLowerCase())) return l;
  }
  return undefined;
}

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
        SET category_id = ?, is_internal = ?, manual_category = 1
      WHERE COALESCE(NULLIF(merchant, ''), concepto) = ?
        AND category_id = (SELECT id FROM categories WHERE name = ?)`,
    [categoryId, internal, key, fromCategory],
  );
  return Number(res.rowsAffected ?? 0);
}

interface PendingRow {
  id: number;
  concepto: string;
  importe: number;
  saldo: number;
  fecha_operacion: string;
  fecha_valor: string;
  bank_subtype_label: string | null;
  current_category: string;
}

/**
 * Reaplica las reglas actuales a todos los movimientos que hoy están en los
 * cubos de fallback («Otros gastos» / «Otros ingresos»). Se llama desde la
 * vista Categorizar tras añadir o ampliar reglas, para recuperar movimientos
 * que con la nueva taxonomía dejan de ser desconocidos.
 *
 * Devuelve {total: movimientos revisados, updated: movimientos que cambiaron}.
 */
export async function recategorizePending(): Promise<{
  total: number;
  updated: number;
}> {
  const rows = await query<PendingRow>(
    `SELECT t.id, t.concepto, t.importe, t.saldo,
            t.fecha_operacion, t.fecha_valor,
            t.bank_subtype_label, c.name AS current_category
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
      WHERE c.name IN (?, ?)
        AND t.manual_category = 0`,
    [FALLBACK_EXPENSE, FALLBACK_INCOME],
  );
  if (rows.length === 0) return { total: 0, updated: 0 };

  const dbRules = await loadRules();
  const rules = compileRules(dbRules.length ? dbRules : undefined);
  const catMap = await categoryIdMap();
  const owner = await getOwnerName();

  const db = await getDB();
  let updated = 0;
  await db.execute("BEGIN");
  try {
    for (const r of rows) {
      // Si la transacción se importó antes de que persistiéramos la etiqueta,
      // intentamos derivarla del propio concepto (el parser viejo dejaba ahí
      // "Card payment", "Bizum"…) para que las reglas vuelvan a casar.
      const label =
        r.bank_subtype_label ?? deriveBankSubtypeLabel(r.concepto);
      const tx: ParsedTransaction = {
        fechaOperacion: r.fecha_operacion,
        fechaValor: r.fecha_valor,
        concepto: r.concepto,
        importe: r.importe,
        saldo: r.saldo,
        bankSubtypeLabel: label,
      };
      const f = categorize(tx, rules, owner);
      if (f.category === r.current_category) continue;
      const newId = catMap.get(f.category);
      if (!newId) continue;
      await db.execute(
        `UPDATE transactions
            SET category_id = ?, subtype = ?, merchant = ?, is_internal = ?
          WHERE id = ?`,
        [newId, f.subtype, f.merchant, f.isInternal ? 1 : 0, r.id],
      );
      updated++;
    }
    await db.execute("COMMIT");
  } catch (e) {
    await db.execute("ROLLBACK");
    throw e;
  }
  return { total: rows.length, updated };
}

/** Cuántos movimientos tienen marca `manual_category = 1`. Sirve para que la
 *  UI decida si ofrecer la purga normal o la purga legacy (sesiones antiguas
 *  no tienen la marca y necesitan otro tratamiento). */
export async function countManualCategories(): Promise<number> {
  const row = (await query<{ n: number }>(
    "SELECT COUNT(*) AS n FROM transactions WHERE manual_category = 1",
  ))[0];
  return row?.n ?? 0;
}

/**
 * Devuelve al fallback los movimientos que el usuario categorizó a mano (vía
 * Categorizar o reasignación directa). Útil para deshacer una mala asignación
 * masiva. No toca las reglas creadas (esas viven en `category_rules`); si el
 * usuario quiere puede borrarlas desde el gestor de reglas.
 *
 * Devuelve cuántos movimientos se han devuelto al fallback.
 */
export async function clearManualCategories(): Promise<number> {
  const expenseId = (await query<{ id: number }>(
    "SELECT id FROM categories WHERE name = ?",
    [FALLBACK_EXPENSE],
  ))[0]?.id;
  const incomeId = (await query<{ id: number }>(
    "SELECT id FROM categories WHERE name = ?",
    [FALLBACK_INCOME],
  ))[0]?.id;
  if (!expenseId || !incomeId) return 0;

  const db = await getDB();
  await db.execute("BEGIN");
  let updated = 0;
  try {
    const expRes = await db.execute(
      `UPDATE transactions
          SET category_id = ?, manual_category = 0, is_internal = 0, merchant = NULL
        WHERE manual_category = 1 AND importe < 0`,
      [expenseId],
    );
    const incRes = await db.execute(
      `UPDATE transactions
          SET category_id = ?, manual_category = 0, is_internal = 0, merchant = NULL
        WHERE manual_category = 1 AND importe >= 0`,
      [incomeId],
    );
    updated = Number(expRes.rowsAffected ?? 0) + Number(incRes.rowsAffected ?? 0);
    await db.execute("COMMIT");
  } catch (e) {
    await db.execute("ROLLBACK");
    throw e;
  }
  return updated;
}

/**
 * Purga «legacy»: devuelve al fallback TODOS los movimientos que tengan una
 * categoría no-fallback y no-interna, sin importar si están marcados como
 * manuales o no. Pensado para bases de datos anteriores a la columna
 * `manual_category`, donde el usuario sí tiene asignaciones manuales viejas
 * pero no podemos distinguirlas de las reglas. Después conviene llamar a
 * `recategorizePending()` para que las reglas actuales vuelvan a aplicar.
 */
export async function clearAllCategorizations(): Promise<number> {
  const expenseId = (await query<{ id: number }>(
    "SELECT id FROM categories WHERE name = ?",
    [FALLBACK_EXPENSE],
  ))[0]?.id;
  const incomeId = (await query<{ id: number }>(
    "SELECT id FROM categories WHERE name = ?",
    [FALLBACK_INCOME],
  ))[0]?.id;
  if (!expenseId || !incomeId) return 0;

  const db = await getDB();
  await db.execute("BEGIN");
  let updated = 0;
  try {
    const expRes = await db.execute(
      `UPDATE transactions
          SET category_id = ?, manual_category = 0, is_internal = 0, merchant = NULL
        WHERE importe < 0
          AND category_id IS NOT NULL
          AND category_id NOT IN (
            SELECT id FROM categories WHERE name IN (?, ?) OR kind = 'interno'
          )`,
      [expenseId, FALLBACK_EXPENSE, FALLBACK_INCOME],
    );
    const incRes = await db.execute(
      `UPDATE transactions
          SET category_id = ?, manual_category = 0, is_internal = 0, merchant = NULL
        WHERE importe >= 0
          AND category_id IS NOT NULL
          AND category_id NOT IN (
            SELECT id FROM categories WHERE name IN (?, ?) OR kind = 'interno'
          )`,
      [incomeId, FALLBACK_EXPENSE, FALLBACK_INCOME],
    );
    updated = Number(expRes.rowsAffected ?? 0) + Number(incRes.rowsAffected ?? 0);
    await db.execute("COMMIT");
  } catch (e) {
    await db.execute("ROLLBACK");
    throw e;
  }
  return updated;
}
