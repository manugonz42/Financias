// Nueva tanda de widgets "pro" del dashboard: 8 gráficos rediseñados, cada uno
// con tres estilos conmutables (minimal | colorful | aurora) mediante un botón
// en la cabecera + el control global del AppContext. Construidos aparte de los
// widgets existentes; se registran en PRO_WIDGETS y el Dashboard los combina.

import { useEffect, useMemo, useState, type FC } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useApp } from "../state/AppContext";
import { useWidgetLook } from "./useWidgetLook";
import { widgetLookLabel, widgetLookGlyph, nextWidgetLook, flowColors, VIZ_PALETTE, type WidgetLook } from "../lib/widgetLook";
import { formatEUR, monthLabelShort, monthKey } from "../lib/format";
import {
  kpis,
  monthlyFlows,
  spendByCategoryId,
  cashByMonth,
  accountBalanceSeries,
  netWorthSeries,
  type KpiSummary,
} from "../data/stats";
import { getLiquidityHeatmap } from "../data/forecast";
import { categorySunburst, donutSlices } from "../lib/donut";
import { ProLineChart, ProBars, ProRankBars, ProSunburstChart, ProSparkline, type RankRow } from "../components/charts/nivo-pro";
import type { TxFilters } from "../types";
import type { WidgetProps, WidgetDef } from "./widgets";

/* ---------- helpers compartidos ---------- */

function scope(p: WidgetProps): TxFilters {
  return { accountId: p.accountId, from: p.from, to: p.to, excludeInternal: p.excludeInternal };
}

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Mes anterior a 'YYYY-MM'. */
function prevMonthKey(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Recta de tendencia (mínimos cuadrados) del mismo largo que la serie. */
function linTrend(ys: number[]): number[] {
  const n = ys.length;
  if (n < 2) return ys.slice();
  const xm = (n - 1) / 2;
  const ym = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xm) * (ys[i] - ym);
    den += (i - xm) ** 2;
  }
  const slope = den ? num / den : 0;
  const b = ym - slope * xm;
  return ys.map((_, i) => b + slope * i);
}

/** Botón de la cabecera que cicla el estilo del widget. */
function LookToggle({ look, onCycle }: { look: WidgetLook; onCycle: () => void }) {
  return (
    <Button variant="ghost" size="icon-xs" onClick={onCycle} title={`Estilo: ${widgetLookLabel(look)} — clic para cambiar`}>
      <span style={{ fontSize: 13, lineHeight: 1 }}>{widgetLookGlyph(look)}</span>
    </Button>
  );
}

/** Envoltorio común: columna con línea de contexto arriba y gráfico debajo. */
function Shell({ p, look, onCycle, note, children }: {
  p: WidgetProps;
  look: WidgetLook;
  onCycle: () => void;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 6 }}>
      {note != null && <div style={{ fontSize: 12, color: "var(--text-dim)", minHeight: 16 }}>{note}</div>}
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      {p.headerSlot && createPortal(<LookToggle look={look} onCycle={onCycle} />, p.headerSlot)}
    </div>
  );
}

const empty = (msg: string) => <span className="muted">{msg}</span>;

function useLook(p: WidgetProps) {
  const { look, setOverride } = useWidgetLook(p.widgetKey);
  return { look, cycle: () => setOverride(nextWidgetLook(look)) };
}

/* ============================================================= *
 *  1. Gasto con tendencia                                       *
 * ============================================================= */

const TrendBody: FC<WidgetProps> = (p) => {
  const { look, cycle } = useLook(p);
  const [rows, setRows] = useState<{ month: string; expense: number }[]>([]);
  useEffect(() => {
    let off = false;
    void monthlyFlows(scope(p)).then((d) => { if (!off) setRows(d.map((r) => ({ month: r.month, expense: r.expense }))); });
    return () => { off = true; };
  }, [p.accountId, p.from, p.to, p.excludeInternal, p.version]);

  if (rows.length < 2) return empty("Necesito al menos dos meses de gasto.");

  const expenses = rows.map((r) => r.expense);
  const trend = linTrend(expenses);
  const labels = rows.map((r) => monthLabelShort(r.month));
  const avg = expenses.reduce((s, v) => s + v, 0) / expenses.length;
  const rising = trend[trend.length - 1] >= trend[0];
  const grad: [string, string] = look === "aurora" ? ["#fb7185", "#f59e0b"] : ["#818cf8", "#22d3ee"];

  return (
    <Shell
      p={p}
      look={look}
      onCycle={cycle}
      note={<>Gasto medio <b style={{ color: "var(--text)" }}>{formatEUR(avg)}</b>/mes · tendencia {rising ? "al alza ▲" : "a la baja ▼"}</>}
    >
      <ProLineChart
        labels={labels}
        look={look}
        zeroBased
        gradient={grad}
        series={[
          { id: "Gasto", values: expenses, color: look === "colorful" ? VIZ_PALETTE[1] : undefined },
          { id: "Tendencia", values: trend, dashed: true, noArea: true, color: "var(--text-dim)" },
        ]}
      />
    </Shell>
  );
};

