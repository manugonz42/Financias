import { useCallback, useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import { IconPicker } from "../components/IconPicker";
import { listGoals, createGoal, updateGoal, deleteGoal, addContribution } from "../data/goals";
import { goalPercent, monthlyTarget } from "../lib/goals";
import { formatEUR, formatDate } from "../lib/format";
import type { Goal } from "../types";

export function Metas() {
  const { version, reload } = useApp();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => setGoals(await listGoals()), []);
  useEffect(() => { void load(); }, [load, version]);

  async function refresh() {
    await load();
    reload();
  }

  return (
    <div>
      <div className="topbar">
        <h1>Metas</h1>
        <button onClick={() => { setAdding(true); setEditing(null); }}>+ Nueva meta</button>
      </div>

      {adding && (
        <div className="card" style={{ marginBottom: 16 }}>
          <GoalForm onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); void refresh(); }} />
        </div>
      )}

      {goals.length === 0 && !adding && (
        <div className="card"><span className="muted">Aún no hay metas. Crea una para empezar a ahorrar con un objetivo.</span></div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {goals.map((g) =>
          editing === g.id ? (
            <div className="card" key={g.id}>
              <GoalForm goal={g} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh(); }} />
            </div>
          ) : (
            <GoalCard key={g.id} goal={g} onEdit={() => setEditing(g.id)} onChanged={refresh} />
          ),
        )}
      </div>
    </div>
  );
}

function GoalCard({ goal, onEdit, onChanged }: { goal: Goal; onEdit: () => void; onChanged: () => Promise<void> }) {
  const [contrib, setContrib] = useState("");
  const pct = goalPercent(goal.current_amount, goal.target_amount);
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  const done = remaining <= 0;
  const pace = monthlyTarget(remaining, goal.target_date);
  const datePassed = goal.target_date != null && !done && pace == null;

  async function aportar(sign: 1 | -1) {
    const v = parseFloat(contrib);
    if (Number.isNaN(v) || v <= 0) return;
    await addContribution(goal.id, sign * v);
    setContrib("");
    await onChanged();
  }

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{goal.icon}</span>
        <b>{goal.name}</b>
        <span className="spacer" />
        <button className="link-btn" onClick={onEdit}>Editar</button>
        <button
          className="link-btn"
          style={{ color: "var(--bad)" }}
          onClick={async () => { if (confirm(`¿Borrar la meta "${goal.name}"?`)) { await deleteGoal(goal.id); await onChanged(); } }}
        >
          Borrar
        </button>
      </div>

      <div className="row" style={{ fontSize: 13 }}>
        <span className={done ? "amount pos" : ""}>{formatEUR(goal.current_amount)}</span>
        <span className="muted"> / {formatEUR(goal.target_amount)}</span>
        <span className="spacer" />
        <span className="muted">{pct.toFixed(0)}%</span>
      </div>
      <div className="bar" style={{ marginBottom: 8 }}>
        <span style={{ width: `${pct}%`, background: done ? "var(--good)" : goal.color }} />
      </div>

      <div className="muted" style={{ fontSize: 12, minHeight: 18 }}>
        {done ? (
          <span className="amount pos">🎉 ¡Meta conseguida!</span>
        ) : pace != null ? (
          <>Faltan <b style={{ color: "var(--text)" }}>{formatEUR(remaining)}</b> · ahorra <b style={{ color: "var(--text)" }}>{formatEUR(pace)}</b>/mes hasta {formatDate(goal.target_date!)}</>
        ) : datePassed ? (
          <span className="amount neg">Fecha objetivo superada · faltan {formatEUR(remaining)}</span>
        ) : (
          <>Faltan <b style={{ color: "var(--text)" }}>{formatEUR(remaining)}</b></>
        )}
      </div>

      {!done && (
        <div className="row" style={{ gap: 6, marginTop: 10 }}>
          <input
            type="number"
            step="0.01"
            value={contrib}
            onChange={(e) => setContrib(e.target.value)}
            placeholder="Aportar…"
            style={{ width: 110 }}
          />
          <button className="primary" onClick={() => void aportar(1)} disabled={contrib === ""}>+ Aportar</button>
          <button onClick={() => void aportar(-1)} disabled={contrib === ""} title="Retirar">−</button>
        </div>
      )}
    </div>
  );
}

function GoalForm({ goal, onCancel, onSaved }: { goal?: Goal; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? String(goal.target_amount) : "");
  const [current, setCurrent] = useState(goal ? String(goal.current_amount) : "0");
  const [date, setDate] = useState(goal?.target_date ?? "");
  const [icon, setIcon] = useState(goal?.icon ?? "🎯");
  const [color, setColor] = useState(goal?.color ?? "#6366f1");
  const [busy, setBusy] = useState(false);

  const canSave = name.trim().length > 0 && (parseFloat(target) || 0) > 0 && !busy;

  async function save() {
    setBusy(true);
    const payload = {
      name,
      target_amount: parseFloat(target) || 0,
      current_amount: parseFloat(current) || 0,
      target_date: date || null,
      color,
      icon,
    };
    if (goal) await updateGoal(goal.id, payload);
    else await createGoal(payload);
    setBusy(false);
    onSaved();
  }

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <IconPicker value={icon} onChange={setIcon} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (p. ej. Vacaciones)" style={{ minWidth: 200, flex: 1 }} autoFocus />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 44, padding: 2 }} aria-label="Color" />
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <label className="row" style={{ gap: 6, fontSize: 13 }}>
          <span className="muted">Objetivo €</span>
          <input type="number" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} style={{ width: 110 }} />
        </label>
        <label className="row" style={{ gap: 6, fontSize: 13 }}>
          <span className="muted">Ahorrado €</span>
          <input type="number" step="0.01" value={current} onChange={(e) => setCurrent(e.target.value)} style={{ width: 110 }} />
        </label>
        <label className="row" style={{ gap: 6, fontSize: 13 }}>
          <span className="muted">Fecha objetivo</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <span className="spacer" />
        <button onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className="primary" disabled={!canSave} onClick={() => void save()}>Guardar</button>
      </div>
    </div>
  );
}
