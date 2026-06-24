import { query, exec } from "../db/database";
import { FALLBACK_EXPENSE, FALLBACK_INCOME, INTERNAL_CATEGORY } from "../rules/categoryRules";
import type { Category, CategoryNode } from "../types";

export async function listCategories(): Promise<Category[]> {
  return query<Category>("SELECT * FROM categories ORDER BY kind, name");
}

// --- Jerarquía ----------------------------------------------------------------

/**
 * Construye el árbol de categorías a partir de la lista plana. Las raíces
 * (parent_id NULL) y las hijas de cada nodo se ordenan por nombre. Las
 * categorías cuyo padre no existe se tratan como raíces (defensa ante datos
 * inconsistentes).
 */
export function buildCategoryTree(cats: Category[]): CategoryNode[] {
  const byId = new Map<number, CategoryNode>();
  for (const c of cats) byId.set(c.id, { ...c, children: [], depth: 0 });

  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parent_id != null ? byId.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortRec = (nodes: CategoryNode[], depth: number) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, "es"));
    for (const n of nodes) {
      n.depth = depth;
      sortRec(n.children, depth + 1);
    }
  };
  sortRec(roots, 0);
  return roots;
}

/** Aplana el árbol en orden de presentación (padre seguido de sus hijas). */
export function flattenTree(nodes: CategoryNode[]): CategoryNode[] {
  const out: CategoryNode[] = [];
  const walk = (ns: CategoryNode[]) => {
    for (const n of ns) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export async function listCategoryTree(): Promise<CategoryNode[]> {
  return buildCategoryTree(await listCategories());
}

/** IDs de un nodo y todos sus descendientes (para roll-up y anti-ciclos). */
export function subtreeIds(cats: Category[], rootId: number): number[] {
  const childrenOf = new Map<number, number[]>();
  for (const c of cats) {
    if (c.parent_id != null) {
      const arr = childrenOf.get(c.parent_id) ?? [];
      arr.push(c.id);
      childrenOf.set(c.parent_id, arr);
    }
  }
  const ids: number[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    ids.push(id);
    for (const ch of childrenOf.get(id) ?? []) stack.push(ch);
  }
  return ids;
}

// --- CRUD ---------------------------------------------------------------------

export interface NewCategory {
  name: string;
  kind: Category["kind"];
  color?: string;
  icon?: string;
  parentId?: number | null;
}

/** Crea una categoría. Si tiene padre, hereda su `kind` por coherencia. */
export async function createCategory(c: NewCategory): Promise<void> {
  let kind = c.kind;
  if (c.parentId != null) {
    const parent = (await query<{ kind: Category["kind"] }>(
      "SELECT kind FROM categories WHERE id = ?",
      [c.parentId],
    ))[0];
    if (parent) kind = parent.kind;
  }
  await exec(
    "INSERT INTO categories (name, kind, color, icon, parent_id) VALUES (?, ?, ?, ?, ?)",
    [c.name.trim(), kind, c.color ?? "#9ca3af", c.icon ?? "•", c.parentId ?? null],
  );
}

/** Renombra / recolorea / cambia el icono de una categoría. */
export async function updateCategory(
  id: number,
  fields: { name?: string; color?: string; icon?: string },
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (fields.name != null) { sets.push("name = ?"); params.push(fields.name.trim()); }
  if (fields.color != null) { sets.push("color = ?"); params.push(fields.color); }
  if (fields.icon != null) { sets.push("icon = ?"); params.push(fields.icon); }
  if (!sets.length) return;
  params.push(id);
  await exec(`UPDATE categories SET ${sets.join(", ")} WHERE id = ?`, params);
}

/**
 * Mueve una categoría bajo otro padre (o a raíz con parentId = null).
 * Rechaza ciclos (no se puede colgar de sí misma ni de un descendiente) y
 * propaga el `kind` del nuevo padre a todo el subárbol movido.
 */
export async function moveCategory(
  id: number,
  parentId: number | null,
): Promise<void> {
  if (parentId === id) throw new Error("Una categoría no puede ser su propio padre.");
  const cats = await listCategories();
  if (parentId != null) {
    const descendants = subtreeIds(cats, id); // incluye id
    if (descendants.includes(parentId)) {
      throw new Error("No se puede mover una categoría dentro de una de sus subcategorías.");
    }
    const parent = cats.find((c) => c.id === parentId);
    if (parent) {
      const ids = subtreeIds(cats, id);
      await exec(
        `UPDATE categories SET kind = ? WHERE id IN (${ids.map(() => "?").join(",")})`,
        [parent.kind, ...ids],
      );
    }
  }
  await exec("UPDATE categories SET parent_id = ? WHERE id = ?", [parentId, id]);
}

/**
 * Borra una categoría. Sus hijas y sus movimientos suben al padre (o a raíz/
 * sin categoría si era raíz). Sus reglas y presupuesto se reapuntan al padre o
 * se eliminan si no hay padre.
 */
/**
 * Borra una categoría. Sus subcategorías suben al padre (o pasan a raíz). Sus
 * movimientos, splits y reglas se reasignan al **padre** si lo tiene; si era una
 * categoría raíz, van al **fallback de su tipo** (Otros gastos / Otros ingresos /
 * Traspaso interno), de modo que nada queda sin categoría.
 */
export async function deleteCategory(id: number): Promise<void> {
  const cat = (await query<{ parent_id: number | null; kind: Category["kind"]; seed_key: string | null }>(
    "SELECT parent_id, kind, seed_key FROM categories WHERE id = ?",
    [id],
  ))[0];
  if (!cat) return;
  const parentId = cat.parent_id;

  // Destino de movimientos/splits/reglas: el padre, o el fallback del tipo si es raíz.
  let target = parentId;
  if (target == null) {
    const fallbackName =
      cat.kind === "ingreso" ? FALLBACK_INCOME : cat.kind === "interno" ? INTERNAL_CATEGORY : FALLBACK_EXPENSE;
    const fb = (await query<{ id: number }>("SELECT id FROM categories WHERE name = ?", [fallbackName]))[0];
    target = fb && fb.id !== id ? fb.id : null;
  }

  await exec("UPDATE categories SET parent_id = ? WHERE parent_id = ?", [parentId, id]);
  await exec("UPDATE transactions SET category_id = ? WHERE category_id = ?", [target, id]);
  if (target != null) {
    await exec("UPDATE transaction_splits SET category_id = ? WHERE category_id = ?", [target, id]);
    await exec("UPDATE category_rules SET category_id = ? WHERE category_id = ?", [target, id]);
  } else {
    await exec("DELETE FROM transaction_splits WHERE category_id = ?", [id]);
    await exec("DELETE FROM category_rules WHERE category_id = ?", [id]);
  }
  await exec("UPDATE scheduled_payments SET category_id = NULL WHERE category_id = ?", [id]);
  await exec("DELETE FROM budgets WHERE category_id = ?", [id]);
  await exec("DELETE FROM categories WHERE id = ?", [id]);
  if (cat.seed_key) {
    await exec(
      "INSERT OR IGNORE INTO deleted_seed_categories (key) VALUES (?)",
      [cat.seed_key],
    );
  }
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
  // Al reasignar manualmente, marca interno=0 salvo que sea la categoría interna,
  // y deja constancia de que la categoría es manual (para poder revertirla).
  const cat = (await query<{ kind: string }>("SELECT kind FROM categories WHERE id = ?", [
    categoryId,
  ]))[0];
  const internal = cat?.kind === "interno" ? 1 : 0;
  await exec(
    "UPDATE transactions SET category_id = ?, is_internal = ?, manual_category = 1 WHERE id = ?",
    [categoryId, internal, txId],
  );
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
        SET category_id = ?, is_internal = ?, manual_category = 1
      WHERE COALESCE(NULLIF(merchant, ''), concepto) = ?`,
    [categoryId, internal, tx.key],
  );
  return Number(res.rowsAffected ?? 0);
}
