// Gráficos con Nivo (rosco, barras, líneas, efectivo). Leen los tokens del tema
// activo (claro/oscuro) y se reaniman al entrar. Sustituyen a ECharts.

import { useMemo } from "react";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { ResponsiveCalendar } from "@nivo/calendar";
import { ResponsiveSunburst } from "@nivo/sunburst";
import { ResponsiveBullet } from "@nivo/bullet";
import { ResponsiveRadialBar } from "@nivo/radial-bar";
import { linearGradientDef } from "@nivo/core";
import { formatEUR, monthLabelShort } from "../../lib/format";
import { goalPercent } from "../../lib/goals";
import { useApp } from "../../state/AppContext";
import type { MonthlyFlow, BalancePoint, CashPoint, DailySpend } from "../../data/stats";
import type { DonutSlice, SunburstNode } from "../../lib/donut";
import type { BudgetRow } from "../../data/budgets";
import type { Goal } from "../../types";

const EXPENSE = "#ef4444";
const INCOME = "#22c55e";
const CASH = "#0ea5e9";

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Theme de Nivo derivado de las variables CSS; se recalcula al cambiar de tema. */
function useNivoTheme() {
  const { theme } = useApp();
  return useMemo(() => {
    const text = cssVar("--text", "#e2e8f0");
    const axis = cssVar("--text-dim", "#94a3b8");
    const grid = cssVar("--border", "#334155");
    return {
      text: { fill: axis, fontSize: 11, fontFamily: "inherit" },
      axis: {
        domain: { line: { stroke: grid } },
        ticks: { line: { stroke: grid, strokeWidth: 1 }, text: { fill: axis, fontSize: 10 } },
        legend: { text: { fill: axis } },
      },
      grid: { line: { stroke: grid, strokeWidth: 1, strokeDasharray: "2 4" } },
      legends: { text: { fill: axis, fontSize: 11 } },
      labels: { text: { fill: text, fontSize: 11, fontWeight: 600 } },
      tooltip: { container: { background: "transparent", boxShadow: "none", padding: 0 } },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}

/** Caja de tooltip uniforme y elegante para todos los gráficos. */
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        color: "var(--text)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 12,
        boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

function Fill({ children }: { children: React.ReactNode }) {
  return <div style={{ height: "100%", width: "100%" }}>{children}</div>;
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: color, marginRight: 6, verticalAlign: "middle" }}
    />
  );
}

/* ---------------------------------------------------------------- Rosco ---- */

interface PieDatum {
  id: string;
  catId: number;
  label: string;
  value: number;
  color: string;
  drillable: boolean;
}

export function NivoDonut({
  slices,
  centerLabel,
  onSlice,
}: {
  slices: DonutSlice[];
  centerLabel?: string;
  onSlice?: (id: number) => void;
}) {
  const theme = useNivoTheme();
  const text = cssVar("--text", "#e2e8f0");
  const card = cssVar("--bg-card", "#1e293b");
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;

  const data: PieDatum[] = slices.map((s) => ({
    id: String(s.id),
    catId: s.id,
    label: s.name,
    value: +s.value.toFixed(2),
    color: s.color,
    drillable: s.drillable,
  }));

  const CenterLabel = ({ centerX, centerY }: { centerX: number; centerY: number }) =>
    centerLabel ? (
      <text x={centerX} y={centerY} textAnchor="middle" dominantBaseline="central" style={{ fill: text, fontSize: 14, fontWeight: 700 }}>
        {centerLabel}
      </text>
    ) : null;

  return (
    <Fill>
      <ResponsivePie
        data={data}
        theme={theme}
        margin={{ top: 16, right: 120, bottom: 16, left: 16 }}
        innerRadius={0.6}
        padAngle={1}
        cornerRadius={4}
        activeOuterRadiusOffset={8}
        colors={{ datum: "data.color" }}
        borderWidth={2}
        borderColor={card}
        enableArcLabels={false}
        enableArcLinkLabels={false}
        motionConfig="gentle"
        transitionMode="pushIn"
        layers={["arcs", "arcLabels", "arcLinkLabels", "legends", CenterLabel]}
        legends={[
          {
            anchor: "right",
            direction: "column",
            justify: false,
            translateX: 110,
            itemsSpacing: 4,
            itemWidth: 100,
            itemHeight: 18,
            itemTextColor: cssVar("--text-dim", "#94a3b8"),
            symbolSize: 10,
            symbolShape: "circle",
          },
        ]}
        onClick={(node) => {
          const d = node.data as unknown as PieDatum;
          if (d.drillable) onSlice?.(d.catId);
        }}
        tooltip={({ datum }) => {
          const d = datum.data as unknown as PieDatum;
          const pct = ((d.value / total) * 100).toFixed(1);
          return (
            <Tip>
              <Swatch color={datum.color} />
              {d.label} · <b>{formatEUR(d.value)}</b> ({pct}%)
              {d.drillable && <span style={{ opacity: 0.6 }}> · clic para abrir</span>}
            </Tip>
          );
        }}
      />
    </Fill>
  );
}

