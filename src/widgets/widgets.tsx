import { useEffect, useState, type FC } from "react";
import { EChart } from "../components/charts/EChart";
import { donutOption, barFlowsOption, lineOption, cashBarOption } from "../components/charts/options";
import { formatEUR, monthKey } from "../lib/format";
import { kpis, spendByCategory, monthlyFlows, balanceSeries, netWorthSeries, cashByMonth, detectSubscriptions } from "../data/stats";
import { listBudgets, type BudgetRow } from "../data/budgets";
import type { TxFilters } from "../types";
import type { CategorySlice, MonthlyFlow, BalancePoint, CashPoint, Subscription, KpiSummary } from "../data/stats";

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
  const [data, setData] = useState<CategorySlice[]>([]);
  useEffect(() => {
    void spendByCategory(scope(p)).then(setData);
  }, [p.accountId, p.from, p.to, p.excludeInternal, p.version]);
  if (data.length === 0) return <span className="muted">Sin gastos en el periodo seleccionado.</span>;
  return <EChart option={donutOption(data)} />;
};

const MonthlyBarsBody: FC<WidgetProps> = (p) => {
  const [data, setData] = useState<MonthlyFlow[]>([]);
  useEffect(() => {
    void monthlyFlows(scope(p)).then(setData);
  }, [p.accountId, p.from, p.to, p.excludeInternal, p.version]);
  if (data.length === 0) return <span className="muted">Sin datos.</span>;
  return <EChart option={barFlowsOption(data)} />;
};

const BalanceLineBody: FC<WidgetProps> = (p) => {
  const [data, setData] = useState<BalancePoint[]>([]);
  useEffect(() => {
    if (p.accountId === "all") void netWorthSeries().then(setData);
    else void balanceSeries(p.accountId).then(setData);
  }, [p.accountId, p.version]);
  if (data.length === 0) return <span className="muted">Sin datos.</span>;
  const name = p.accountId === "all" ? "Patrimonio neto" : "Saldo";
  return <EChart option={lineOption(data, name)} />;
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
      <div className="widget-body"><EChart option={cashBarOption(data)} /></div>
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
        const pct = b.amount > 0 ? Math.min((b.spent / b.amount) * 100, 100) : 0;
        const over = b.spent > b.amount;
        return (
          <div key={b.category_id}>
            <div className="row" style={{ fontSize: 13 }}>
              <span>{b.icon} {b.category_name}</span>
              <span className="spacer" />
              <span className={over ? "amount neg" : "muted"}>
                {formatEUR(b.spent)} / {formatEUR(b.amount)}
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

export interface WidgetDef {
  key: string;
  title: string;
  w: number;
  h: number;
  Body: FC<WidgetProps>;
}

export const WIDGETS: WidgetDef[] = [
  { key: "kpis", title: "Resumen del periodo", w: 4, h: 4, Body: KpiBody },
  { key: "donut", title: "Gasto por categoría", w: 4, h: 9, Body: CategoryDonutBody },
  { key: "bars", title: "Gastos vs ingresos por mes", w: 8, h: 8, Body: MonthlyBarsBody },
  { key: "balance", title: "Evolución de saldo / patrimonio", w: 8, h: 8, Body: BalanceLineBody },
  { key: "budgets", title: "Presupuestos del mes", w: 4, h: 8, Body: BudgetsBody },
  { key: "cash", title: "Efectivo en cajero", w: 6, h: 7, Body: CashBody },
  { key: "subs", title: "Pagos recurrentes", w: 6, h: 7, Body: SubscriptionsBody },
];
