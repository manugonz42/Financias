// Conciliación de traspasos entre cuentas por importe.
//
// La detección por nombre del titular (categorize.ts) solo marca como interno el
// lado del traspaso cuyo extracto muestra el nombre (p. ej. la SALIDA de Openbank
// "A FAVOR DE <titular>"). El otro lado —el INGRESO en Unicaja, sin nombre— se
// quedaba contando como ingreso real. Aquí emparejamos cada movimiento aún no
// interno con su contrario del mismo importe en OTRA cuenta (la salida o el
// ingreso correspondiente, esté o no ya marcado) dentro de una ventana de días, y
// marcamos como interno el lado que faltaba. Así ambos lados quedan excluidos de
// TODOS los cálculos, que ya filtran is_internal = 0.

import { getDB } from "../db/database";
import { getReconcileConfig } from "./settings";

/** Margen de días por defecto entre la salida y el ingreso del mismo traspaso. */
export const DEFAULT_WINDOW_DAYS = 7;

export interface Row {
  id: number;
  account_id: number;
  fecha_operacion: string; // ISO 'YYYY-MM-DD'
  importe: number;
  is_internal: number; // 1 si ya es interno por titular/categoría
  category_id: number | null;
}

export interface MatchOptions {
  windowDays: number;
  /** Tolerancia de importe en euros (0 = igualdad exacta a céntimo). */
  amountTolerance?: number;
  /** Categorías que no participan en el emparejamiento. */
  excludedCategoryIds?: Set<number>;
}

/** Diferencia en días (absoluta) entre dos fechas ISO 'YYYY-MM-DD'. */
function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
}

/**
 * Empareja traspasos entre cuentas por importe. Función pura (sin BD).
 *
 * Recorre los movimientos AÚN NO internos (los que faltan por excluir) y, para
 * cada uno, busca su contrario: importe igual (±tolerancia), signo opuesto, en
 * OTRA cuenta y dentro de ±windowDays. El contrario puede estar ya marcado interno
 * (p. ej. la salida de Openbank detectada por el nombre del titular) o no.
 *
 * Devuelve la lista de marcas [id, contrarioId]: en cada una hay que poner
 * is_internal = 1 y transfer_match_id = contrarioId en el movimiento `id`. Solo se
 * marcan movimientos que partían de is_internal = 0; el contrario ya interno no se
 * toca (solo se usa como pareja). 1-a-1: cada contrario se usa una sola vez.
 */
export function matchTransfers(
  rows: Row[],
  opts: MatchOptions,
): Array<[number, number]> {
  const windowDays = opts.windowDays;
  const tol = Math.max(0, opts.amountTolerance ?? 0);
  const excluded = opts.excludedCategoryIds ?? new Set<number>();

  const eligible = (r: Row) =>
    r.importe !== 0 && !(r.category_id != null && excluded.has(r.category_id));

  // Orden estable por fecha y luego id, para resultados deterministas.
  const sorted = [...rows].sort((a, b) =>
    a.fecha_operacion < b.fecha_operacion
      ? -1
      : a.fecha_operacion > b.fecha_operacion
        ? 1
        : a.id - b.id,
  );

  const consumed = new Set<number>(); // ids ya emparejados (cualquier lado)
  const marks: Array<[number, number]> = [];

  for (const leg of sorted) {
    if (leg.is_internal !== 0 || consumed.has(leg.id) || !eligible(leg)) continue;

    // Contrario: signo opuesto, otra cuenta, importe dentro de tolerancia,
    // dentro de la ventana, sin usar y más cercano en fecha. Empate de fechas ->
    // menor diferencia de importe -> menor id (determinista).
    const legAbs = Math.abs(leg.importe);
    let best: Row | null = null;
    let bestDiff = Infinity;
    let bestAmtDiff = Infinity;
    for (const c of sorted) {
      if (c.id === leg.id || consumed.has(c.id) || !eligible(c)) continue;
      if (Math.sign(c.importe) === Math.sign(leg.importe)) continue;
      if (c.account_id === leg.account_id) continue;
      const amtDiff = Math.abs(Math.abs(c.importe) - legAbs);
      if (amtDiff > tol + 1e-9) continue;
      const diff = daysBetween(leg.fecha_operacion, c.fecha_operacion);
      if (diff > windowDays) continue;
      const better =
        diff < bestDiff ||
        (diff === bestDiff && amtDiff < bestAmtDiff) ||
        (diff === bestDiff && amtDiff === bestAmtDiff && best !== null && c.id < best.id);
      if (better) {
        best = c;
        bestDiff = diff;
        bestAmtDiff = amtDiff;
      }
    }
    if (!best) continue;

    consumed.add(leg.id);
    consumed.add(best.id);
    marks.push([leg.id, best.id]);
    // Si el contrario tampoco estaba excluido (traspaso sin nombre en ningún
    // lado), también hay que marcarlo.
    if (best.is_internal === 0) marks.push([best.id, leg.id]);
  }

  return marks;
}