/* ============================================================= *
 *  2. Liquidez diaria                                           *
 * ============================================================= */

const LiquidityBody: FC<WidgetProps> = (p) => {
  const { look, cycle } = useLook(p);
  const [days, setDays] = useState<{ date: string; balance: number }[]>([]);
  useEffect(() => {
    let off = false;
    void getLiquidityHeatmap(scope(p), 60).then((d) => { if (!off) setDays(d.map((x) => ({ date: x.date, balance: x.balance }))); });
    return () => { off = true; };
  }, [p.accountId, p.from, p.to, p.excludeInternal, p.version]);

  if (days.length < 2) return empty("Sin datos de liquidez.");

  const values = days.map((d) => d.balance);
  const labels = days.map((d) => `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`);
  const min = Math.min(...values);
  const grad: [string, string] = ["#2dd4bf", "#22d3ee"];

  return (
    <Shell
      p={p}
      look={look}
      onCycle={cycle}
      note={<>Proyección a 60 días · saldo mínimo <b style={{ color: min < 0 ? "var(--bad)" : "var(--text)" }}>{formatEUR(min)}</b></>}
    >
      <ProLineChart
        labels={labels}
        look={look}
        gradient={grad}
        series={[{ id: "Saldo", values, color: look === "colorful" ? VIZ_PALETTE[9] : undefined }]}
      />
    </Shell>
  );
};

/* ============================================================= *
 *  3. Categorías (sunburst)                                     *
 * ============================================================= */

const SunburstBody: FC<WidgetProps> = (p) => {
  const { categories } = useApp();
  const { look, cycle } = useLook(p);
  const [valueById, setValueById] = useState<Map<number, number>>(new Map());
  useEffect(() => {
    let off = false;
    void spendByCategoryId(scope(p)).then((rows) => { if (!off) setValueById(new Map(rows.map((r) => [r.id, r.value]))); });
    return () => { off = true; };
  }, [p.accountId, p.from, p.to, p.excludeInternal, p.version]);

  const root = useMemo(() => categorySunburst(categories, valueById), [categories, valueById]);
  if (valueById.size === 0) return empty("Sin gastos en el periodo seleccionado.");
  const total = [...valueById.values()].reduce((s, v) => s + v, 0);

  return (
    <Shell p={p} look={look} onCycle={cycle} note={<>Gasto total <b style={{ color: "var(--text)" }}>{formatEUR(total)}</b> · clic para explorar</>}>
      <ProSunburstChart root={root} look={look} />
    </Shell>
  );
};

/* ============================================================= *
 *  4. Efectivo en cajero                                        *
 * ============================================================= */

const CashBody: FC<WidgetProps> = (p) => {
  const { look, cycle } = useLook(p);
  const [rows, setRows] = useState<{ month: string; total: number }[]>([]);
  useEffect(() => {
    let off = false;
    void cashByMonth(scope(p)).then((d) => { if (!off) setRows(d.map((r) => ({ month: r.month, total: r.total }))); });
    return () => { off = true; };
  }, [p.accountId, p.from, p.to, p.excludeInternal, p.version]);

  if (rows.length === 0) return empty("Sin disposiciones de efectivo.");

  const color = look === "colorful" ? "#64B5CD" : look === "aurora" ? "#22d3ee" : readVar("--text", "#e5e7eb");
  const total = rows.reduce((s, r) => s + r.total, 0);
  const groups = rows.map((r) => ({ label: monthLabelShort(r.month), segments: [{ key: "Efectivo", value: r.total, color }] }));

  return (
    <Shell p={p} look={look} onCycle={cycle} note={<>Total retirado <b style={{ color: "var(--text)" }}>{formatEUR(total)}</b></>}>
      <ProBars groups={groups} look={look} />
    </Shell>
  );
};