/* ----------------------------------------------- Barras: gastos vs ingresos */

export function NivoFlows({ rows }: { rows: MonthlyFlow[] }) {
  const theme = useNivoTheme();
  const data = rows.map((r) => ({
    month: monthLabelShort(r.month),
    Gastos: +r.expense.toFixed(2),
    Ingresos: +r.income.toFixed(2),
  }));
  return (
    <Fill>
      <ResponsiveBar
        data={data}
        theme={theme}
        keys={["Gastos", "Ingresos"]}
        indexBy="month"
        groupMode="grouped"
        margin={{ top: 28, right: 16, bottom: 28, left: 52 }}
        padding={0.3}
        innerPadding={2}
        borderRadius={4}
        colors={({ id }) => (id === "Gastos" ? EXPENSE : INCOME)}
        defs={[
          linearGradientDef("gExpense", [
            { offset: 0, color: EXPENSE },
            { offset: 100, color: EXPENSE, opacity: 0.5 },
          ]),
          linearGradientDef("gIncome", [
            { offset: 0, color: INCOME },
            { offset: 100, color: INCOME, opacity: 0.5 },
          ]),
        ]}
        fill={[
          { match: { id: "Gastos" }, id: "gExpense" },
          { match: { id: "Ingresos" }, id: "gIncome" },
        ]}
        enableLabel={false}
        enableGridX={false}
        axisBottom={{ tickSize: 0, tickPadding: 8 }}
        axisLeft={{ tickSize: 0, tickPadding: 6, format: (v) => `${Math.round(Number(v))}` }}
        motionConfig="gentle"
        tooltip={({ id, value, color }) => (
          <Tip>
            <Swatch color={color} />
            {id}: <b>{formatEUR(Number(value))}</b>
          </Tip>
        )}
        legends={[
          {
            dataFrom: "keys",
            anchor: "top-right",
            direction: "row",
            translateY: -24,
            itemWidth: 80,
            itemHeight: 16,
            symbolSize: 10,
            symbolShape: "circle",
            itemTextColor: cssVar("--text-dim", "#94a3b8"),
          },
        ]}
      />
    </Fill>
  );
}

/* ------------------------------------------------- Línea: saldo/patrimonio */

// Capa personalizada: dibuja la curva con trazo en degradado (url) y un glow sutil.
const GlowLine = ({ series, lineGenerator }: any) =>
  series.map((s: any) => (
    <path
      key={s.id}
      d={lineGenerator(s.data.map((d: any) => d.position))}
      fill="none"
      stroke="url(#lineGradient)"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ filter: "drop-shadow(0 1px 5px rgba(99,102,241,0.45))" }}
    />
  ));