/**
 * Reconcilia los traspasos entre cuentas por importe y los marca como internos.
 *
 * - Idempotente: deshace sus propias marcas (transfer_match_id) antes de recalcular,
 *   por lo que se puede ejecutar tras cada importación sin acumular efectos. Solo
 *   toca movimientos que marcó esta función; no pisa los internos por titular/categoría.
 * - 1-a-1: cada contrario se empareja una sola vez (no se cuenta dos veces).
 * - Respeta la configuración del usuario (ventana, tolerancia, categorías excluidas).
 *
 * Devuelve cuántos movimientos se han marcado como traspaso.
 */
export async function reconcileTransfers(): Promise<number> {
  const db = await getDB();
  const cfg = await getReconcileConfig();

  // 1) Deshacer las marcas automáticas previas (solo las creadas aquí: tienen
  //    transfer_match_id; todas partían de is_internal = 0). No afecta a los
  //    internos por titular/categoría, que no llevan transfer_match_id.
  await db.execute(
    "UPDATE transactions SET is_internal = 0, transfer_match_id = NULL WHERE transfer_match_id IS NOT NULL",
  );

  // 2) Todos los movimientos (con su estado interno actual). El contrario de un
  //    traspaso puede estar ya marcado interno por el nombre del titular.
  const rows = (await db.select(
    "SELECT id, account_id, fecha_operacion, importe, is_internal, category_id FROM transactions",
  )) as Row[];

  const marks = matchTransfers(rows, {
    windowDays: cfg.windowDays,
    amountTolerance: cfg.amountTolerance,
    excludedCategoryIds: new Set(cfg.excludedCategoryIds),
  });

  // 3) Marcar como interno cada lado que faltaba y enlazarlo con su contrario.
  for (const [id, matchId] of marks) {
    await db.execute(
      "UPDATE transactions SET is_internal = 1, transfer_match_id = ? WHERE id = ?",
      [matchId, id],
    );
  }

  return marks.length;
}

export interface TransferMatch {
  id: number;
  account_name: string;
  fecha_operacion: string;
  concepto: string;
  merchant: string | null;
  importe: number;
  match_id: number;
  match_account_name: string;
  match_fecha: string;
  match_importe: number;
}

/** Lista las parejas de traspaso detectadas por importe (para auditar). Cada
 *  traspaso aparece una sola vez (el lado de menor id). */
export async function listTransferMatches(): Promise<TransferMatch[]> {
  const db = await getDB();
  return (await db.select(
    `SELECT t.id, a.name AS account_name, t.fecha_operacion, t.concepto, t.merchant,
            t.importe, t.transfer_match_id AS match_id,
            a2.name AS match_account_name, m.fecha_operacion AS match_fecha,
            m.importe AS match_importe
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       JOIN transactions m ON m.id = t.transfer_match_id
       JOIN accounts a2 ON a2.id = m.account_id
      WHERE t.transfer_match_id IS NOT NULL AND t.id < t.transfer_match_id
      ORDER BY t.fecha_operacion DESC`,
  )) as TransferMatch[];
}

/** Deshace un emparejamiento concreto: ambos lados vuelven a contar (salvo que
 *  el contrario fuera interno por el titular, que conserva su is_internal). */
export async function unlinkTransfer(id: number): Promise<void> {
  const db = await getDB();
  const row = (await db.select(
    "SELECT transfer_match_id FROM transactions WHERE id = ?",
    [id],
  )) as Array<{ transfer_match_id: number | null }>;
  const matchId = row[0]?.transfer_match_id;
  // El lado que esta función marcó (tiene transfer_match_id apuntando al otro)
  // se libera por completo. El contrario solo se libera si su marca era de la
  // conciliación (transfer_match_id no nulo); si era interno por titular, se deja.
  await db.execute(
    "UPDATE transactions SET is_internal = 0, transfer_match_id = NULL WHERE id = ?",
    [id],
  );
  if (matchId != null) {
    await db.execute(
      "UPDATE transactions SET is_internal = 0, transfer_match_id = NULL WHERE id = ? AND transfer_match_id IS NOT NULL",
      [matchId],
    );
  }
}