/* ============================================================= *
 *  5. Evolución de saldo / patrimonio                          *
 * ============================================================= */

const BalanceBody: FC<WidgetProps> = (p) => {
  const { look, cycle } = useLook(p);
  const [rows, setRows] = useState<{ month: string; saldo: number }[]>([]);
  const isAll = p.accountId === "all";
  useEffect(() => {
    let off = false;
    const promise = isAll ? netWorthSeries() : accountBalanceSeries(p.accountId as number);
    void promise.then((d) => { if (!off) setRows(d); });
    return () => { off = true; };
  }, [p.accountId, p.version]);

  if (rows.length < 2) return empty("Sin histórico de saldo suficiente.");

  const values = rows.map((r) => r.saldo);
  const labels = rows.map((r) => monthLabelShort(r.month));
  const last = values[values.length - 1];
  const delta = last - values[0];
  const grad: [string, string] = ["#818cf8", "#22d3ee"];

  return (
    <Shell
      p={p}
      look={look}
      onCycle={cycle}
      note={<>{isAll ? "Patrimonio" : "Saldo"} actual <b style={{ color: "var(--text)" }}>{formatEUR(last)}</b> · <span style={{ color: delta >= 0 ? "var(--good)" : "var(--bad)" }}>{delta >= 0 ? "+" : ""}{formatEUR(delta)}</span></>}
    >
      <ProLineChart labels={labels} look={look} gradient={grad} series={[{ id: "Saldo", values }]} />
    </Shell>
  );
};

/* ============================================================= *
 *  6. Gastos vs ingresos                                        *
 * ============================================================= */

const FlowsBody: FC<WidgetProps> = (p) => {
  const { look, cycle } = useLook(p);
  const [rows, setRows] = useState<{ month: string; expense: number; income: number }[]>([]);
  useEffect(() => {
    let off = false;
    void monthlyFlows(scope(p)).then((d) => { if (!off) setRows(d); });
    return () => { off = true; };
  }, [p.accountId, p.from, p.to, p.excludeInternal, p.version]);

  if (rows.length === 0) return empty("Sin movimientos en el periodo.");

  const { income, expense } = flowColors(look);
  const totalIn = rows.reduce((s, r) => s + r.income, 0);
  const totalOut = rows.reduce((s, r) => s + r.expense, 0);
  const net = totalIn - totalOut;
  const groups = rows.map((r) => ({
    label: monthLabelShort(r.month),
    segments: [
      { key: "Ingresos", value: r.income, color: income },
      { key: "Gastos", value: r.expense, color: expense },
    ],
  }));

  return (
    <Shell
      p={p}
      look={look}
      onCycle={cycle}
      note={<>Neto del periodo <b style={{ color: net >= 0 ? "var(--good)" : "var(--bad)" }}>{net >= 0 ? "+" : ""}{formatEUR(net)}</b></>}
    >
      <ProBars groups={groups} look={look} />
    </Shell>
  );
};

/* ============================================================= *
 *  7. Comparativa por categoría (periodo vs anterior)          *
 * ============================================================= */

