import { useEffect, useMemo, useState } from "react";
import { useApp } from "../state/AppContext";
import { MonthSelect } from "../components/Controls";
import { distinctMonths } from "../data/transactions";
import { spendByCategory } from "../data/stats";
import { setBudget, deleteBudget, budgetCarryovers } from "../data/budgets";
import { getBudgetRollover, setBudgetRollover } from "../data/settings";
import { query } from "../db/database";
import { formatEUR } from "../lib/format";

export function Presupuestos() {
  const { categories, version, reload } = useApp();
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState("");
  const [spent, setSpent] = useState<Map<string, number>>(new Map());
  const [budgets, setBudgets] = useState<Map<number, number>>(new Map());
  const [carryovers, setCarryovers] = useState<Map<number, number>>(new Map());
  const [rollover, setRollover] = useState(false);

  const expenseCats = useMemo(() => categories.filter((c) => c.kind === "gasto"), [categories]);

  useEffect(() => {
    void distinctMonths().then((ms) => {
      setMonths(ms);
      setMonth((cur) => cur || ms[0] || "");
    });
    void getBudgetRollover().then(setRollover);
  }, [version]);

  useEffect(() => {
    if (!month) return;
    let cancelled = false;
    (async () => {
      const [slices, brows, carry] = await Promise.all([
        spendByCategory({ month }),
        query<{ category_id: number; amount: number }>("SELECT category_id, amount FROM budgets"),
        budgetCarryovers(month),
      ]);
      if (cancelled) return;
      setSpent(new Map(slices.map((s) => [s.name, s.value])));
      setBudgets(new Map(brows.map((b) => [b.category_id, b.amount])));
      setCarryovers(carry);
    })();
    return () => {
      cancelled = true;
    };
  }, [month, version, rollover]);

  async function toggleRollover(v: boolean) {
    setRollover(v);
    await setBudgetRollover(v);
    reload();
  }

  async function save(catId: number, raw: string) {
    const amount = Number(raw.replace(",", "."));
    if (!raw || Number.isNaN(amount) || amount <= 0) {
      await deleteBudget(catId);
    } else {
      await setBudget(catId, amount);
    }
    reload();
  }

  const totalBudget = [...budgets.values()].reduce((s, v) => s + v, 0);
  const totalSpent = expenseCats.reduce((s, c) => s + (spent.get(c.name) ?? 0), 0);

  return (
    <div>
      <div className="topbar">
        <h1>Presupuestos</h1>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <label className="row" style={{ gap: 6, cursor: "pointer", fontSize: 13 }} title="Lo no gastado se acumula al mes siguiente (y el sobregasto resta)">
            <input type="checkbox" checked={rollover} onChange={(e) => void toggleRollover(e.target.checked)} style={{ width: 16, height: 16 }} />
            Acumular saldo (rollover)
          </label>
          <MonthSelect months={months} value={month} onChange={setMonth} />
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="label">Presupuesto total</div><div className="value">{formatEUR(totalBudget)}</div></div>
        <div className="kpi"><div className="label">Gasto real del mes</div><div className="value bad">{formatEUR(totalSpent)}</div></div>
        <div className="kpi"><div className="label">Diferencia</div><div className={`value ${totalBudget - totalSpent >= 0 ? "good" : "bad"}`}>{formatEUR(totalBudget - totalSpent)}</div></div>
      </div>

      <div className="card">
        <h3>Límite mensual por categoría</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {expenseCats.map((c) => {
            const sp = spent.get(c.name) ?? 0;
            const bud = budgets.get(c.id) ?? 0;
            const carry = rollover ? carryovers.get(c.id) ?? 0 : 0;
            const available = bud + carry;
            const pct = available > 0 ? Math.min((sp / available) * 100, 100) : 0;
            const over = available > 0 && sp > available;
            return (
              <div key={c.id} className="row" style={{ gap: 14 }}>
                <span style={{ width: 200 }}>{c.icon} {c.name}</span>
                <div style={{ flex: 1 }}>
                  <div className="bar">
                    <span style={{ width: `${pct}%`, background: over ? "var(--bad)" : c.color }} />
                  </div>
                  {rollover && bud > 0 && carry !== 0 && (
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                      límite {formatEUR(bud)} {carry >= 0 ? "+" : "−"} acumulado {formatEUR(Math.abs(carry))} = <b style={{ color: "var(--text)" }}>{formatEUR(available)}</b>
                    </div>
                  )}
                </div>
                <span className="muted" style={{ width: 90, textAlign: "right" }}>{formatEUR(sp)}</span>
                <span className="muted">/</span>
                <input
                  style={{ width: 100 }}
                  defaultValue={bud > 0 ? String(bud) : ""}
                  placeholder="—"
                  title={rollover && bud > 0 ? `Disponible este mes: ${formatEUR(available)}` : "Límite mensual"}
                  onBlur={(e) => save(c.id, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
