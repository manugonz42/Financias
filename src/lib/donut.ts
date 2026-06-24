// Roll-up de gasto por subárbol de categorías para el donut con drill-down.
// Cada movimiento cuenta una sola vez en su categoría asignada; un nodo padre
// agrega el gasto propio + el de todas sus descendientes.

import type { Category } from "../types";

export interface DonutSlice {
  /** id de la categoría que representa el slice (para el drill-down). */
  id: number;
  name: string;
  value: number;
  color: string;
  /** true si la categoría tiene subcategorías con gasto (se puede abrir). */
  drillable: boolean;
}

export interface SunburstNode {
  id: string;
  color: string;
  value?: number; // solo en hojas
  children?: SunburstNode[];
}

/**
 * Árbol de gasto por categorías para el sunburst: root → categorías raíz →
 * subcategorías. Cada nodo con gasto propio + hijas añade una hoja "(directo)"
 * para que la suma cuadre. Reutiliza el roll-up por subárbol del donut.
 */
export function categorySunburst(cats: Category[], valueById: Map<number, number>): SunburstNode {
  const childrenOf = childrenMap(cats);
  const totals = subtreeTotals(cats, valueById, childrenOf);
  const byId = new Map(cats.map((c) => [c.id, c]));

  const build = (id: number): SunburstNode | null => {
    const total = totals.get(id) ?? 0;
    if (total <= 0) return null;
    const c = byId.get(id);
    if (!c) return null;
    const kids = (childrenOf.get(id) ?? [])
      .map(build)
      .filter((n): n is SunburstNode => n != null);
    if (kids.length === 0) return { id: c.name, color: c.color, value: +total.toFixed(2) };
    const own = valueById.get(id) ?? 0;
    if (own > 0) kids.push({ id: `${c.name} (directo)`, color: c.color, value: +own.toFixed(2) });
    return { id: c.name, color: c.color, children: kids };
  };

  const roots = cats
    .filter((c) => c.parent_id == null)
    .map((c) => build(c.id))
    .filter((n): n is SunburstNode => n != null);
  return { id: "root", color: "transparent", children: roots };
}

function childrenMap(cats: Category[]): Map<number, number[]> {
  const m = new Map<number, number[]>();
  for (const c of cats) {
    if (c.parent_id != null) {
      const arr = m.get(c.parent_id) ?? [];
      arr.push(c.id);
      m.set(c.parent_id, arr);
    }
  }
  return m;
}

/** Total de cada categoría incluyendo su subárbol (memoizado). */
function subtreeTotals(
  cats: Category[],
  valueById: Map<number, number>,
  childrenOf: Map<number, number[]>,
): Map<number, number> {
  const memo = new Map<number, number>();
  const calc = (id: number): number => {
    const cached = memo.get(id);
    if (cached != null) return cached;
    let total = valueById.get(id) ?? 0;
    for (const ch of childrenOf.get(id) ?? []) total += calc(ch);
    memo.set(id, total);
    return total;
  };
  for (const c of cats) calc(c.id);
  return memo;
}

/**
 * Slices del donut para un nivel:
 * - `parentId = null`: categorías raíz (cada una con el total de su subárbol).
 * - `parentId = X`: subcategorías directas de X (con su subárbol), más un slice
 *   "(directo)" con el gasto asignado a X mismo, para que la suma cuadre.
 * Ordenados de mayor a menor.
 */
export function donutSlices(
  cats: Category[],
  valueById: Map<number, number>,
  parentId: number | null,
): DonutSlice[] {
  const childrenOf = childrenMap(cats);
  const totals = subtreeTotals(cats, valueById, childrenOf);
  const byId = new Map(cats.map((c) => [c.id, c]));
  const slices: DonutSlice[] = [];

  const sliceFor = (c: Category): DonutSlice | null => {
    const v = totals.get(c.id) ?? 0;
    if (v <= 0) return null;
    const kids = childrenOf.get(c.id) ?? [];
    const drillable = kids.some((k) => (totals.get(k) ?? 0) > 0);
    return { id: c.id, name: c.name, value: v, color: c.color, drillable };
  };

  if (parentId == null) {
    for (const c of cats) {
      if (c.parent_id != null) continue;
      const s = sliceFor(c);
      if (s) slices.push(s);
    }
  } else {
    for (const kid of childrenOf.get(parentId) ?? []) {
      const c = byId.get(kid);
      if (!c) continue;
      const s = sliceFor(c);
      if (s) slices.push(s);
    }
    const own = valueById.get(parentId) ?? 0;
    const parent = byId.get(parentId);
    if (own > 0 && parent) {
      slices.push({ id: parentId, name: `${parent.name} (directo)`, value: own, color: parent.color, drillable: false });
    }
  }

  slices.sort((a, b) => b.value - a.value);
  return slices;
}
