import { useEffect, useMemo, useState } from "react";
import { useApp } from "../state/AppContext";
import { listSplits, setSplits, clearSplits } from "../data/splits";
import { formatEUR } from "../lib/format";
import type { Transaction } from "../types";

interface Part {
  category_id: number;
  amount: string;
}

export function SplitEditor({
  tx,
  onClose,
  onSaved,
}: {
  tx: Transaction;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { categories, toast } = useApp();
  const target = +Math.abs(tx.importe).toFixed(2);
  const [parts, setParts] = useState<Part[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const existing = await listSplits(tx.id);
      if (existing.length) {
        setParts(existing.map((s) => ({ category_id: s.category_id, amount: String(s.amount) })));
      } else {
        const first = tx.category_id ?? categories[0]?.id ?? 0;
        const second = categories.find((c) => c.id !== first)?.id ?? categories[0]?.id ?? 0;
        setParts([
          { category_id: first, amount: target.toFixed(2) },
          { category_id: second, amount: "0" },
        ]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.id]);

  const sum = useMemo(
    () => parts.reduce((a, p) => a + (parseFloat(p.amount) || 0), 0),
    [parts],
  );
  const remaining = +(target - sum).toFixed(2);
  const valid =
    parts.length >= 2 &&
    Math.abs(remaining) < 0.01 &&
    parts.every((p) => p.category_id && (parseFloat(p.amount) || 0) > 0);

  function update(i: number, patch: Partial<Part>) {
    setParts((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function add() {
    setParts((ps) => [
      ...ps,
      { category_id: categories[0]?.id ?? 0, amount: Math.max(remaining, 0).toFixed(2) },
    ]);
  }
  function remove(i: number) {
    setParts((ps) => ps.filter((_, idx) => idx !== i));
  }

  async function save() {
    setBusy(true);
    await setSplits(
      tx.id,
      parts.map((p) => ({ category_id: p.category_id, amount: parseFloat(p.amount) || 0 })),
    );
    setBusy(false);
    toast("Movimiento dividido");
    onSaved();
    onClose();
  }
  async function unsplit() {
    setBusy(true);
    await clearSplits(tx.id);
    setBusy(false);
    toast("División quitada");
    onSaved();
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Dividir movimiento</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          {tx.merchant ?? tx.concepto} · <b style={{ color: "var(--text)" }}>{formatEUR(target)}</b>
        </p>

        {parts.map((p, i) => (
          <div className="row" key={i} style={{ gap: 8, marginBottom: 8 }}>
            <select
              value={p.category_id}
              onChange={(e) => update(i, { category_id: Number(e.target.value) })}
              style={{ minWidth: 200, flex: 1 }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              value={p.amount}
              onChange={(e) => update(i, { amount: e.target.value })}
              style={{ width: 110 }}
            />
            <button
              className="link-btn"
              style={{ color: "var(--bad)" }}
              onClick={() => remove(i)}
              disabled={parts.length <= 1}
              title="Quitar parte"
            >
              ✕
            </button>
          </div>
        ))}

        <div className="row" style={{ gap: 8, marginTop: 4 }}>
          <button onClick={add}>+ Añadir parte</button>
          <span className="spacer" />
          <span className={Math.abs(remaining) < 0.01 ? "muted" : "amount neg"}>
            Resto: {formatEUR(remaining)}
          </span>
        </div>

        <div className="row" style={{ gap: 8, marginTop: 16 }}>
          {tx.split_count > 0 && (
            <button onClick={() => void unsplit()} disabled={busy}>Quitar división</button>
          )}
          <span className="spacer" />
          <button onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="primary" disabled={!valid || busy} onClick={() => void save()}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
