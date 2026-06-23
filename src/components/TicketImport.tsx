import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "../state/AppContext";
import { parseReceipt } from "../lib/receiptParse";
import { matchTicket, type MatchTx } from "../lib/ticketMatch";
import { suggestItemCategory } from "../data/receipts";
import {
  matchCandidates,
  attachTicketToTransaction,
  addPending,
  listPending,
  deletePending,
  parseItemsJson,
  type PendingReceipt,
  type TicketItem,
} from "../data/tickets";
import { formatEUR, formatDate } from "../lib/format";

const fileName = (p: string) => p.split(/[\\/]/).pop() ?? p;
const txLabel = (tx: MatchTx) => `${formatDate(tx.fecha)} · ${tx.merchant ?? tx.concepto} · ${formatEUR(tx.importe)}`;

interface QItem {
  path: string;
  date: string | null;
  total: number | null;
  text: string;
  items: TicketItem[];
  options: MatchTx[];
  chosen: number | "";
  hadMatch: boolean;
  error?: string;
}

export function TicketImport() {
  const { reload, toast } = useApp();
  const [queue, setQueue] = useState<QItem[]>([]);
  const [pending, setPending] = useState<PendingReceipt[]>([]);
  const [busy, setBusy] = useState(false);
  const [match, setMatch] = useState<{ pid: number; options: MatchTx[]; chosen: number | "" } | null>(null);

  const refreshPending = useCallback(async () => setPending(await listPending()), []);
  useEffect(() => { void refreshPending(); }, [refreshPending]);

  async function buildItem(path: string): Promise<QItem> {
    try {
      const lines = await invoke<string[]>("ocr_image", { path });
      const parsed = parseReceipt(lines);
      const text = lines.join("\n");
      const items: TicketItem[] = await Promise.all(
        parsed.items.map(async (it) => ({
          description: it.description,
          amount: it.amount,
          category_id: await suggestItemCategory(it.description),
        })),
      );
      const windowTxs = await matchCandidates(parsed.date);
      const cands = matchTicket({ date: parsed.date, total: parsed.total, text }, windowTxs);
      const options = cands.length ? cands.map((c) => c.tx) : windowTxs;
      return {
        path, date: parsed.date, total: parsed.total, text, items, options,
        chosen: options[0]?.id ?? "", hadMatch: cands.length > 0,
      };
    } catch (e) {
      return {
        path, date: null, total: null, text: "", items: [], options: [], chosen: "",
        hadMatch: false, error: typeof e === "string" ? e : "No se pudo leer el ticket",
      };
    }
  }

  async function importTickets() {
    const sel = await open({
      multiple: true,
      filters: [{ name: "Tickets", extensions: ["jpg", "jpeg", "png", "webp", "bmp"] }],
    });
    if (!sel) return;
    const paths = Array.isArray(sel) ? sel : [sel];
    setBusy(true);
    const built: QItem[] = [];
    for (const p of paths) built.push(await buildItem(p));
    setQueue((q) => [...q, ...built]);
    setBusy(false);
  }

  function updateChosen(i: number, id: number | "") {
    setQueue((q) => q.map((it, idx) => (idx === i ? { ...it, chosen: id } : it)));
  }
  function removeFromQueue(i: number) {
    setQueue((q) => q.filter((_, idx) => idx !== i));
  }

  async function assign(i: number) {
    const it = queue[i];
    if (it.chosen === "") return;
    await attachTicketToTransaction(Number(it.chosen), it.path, it.items);
    removeFromQueue(i);
    reload();
    toast("Ticket asignado al movimiento");
  }
  async function pend(i: number) {
    const it = queue[i];
    await addPending({ path: it.path, date: it.date, total: it.total, text: it.text, items: it.items });
    removeFromQueue(i);
    await refreshPending();
    toast("Ticket dejado en espera");
  }

  async function startMatch(p: PendingReceipt) {
    const windowTxs = await matchCandidates(p.ticket_date);
    const cands = matchTicket({ date: p.ticket_date, total: p.total, text: p.text ?? "" }, windowTxs);
    const options = cands.length ? cands.map((c) => c.tx) : windowTxs;
    setMatch({ pid: p.id, options, chosen: options[0]?.id ?? "" });
  }
  async function confirmMatch(p: PendingReceipt) {
    if (!match || match.chosen === "") return;
    await attachTicketToTransaction(Number(match.chosen), p.path, parseItemsJson(p.items_json));
    await deletePending(p.id);
    setMatch(null);
    await refreshPending();
    reload();
    toast("Ticket emparejado");
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Importa fotos de tickets; se leen con el OCR y se buscan los movimientos que coinciden
          por importe y fecha. Confirma cada uno, elígelo a mano o déjalo en espera.
        </p>
        <span className="spacer" />
        <button className="primary" onClick={() => void importTickets()} disabled={busy}>
          {busy ? "Leyendo…" : "📥 Importar tickets"}
        </button>
      </div>

      {/* Cola de revisión */}
      {queue.map((it, i) => (
        <div className="card" key={`${it.path}-${i}`} style={{ marginBottom: 10 }}>
          <div className="row">
            <b>{fileName(it.path)}</b>
            <span className="muted" style={{ fontSize: 12 }}>
              {it.date ? formatDate(it.date) : "sin fecha"} · {it.total != null ? formatEUR(-it.total) : "total ?"}
            </span>
            <span className="spacer" />
            <button className="link-btn" onClick={() => removeFromQueue(i)}>Descartar</button>
          </div>

          {it.error ? (
            <span className="amount neg" style={{ fontSize: 13 }}>{it.error}</span>
          ) : it.options.length ? (
            <>
              <div className="muted" style={{ fontSize: 12, margin: "4px 0" }}>
                {it.hadMatch ? "¿Es este movimiento?" : "Sin coincidencia automática — elige el movimiento:"}
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <select
                  value={String(it.chosen)}
                  onChange={(e) => updateChosen(i, e.target.value ? Number(e.target.value) : "")}
                  style={{ flex: 1, minWidth: 260 }}
                >
                  {it.options.map((tx) => <option key={tx.id} value={tx.id}>{txLabel(tx)}</option>)}
                </select>
                <button className="primary" onClick={() => void assign(i)} disabled={it.chosen === ""}>Asignar</button>
                <button onClick={() => void pend(i)}>En espera</button>
              </div>
            </>
          ) : (
            <div className="row" style={{ gap: 8, marginTop: 4 }}>
              <span className="muted" style={{ fontSize: 13 }}>Sin movimientos candidatos (¿aún no importados?).</span>
              <span className="spacer" />
              <button onClick={() => void pend(i)}>Dejar en espera</button>
            </div>
          )}
        </div>
      ))}

      {/* Cola en espera */}
      <div className="card" style={{ marginTop: 8 }}>
        <h3>En espera ({pending.length})</h3>
        {pending.length === 0 && <span className="muted">No hay tickets en espera.</span>}
        {pending.map((p) => (
          <div key={p.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 8 }}>
            <div className="row">
              <span><b>{fileName(p.path)}</b> <span className="muted" style={{ fontSize: 12 }}>· {p.ticket_date ? formatDate(p.ticket_date) : "sin fecha"} · {p.total != null ? formatEUR(-p.total) : "?"}</span></span>
              <span className="spacer" />
              {match?.pid !== p.id && <button className="link-btn" onClick={() => void startMatch(p)}>Emparejar</button>}
              <button className="link-btn" style={{ color: "var(--bad)" }} onClick={async () => { await deletePending(p.id); await refreshPending(); }}>Quitar</button>
            </div>
            {match?.pid === p.id && (
              <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                {match.options.length ? (
                  <>
                    <select value={String(match.chosen)} onChange={(e) => setMatch({ ...match, chosen: e.target.value ? Number(e.target.value) : "" })} style={{ flex: 1, minWidth: 260 }}>
                      {match.options.map((tx) => <option key={tx.id} value={tx.id}>{txLabel(tx)}</option>)}
                    </select>
                    <button className="primary" onClick={() => void confirmMatch(p)} disabled={match.chosen === ""}>Asignar</button>
                  </>
                ) : (
                  <span className="muted" style={{ fontSize: 13 }}>Sigue sin haber candidatos.</span>
                )}
                <button onClick={() => setMatch(null)}>Cancelar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
