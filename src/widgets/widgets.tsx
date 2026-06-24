import { useEffect, useMemo, useState, type FC } from "react";
import { NivoDonut, NivoFlows, NivoBalance, NivoCash } from "../components/charts/nivo";
import { formatEUR, monthKey } from "../lib/format";
import { kpis, spendByCategoryId, monthlyFlows, accountBalanceSeries, netWorthSeries, netWorthNow, cashByMonth, detectSubscriptions } from "../data/stats";
import { listBudgets, type BudgetRow } from "../data/budgets";
import { listGoals } from "../data/goals";
import { goalPercent } from "../lib/goals";
import { listScheduled, type ScheduledRow } from "../data/scheduled";
import { topReceiptItems, type ItemAggregate } from "../data/receipts";
import { daysUntil } from "../lib/schedule";
import { donutSlices } from "../lib/donut";
import { useApp } from "../state/AppContext";
import type { Goal, TxFilters } from "../types";
import type { MonthlyFlow, BalancePoint, CashPoint, Subscription, KpiSummary, NetWorthNow } from "../data/stats";

export interface WidgetProps {
  accountId: number | "all";
  excludeInternal: boolean;
  from: string;
  to: string;
  version: number;
}

/** Filtro acotado al rango de fechas seleccionado en el dashboard. */
function scope(p: WidgetProps): TxFilters {
  return {
    accountId: p.accountId,
    from: p.from,
    to: p.to,
    excludeInternal: p.excludeInternal,
  };
}

const KpiBody: FC<WidgetProps> = (p) => {
  const [k, setK] = useState<KpiSummary | null>(null);
  useEffect(() => {
    void kpis(scope(p)).then(setK);
  }, [p.accountId, p.from, p.to, p.excludeInternal, p.version]);
  if (!k) return <span className="muted">…</span>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Kpi label="Ingresos" value={k.income} cls="good" />
      <Kpi label="Gastos" value={k.expense} cls="bad" />
      <Kpi label="Ahorro" value={k.net} cls={k.net >= 0 ? "good" : "bad"} />
      <div className="kpi" style={{ padding: 0, border: "none", background: "transparent" }}>
        <div className="label">Tasa de ahorro</div>
        <div className={`value ${k.savingsRate >= 0 ? "good" : "bad"}`}>{k.savingsRate.toFixed(0)}%</div>
      </div>
    </div>
  );
};

function Kpi({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="kpi" style={{ padding: 0, border: "none", background: "transparent" }}>
      <div className="label">{label}</div>
      <div className={`value ${cls}`} style={{ fontSize: 22 }}>{formatEUR(value)}</div>
    </div>
  );
}

const CategoryDonutBody: FC<WidgetProps> = (p) => {
  const { categories } = useApp();
  const [valueById, setValueById] = useState<Map<number, number>>(new Map());
  // Pila de drill-down: ids de categorías padre por las que se ha ido entrando.
  const [stack, setStack] = useState<number[]>([]);

  useEffect(() => {
    void spendByCategoryId(scope(p)).then((rows) => {
      setValueById(new Map(rows.map((r) => [r.id, r.value])));
      setStack([]); // al cambiar filtros/datos, vuelve a la vista de padres
    });
  }, [p.accountId, p.from, p.to, p.excludeInternal, p.version]);

  const parentId = stack.length ? stack[stack.length - 1] : null;
  const slices = useMemo(
    () => donutSlices(categories, valueById, parentId),
    [categories, valueById, parentId],
  );
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  if (valueById.size === 0)
    return <span className="muted">Sin gastos en el periodo seleccionado.</span>;

  const onSlice = (id: number) => setStack((s) => [...s, id]);

  const centerLabel = parentId != null ? byId.get(parentId)?.name : undefined;

  return (
    <div className="widget" style={{ gap: 6 }}>
      <div className="row" style={{ fontSize: 12, minHeight: 20, flexWrap: "wrap" }}>
        {stack.length === 0 ? (
          <span className="muted">Clic en una categoría para ver sus subcategorías</span>
        ) : (
          <>
            <button className="link-btn" onClick={() => setStack([])}>Todas</button>
            {stack.map((id, i) => (
              <span key={id}>
                <span className="muted"> › </span>
                <button className="link-btn" onClick={() => setStack(stack.slice(0, i + 1))}>
                  {byId.get(id)?.name ?? "?"}
                </button>
              </span>
            ))}
            <span className="spacer" />
            <button className="link-btn" onClick={() => setStack((s) => s.slice(0, -1))}>← Volver</button>
          </>
        )}
      </div>
      <div className="widget-body">
        <NivoDonut slices={slices} centerLabel={centerLabel} onSlice={onSlice} />
      </div>
    </div>
  );
};

