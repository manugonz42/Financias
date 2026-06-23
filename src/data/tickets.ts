import { query, exec } from "../db/database";
import { setReceiptPath, setReceiptItems } from "./receipts";
import type { MatchTx } from "../lib/ticketMatch";

export interface PendingReceipt {
  id: number;
  path: string;
  ticket_date: string | null;
  total: number | null;
  text: string | null;
  items_json: string | null;
  created_at: string;
}

export interface TicketItem {
  description: string;
  amount: number;
  category_id?: number | null;
}

/** Movimientos (gastos) candidatos en una ventana de fechas alrededor del ticket. */
export async function matchCandidates(date: string | null): Promise<MatchTx[]> {
  if (date) {
    const from = shiftDate(date, -10);
    const to = shiftDate(date, 10);
    return query<MatchTx>(
      `SELECT id, substr(fecha_operacion,1,10) AS fecha, importe,
              merchant, concepto
         FROM transactions
        WHERE importe < 0 AND substr(fecha_operacion,1,10) BETWEEN ? AND ?`,
      [from, to],
    );
  }
  // Sin fecha: los gastos más recientes.
  return query<MatchTx>(
    `SELECT id, substr(fecha_operacion,1,10) AS fecha, importe, merchant, concepto
       FROM transactions WHERE importe < 0
      ORDER BY fecha_operacion DESC LIMIT 400`,
  );
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Adjunta el ticket (archivo + desglose) a un movimiento. */
export async function attachTicketToTransaction(
  txId: number,
  path: string,
  items: TicketItem[],
): Promise<void> {
  await setReceiptPath(txId, path);
  if (items.length) {
    await setReceiptItems(
      txId,
      items.map((it) => ({ description: it.description, amount: it.amount, category_id: it.category_id ?? null })),
    );
  }
}

// --- Cola "en espera" ---------------------------------------------------------

export async function addPending(p: {
  path: string;
  date: string | null;
  total: number | null;
  text: string;
  items: TicketItem[];
}): Promise<void> {
  await exec(
    "INSERT INTO pending_receipts (path, ticket_date, total, text, items_json) VALUES (?, ?, ?, ?, ?)",
    [p.path, p.date, p.total, p.text, JSON.stringify(p.items)],
  );
}

export async function listPending(): Promise<PendingReceipt[]> {
  return query<PendingReceipt>("SELECT * FROM pending_receipts ORDER BY ticket_date DESC, id DESC");
}

export async function deletePending(id: number): Promise<void> {
  await exec("DELETE FROM pending_receipts WHERE id = ?", [id]);
}

export function parseItemsJson(json: string | null): TicketItem[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as TicketItem[];
  } catch {
    return [];
  }
}
