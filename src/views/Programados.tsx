import { useCallback, useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import { listScheduled, createScheduled, updateScheduled, deleteScheduled, markPaid, type ScheduledRow } from "../data/scheduled";
import { FREQ_LABEL, daysUntil } from "../lib/schedule";
import { formatEUR, formatDate } from "../lib/format";
import type { Frequency } from "../types";

const today = () => new Date().toISOString().slice(0, 10);

function whenLabel(iso: string): { text: string; cls: string } {
  const d = daysUntil(iso);
  if (d < 0) return { text: `vencido hace ${-d} d`, cls: "amount neg" };
  if (d === 0) return { text: "hoy", cls: "amount neg" };
  if (d === 1) return { text: "mañana", cls: "" };
  return { text: `en ${d} días`, cls: "" };
}

export function Programados() {
  const { version, reload, toast } = useApp();
  const [rows, setRows] = useState<ScheduledRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => setRows(await listScheduled()), []);
  useEffect(() => { void load(); }, [load, version]);

  async function refresh() {
    await load();
    reload();
  }

  return (
    <div>
      <div className="topbar">
        <h1>Programados</h1>
        <button onClick={() => { setAdding(true); setEditing(null); }}>+ Nuevo pago</button>
      </div>
      <p className="muted" style={{ marginTop: -8, maxWidth: 680 }}>
        Pagos recurrentes previstos. «Pagado» avanza la próxima fecha según la frecuencia.
      </p>

      {adding && (
        <div className="card" style={{ marginBottom: 16 }}>
          <ScheduledForm onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); void refresh(); }} />
        </div>
      )}

      {rows.length === 0 && !adding && (
        <div className="card"><span className="muted">No hay pagos programados.</span></div>
      )}

      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Concepto</th><th>Categoría</th><th>Frecuencia</th><th>Próximo</th>
                <th className="right">Importe</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) =>
                editing === s.id ? (
                  <tr key={s.id}>
                    <td colSpan={6} style={{ background: "var(--bg-soft)" }}>
                      <ScheduledForm row={s} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh(); }} />
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id}>
                    <td><b>{s.name}</b></td>
                    <td className="muted">{s.category_icon ?? ""} {s.category_name ?? "—"}</td>
                    <td className="muted">{FREQ_LABEL[s.frequency]}</td>
                    <td>
                      {formatDate(s.next_date)}{" "}
                      <span className={whenLabel(s.next_date).cls} style={{ fontSize: 12 }}>· {whenLabel(s.next_date).text}</span>
                    </td>
                    <td className="right amount neg">{formatEUR(s.amount)}</td>
                    <td className="right">
                      <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                        <button className="link-btn" onClick={async () => { await markPaid(s.id); toast(`«${s.name}» marcado como pagado`); await refresh(); }} title="Marcar pagado y avanzar fecha">Pagado</button>
                        <button className="link-btn" onClick={() => setEditing(s.id)}>Editar</button>
                        <button className="link-btn" style={{ color: "var(--bad)" }} onClick={async () => { if (confirm(`¿Borrar "${s.name}"?`)) { await deleteScheduled(s.id); await refresh(); } }}>Borrar</button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ScheduledForm({ row, onCancel, onSaved }: { row?: ScheduledRow; onCancel: () => void; onSaved: () => void }) {
  const { categories } = useApp();
  const [name, setName] = useState(row?.name ?? "");
  const [amount, setAmount] = useState(row ? String(row.amount) : "");
  const [categoryId, setCategoryId] = useState<number | "">(row?.category_id ?? "");
  const [freq, setFreq] = useState<Frequency>(row?.frequency ?? "mensual");
  const [date, setDate] = useState(row?.next_date ?? today());
  const [busy, setBusy] = useState(false);

  const canSave = name.trim().length > 0 && (parseFloat(amount) || 0) > 0 && !busy;

  async function save() {
    setBusy(true);
    const payload = {
      name,
      amount: parseFloat(amount) || 0,
      category_id: categoryId === "" ? null : Number(categoryId),
      frequency: freq,
      next_date: date,
    };
    if (row) await updateScheduled(row.id, payload);
    else await createScheduled(payload);
    setBusy(false);
    onSaved();
  }

  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap", padding: "4px 0" }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Concepto (p. ej. Netflix)" style={{ minWidth: 180 }} autoFocus />
      <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Importe" style={{ width: 110 }} />
      <select value={String(categoryId)} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}>
        <option value="">Sin categoría</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
      </select>
      <select value={freq} onChange={(e) => setFreq(e.target.value as Frequency)}>
        <option value="mensual">Mensual</option>
        <option value="semanal">Semanal</option>
        <option value="anual">Anual</option>
      </select>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <span className="spacer" />
      <button onClick={onCancel} disabled={busy}>Cancelar</button>
      <button className="primary" disabled={!canSave} onClick={() => void save()}>Guardar</button>
    </div>
  );
}