export function NivoBalance({ points, name }: { points: BalancePoint[]; name: string }) {
  const theme = useNivoTheme();
  const color = cssVar("--accent", "#6366f1");
  const data = [
    {
      id: name,
      data: points.map((p) => ({ x: monthLabelShort(p.month), y: +p.saldo.toFixed(2) })),
    },
  ];
  return (
    <Fill>
      <ResponsiveLine
        data={data}
        theme={theme}
        margin={{ top: 24, right: 24, bottom: 28, left: 56 }}
        xScale={{ type: "point" }}
        yScale={{ type: "linear", min: "auto", max: "auto" }}
        curve="monotoneX"
        colors={[color]}
        lineWidth={3}
        enablePoints={false}
        enableArea
        areaOpacity={1}
        defs={[
          linearGradientDef("balanceArea", [
            { offset: 0, color: "#a855f7", opacity: 0.4 },
            { offset: 60, color: "#6366f1", opacity: 0.18 },
            { offset: 100, color: "#22d3ee", opacity: 0 },
          ]),
          linearGradientDef(
            "lineGradient",
            [
              { offset: 0, color: "#22d3ee" },
              { offset: 50, color: "#6366f1" },
              { offset: 100, color: "#a855f7" },
            ],
            { x1: "0", y1: "0", x2: "1", y2: "0" },
          ),
        ]}
        fill={[{ match: "*", id: "balanceArea" }]}
        layers={["grid", "markers", "axes", "areas", "crosshair", GlowLine, "points", "slices", "mesh", "legends"]}
        enableGridX={false}
        enableGridY={false}
        enableSlices="x"
        crosshairType="x"
        axisBottom={{ tickSize: 0, tickPadding: 8 }}
        axisLeft={{ tickSize: 0, tickPadding: 6, format: (v) => `${Math.round(Number(v))}` }}
        motionConfig="gentle"
        sliceTooltip={({ slice }) => {
          const pt = slice.points[0];
          return (
            <Tip>
              <Swatch color={color} />
              {String(pt.data.x)} · <b>{formatEUR(Number(pt.data.y))}</b>
            </Tip>
          );
        }}
      />
    </Fill>
  );
}

/* --------------------------------------------------- Barras: efectivo cajero */

export function NivoCash({ rows }: { rows: CashPoint[] }) {
  const theme = useNivoTheme();
  const data = rows.map((r) => ({
    month: monthLabelShort(r.month),
    total: +r.total.toFixed(2),
    count: r.count,
  }));
  return (
    <Fill>
      <ResponsiveBar
        data={data}
        theme={theme}
        keys={["total"]}
        indexBy="month"
        margin={{ top: 16, right: 16, bottom: 28, left: 52 }}
        padding={0.35}
        borderRadius={4}
        colors={[CASH]}
        defs={[
          linearGradientDef("gCash", [
            { offset: 0, color: CASH },
            { offset: 100, color: CASH, opacity: 0.45 },
          ]),
        ]}
        fill={[{ match: "*", id: "gCash" }]}
        enableLabel={false}
        enableGridX={false}
        axisBottom={{ tickSize: 0, tickPadding: 8 }}
        axisLeft={{ tickSize: 0, tickPadding: 6, format: (v) => `${Math.round(Number(v))}` }}
        motionConfig="gentle"
        tooltip={({ data: d }) => (
          <Tip>
            <Swatch color={CASH} />
            {d.month} · <b>{formatEUR(Number(d.total))}</b> · {d.count} disposiciones
          </Tip>
        )}
      />
    </Fill>
  );
}

/* ------------------------------------------------ Heatmap calendario (días) */

export function NivoCalendar({ data, from, to }: { data: DailySpend[]; from: string; to: string }) {
  const theme = useNivoTheme();
  const empty = cssVar("--bg-elev", "#273549");
  const card = cssVar("--bg-card", "#1e293b");
  return (
    <Fill>
      <ResponsiveCalendar
        data={data}
        from={from || `${new Date().getFullYear()}-01-01`}
        to={to || `${new Date().getFullYear()}-12-31`}
        theme={theme}
        margin={{ top: 24, right: 16, bottom: 8, left: 24 }}
        emptyColor={empty}
        colors={["#c7d2fe", "#a5b4fc", "#818cf8", "#6366f1", "#4338ca"]}
        monthBorderColor={card}
        dayBorderColor={card}
        dayBorderWidth={2}
        tooltip={(d) => (
          <Tip>
            {d.day} · <b>{formatEUR(Number(d.value))}</b>
          </Tip>
        )}
      />
    </Fill>
  );
}