const CatCompareBody: FC<WidgetProps> = (p) => {
  const { categories } = useApp();
  const { look, cycle } = useLook(p);
  const [rows, setRows] = useState<RankRow[]>([]);

  const endMonth = (p.to || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const thisM = monthKey(endMonth + "-01");
  const prevM = prevMonthKey(thisM);

  useEffect(() => {
    let off = false;
    const base = { accountId: p.accountId, excludeInternal: p.excludeInternal };
    void Promise.all([
      spendByCategoryId({ ...base, month: thisM }),
      spendByCategoryId({ ...base, month: prevM }),
    ]).then(([nowLeaf, prevLeaf]) => {
      if (off) return;
      const nowRoots = donutSlices(categories, new Map(nowLeaf.map((r) => [r.id, r.value])), null);
      const prevById = new Map(donutSlices(categories, new Map(prevLeaf.map((r) => [r.id, r.value])), null).map((s) => [s.id, s.value]));
      const byId = new Map(categories.map((c) => [c.id, c]));
      const nowById = new Map(nowRoots.map((s) => [s.id, s.value]));
      const ids = new Set<number>([...nowById.keys(), ...prevById.keys()]);
      const out: RankRow[] = [...ids]
        .map((id) => {
          const c = byId.get(id);
          return { id, label: c?.name ?? "?", color: c?.color ?? "#888", now: nowById.get(id) ?? 0, prev: prevById.get(id) ?? 0 };
        })
        .sort((a, b) => b.now + b.prev - (a.now + a.prev))
        .slice(0, 6);
      setRows(out);
    });
    return () => { off = true; };
  }, [p.accountId, p.excludeInternal, p.version, thisM, prevM, categories]);

  if (rows.length === 0) return empty("Sin gasto por categoría que comparar.");

  return (
    <Shell p={p} look={look} onCycle={cycle} note={<>{`Barra: ${monthLabelShort(thisM)} · marca: ${monthLabelShort(prevM)}`}</>}>
      <ProRankBars rows={rows} look={look} />
    </Shell>
  );
};

/* ============================================================= *
 *  8. Resumen del periodo                                       *
 * ============================================================= */

const SummaryBody: FC<WidgetProps> = (p) => {
  const { look, cycle } = useLook(p);
  const [k, setK] = useState<KpiSummary | null>(null);
  const [netSeries, setNetSeries] = useState<number[]>([]);
  useEffect(() => {
    let off = false;
    void Promise.all([kpis(scope(p)), monthlyFlows(scope(p))]).then(([kp, flows]) => {
      if (off) return;
      setK(kp);
      setNetSeries(flows.map((f) => f.income - f.expense));
    });
    return () => { off = true; };
  }, [p.accountId, p.from, p.to, p.excludeInternal, p.version]);

  if (!k) return empty("…");

  const grad = look === "aurora";
  const cardBase: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    border: look === "minimal" ? "1px solid var(--border)" : "1px solid transparent",
    background: look === "minimal" ? "transparent" : "var(--bg-elev)",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  };
  const value = (v: number, color: string) => (
    <span
      style={{
        fontSize: 20,
        fontWeight: 700,
        fontFamily: look === "minimal" ? "var(--font-mono)" : "var(--font-sans)",
        color,
        ...(grad ? { textShadow: `0 0 12px ${color}55` } : {}),
      }}
    >
      {formatEUR(v)}
    </span>
  );
  const good = "var(--good)";
  const bad = "var(--bad)";
  const income = look === "colorful" ? VIZ_PALETTE[0] : good;
  const expense = look === "colorful" ? VIZ_PALETTE[1] : bad;

  return (
    <Shell p={p} look={look} onCycle={cycle}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={cardBase}>
            <span style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ingresos</span>
            {value(k.income, income)}
          </div>
          <div style={cardBase}>
            <span style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Gastos</span>
            {value(k.expense, expense)}
          </div>
          <div style={cardBase}>
            <span style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ahorro</span>
            {value(k.net, k.net >= 0 ? good : bad)}
          </div>
          <div style={cardBase}>
            <span style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tasa de ahorro</span>
            <span style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-mono)", color: k.savingsRate >= 0 ? good : bad }}>
              {k.savingsRate.toFixed(0)}%
            </span>
          </div>
        </div>
        {netSeries.length >= 2 && (
          <div style={{ flex: 1, minHeight: 28 }}>
            <ProSparkline values={netSeries} look={look} color={look === "colorful" ? VIZ_PALETTE[0] : undefined} />
          </div>
        )}
      </div>
    </Shell>
  );
};

/* ---------- registro ---------- */

export const PRO_WIDGETS: WidgetDef[] = [
  { key: "pro_trend", title: "Gasto con tendencia", w: 6, h: 8, Body: TrendBody },
  { key: "pro_liquidity", title: "Liquidez diaria", w: 6, h: 8, Body: LiquidityBody },
  { key: "pro_sunburst", title: "Categorías (sunburst)", w: 6, h: 10, Body: SunburstBody },
  { key: "pro_cash", title: "Efectivo en cajero", w: 6, h: 8, Body: CashBody },
  { key: "pro_balance", title: "Evolución de saldo", w: 8, h: 8, Body: BalanceBody },
  { key: "pro_flows", title: "Gastos vs ingresos", w: 8, h: 8, Body: FlowsBody },
  { key: "pro_catcompare", title: "Comparativa por categoría", w: 6, h: 8, Body: CatCompareBody },
  { key: "pro_summary", title: "Resumen del periodo", w: 6, h: 7, Body: SummaryBody },
];