const NetWorthBody: FC<WidgetProps> = (p) => {
  const [nw, setNw] = useState<NetWorthNow | null>(null);
  useEffect(() => {
    void netWorthNow().then(setNw);
  }, [p.version]);
  if (!nw) return <span className="muted">…</span>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Kpi label="Activos" value={nw.assets} cls="good" />
      <Kpi label="Pasivos" value={nw.liabilities} cls="bad" />
      <div className="kpi" style={{ gridColumn: "1 / -1", padding: 0, border: "none", background: "transparent" }}>
        <div className="label">Patrimonio neto</div>
        <div className={`value ${nw.net >= 0 ? "good" : "bad"}`}>{formatEUR(nw.net)}</div>
      </div>
    </div>
  );
};

const MonthlyBarsBody: FC<WidgetProps> = (p) => {
  const [data, setData] = useState<MonthlyFlow[]>([]);
  useEffect(() => {
    void monthlyFlows(scope(p)).then(setData);
  }, [p.accountId, p.from, p.to, p.excludeInternal, p.version]);
  if (data.length === 0) return <span className="muted">Sin datos.</span>;
  return <NivoFlows rows={data} />;
};

const BalanceLineBody: FC<WidgetProps> = (p) => {
  const [data, setData] = useState<BalancePoint[]>([]);
  useEffect(() => {
    if (p.accountId === "all") void netWorthSeries().then(setData);
    else void accountBalanceSeries(p.accountId).then(setData);
  }, [p.accountId, p.version]);
  if (data.length === 0) return <span className="muted">Sin datos.</span>;
  const name = p.accountId === "all" ? "Patrimonio neto" : "Saldo";
  return <NivoBalance points={data} name={name} />;
};

const CashBody: FC<WidgetProps> = (p) => {
  const [data, setData] = useState<CashPoint[]>([]);
  useEffect(() => {
    void cashByMonth(scope(p)).then(setData);
  }, [p.accountId, p.from, p.to, p.excludeInternal, p.version]);
  if (data.length === 0) return <span className="muted">Sin disposiciones de efectivo.</span>;
  const total = data.reduce((s, r) => s + r.total, 0);
  return (
    <div className="widget" style={{ gap: 6 }}>
      <div className="muted">Total retirado: <b style={{ color: "var(--text)" }}>{formatEUR(total)}</b></div>
      <div className="widget-body"><NivoCash rows={data} /></div>
    </div>
  );
};