/* --------------------------------------------- Sunburst de categorías (gasto) */

export function NivoSunburst({ root }: { root: SunburstNode }) {
  const theme = useNivoTheme();
  const card = cssVar("--bg-card", "#1e293b");
  return (
    <Fill>
      <ResponsiveSunburst
        data={root}
        theme={theme}
        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        id="id"
        value="value"
        cornerRadius={3}
        borderColor={card}
        borderWidth={2}
        colors={(node: any) => node.data?.color ?? "#888"}
        inheritColorFromParent={false}
        enableArcLabels={false}
        motionConfig="gentle"
        transitionMode="pushIn"
        tooltip={(node: any) => (
          <Tip>
            <Swatch color={node.color} />
            {node.id} · <b>{formatEUR(Number(node.value))}</b> ({node.percentage.toFixed(1)}%)
          </Tip>
        )}
      />
    </Fill>
  );
}

/* ------------------------------------------- Bullet de presupuestos (gastado) */

export function NivoBudgets({ rows }: { rows: BudgetRow[] }) {
  const theme = useNivoTheme();
  const track = cssVar("--bg-elev", "#273549");
  const marker = cssVar("--text", "#e2e8f0");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", overflowY: "auto" }}>
      {rows.map((b) => {
        const over = b.spent > b.available;
        const max = Math.max(b.available, b.spent) || 1;
        return (
          <div key={b.category_id}>
            <div className="row" style={{ fontSize: 13 }}>
              <span>{b.icon} {b.category_name}</span>
              <span className="spacer" />
              <span className={over ? "amount neg" : "muted"}>
                {formatEUR(b.spent)} / {formatEUR(b.available)}
              </span>
            </div>
            <div style={{ height: 26 }}>
              <ResponsiveBullet
                data={[{ id: "", ranges: [max], measures: [b.spent], markers: [b.available] }]}
                theme={theme}
                margin={{ top: 2, right: 6, bottom: 2, left: 2 }}
                spacing={0}
                titleOffsetX={0}
                measureSize={0.35}
                markerSize={1.1}
                rangeColors={[track]}
                measureColors={[over ? EXPENSE : b.color]}
                markerColors={[marker]}
                animate
                motionConfig="gentle"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------- Gauge de metas (radial bar) */

export function NivoGoals({ goals }: { goals: Goal[] }) {
  const theme = useNivoTheme();
  const track = cssVar("--bg-elev", "#273549");
  const byName = new Map(goals.map((g) => [g.name, g]));
  const data = goals.map((g) => ({
    id: g.name,
    data: [{ x: "progreso", y: Math.min(100, Math.round(goalPercent(g.current_amount, g.target_amount))) }],
  }));
  return (
    <Fill>
      <ResponsiveRadialBar
        data={data}
        theme={theme}
        maxValue={100}
        startAngle={-120}
        endAngle={120}
        innerRadius={0.3}
        padding={0.35}
        cornerRadius={4}
        margin={{ top: 16, right: 16, bottom: 16, left: 16 }}
        colors={goals.map((g) => g.color)}
        tracksColor={track}
        enableRadialGrid={false}
        enableCircularGrid={false}
        radialAxisStart={{ tickSize: 0, tickPadding: 6 }}
        circularAxisOuter={null}
        motionConfig="gentle"
        tooltip={(bar: any) => {
          const g = byName.get(bar.groupId);
          return (
            <Tip>
              <Swatch color={bar.color} />
              {bar.groupId} · <b>{bar.value}%</b>
              {g && <span style={{ opacity: 0.7 }}> · {formatEUR(g.current_amount)} / {formatEUR(g.target_amount)}</span>}
            </Tip>
          );
        }}
      />
    </Fill>
  );
}