const BudgetsBody: FC<WidgetProps> = (p) => {
  const [rows, setRows] = useState<BudgetRow[]>([]);
  // Los presupuestos son mensuales: se muestran los del mes de la fecha «hasta».
  const month = monthKey(p.to || "");
  useEffect(() => {
    if (month) void listBudgets(month).then(setRows);
  }, [month, p.version]);
  if (rows.length === 0)
    return <span className="muted">Define presupuestos en la pestaña «Presupuestos».</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
      {rows.map((b) => {
        const pct = b.available > 0 ? Math.min((b.spent / b.available) * 100, 100) : 0;
        const over = b.spent > b.available;
        return (
          <div key={b.category_id}>
            <div className="row" style={{ fontSize: 13 }}>
              <span>{b.icon} {b.category_name}</span>
              <span className="spacer" />
              <span className={over ? "amount neg" : "muted"}>
                {formatEUR(b.spent)} / {formatEUR(b.available)}
              </span>
            </div>
            <div className="bar">
              <span style={{ width: `${pct}%`, background: over ? "var(--bad)" : b.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SubscriptionsBody: FC<WidgetProps> = (p) => {
  const [rows, setRows] = useState<Subscription[]>([]);
  useEffect(() => {
    void detectSubscriptions().then(setRows);
  }, [p.version]);
  if (rows.length === 0) return <span className="muted">No se detectaron pagos recurrentes.</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
      {rows.slice(0, 12).map((s) => (
        <div className="row" key={s.merchant} style={{ fontSize: 13 }}>
          <span title={s.merchant} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
            {s.merchant}
          </span>
          <span className="spacer" />
          <span className="muted">{s.months} meses</span>
          <span style={{ width: 80, textAlign: "right" }}>{formatEUR(s.avg_amount)}</span>
        </div>
      ))}
    </div>
  );
};

const GoalsBody: FC<WidgetProps> = (p) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  useEffect(() => {
    void listGoals().then(setGoals);
  }, [p.version]);
  if (goals.length === 0)
    return <span className="muted">Define metas en la pestaña «Metas».</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
      {goals.map((g) => {
        const pct = goalPercent(g.current_amount, g.target_amount);
        const done = g.current_amount >= g.target_amount;
        return (
          <div key={g.id}>
            <div className="row" style={{ fontSize: 13 }}>
              <span>{g.icon} {g.name}</span>
              <span className="spacer" />
              <span className="muted">{formatEUR(g.current_amount)} / {formatEUR(g.target_amount)}</span>
            </div>
            <div className="bar">
              <span style={{ width: `${pct}%`, background: done ? "var(--good)" : g.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const UpcomingBody: FC<WidgetProps> = (p) => {
  const [rows, setRows] = useState<ScheduledRow[]>([]);
  useEffect(() => {
    void listScheduled().then(setRows);
  }, [p.version]);
  if (rows.length === 0)
    return <span className="muted">Programa pagos en la pestaña «Programados».</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
      {rows.slice(0, 12).map((s) => {
        const d = daysUntil(s.next_date);
        const overdue = d < 0;
        return (
          <div className="row" key={s.id} style={{ fontSize: 13 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
              {s.category_icon ?? "📅"} {s.name}
            </span>
            <span className="spacer" />
            <span className={overdue ? "amount neg" : "muted"} style={{ fontSize: 12 }}>
              {overdue ? `−${-d}d` : `${d}d`}
            </span>
            <span style={{ width: 80, textAlign: "right" }}>{formatEUR(s.amount)}</span>
          </div>
        );
      })}
    </div>
  );
};

const ReceiptItemsBody: FC<WidgetProps> = (p) => {
  const [rows, setRows] = useState<ItemAggregate[]>([]);
  useEffect(() => {
    void topReceiptItems(12).then(setRows);
  }, [p.version]);
  if (rows.length === 0)
    return <span className="muted">Desglosa recibos (📎 en Movimientos) para ver en qué se va el dinero.</span>;
  const max = rows[0]?.total || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
      {rows.map((r) => (
        <div key={r.description}>
          <div className="row" style={{ fontSize: 13 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{r.description}</span>
            <span className="spacer" />
            <span className="muted">{formatEUR(r.total)}{r.n > 1 ? ` · ${r.n}×` : ""}</span>
          </div>
          <div className="bar">
            <span style={{ width: `${(r.total / max) * 100}%`, background: "var(--accent)" }} />
          </div>
        </div>
      ))}
    </div>
  );
};

export interface WidgetDef {
  key: string;
  title: string;
  w: number;
  h: number;
  Body: FC<WidgetProps>;
}

export const WIDGETS: WidgetDef[] = [
  { key: "donut", title: "Gasto por categoría", w: 8, h: 10, Body: CategoryDonutBody },
  { key: "kpis", title: "Resumen del periodo", w: 4, h: 4, Body: KpiBody },
  { key: "networth", title: "Patrimonio neto", w: 4, h: 4, Body: NetWorthBody },
  { key: "bars", title: "Gastos vs ingresos por mes", w: 8, h: 8, Body: MonthlyBarsBody },
  { key: "balance", title: "Evolución de saldo / patrimonio", w: 8, h: 8, Body: BalanceLineBody },
  { key: "budgets", title: "Presupuestos del mes", w: 4, h: 8, Body: BudgetsBody },
  { key: "goals", title: "Metas de ahorro", w: 4, h: 7, Body: GoalsBody },
  { key: "upcoming", title: "Próximos pagos", w: 4, h: 7, Body: UpcomingBody },
  { key: "items", title: "En qué se gasta (recibos)", w: 4, h: 7, Body: ReceiptItemsBody },
  { key: "cash", title: "Efectivo en cajero", w: 6, h: 7, Body: CashBody },
  { key: "subs", title: "Pagos recurrentes", w: 6, h: 7, Body: SubscriptionsBody },
];
