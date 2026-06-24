// Gráficos con Nivo (rosco, barras, líneas, efectivo). Leen los tokens del tema
// activo (claro/oscuro) y se reaniman al entrar. Sustituyen a ECharts.

import { useMemo } from "react";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { formatEUR, monthLabelShort } from "../../lib/format";
import { useApp } from "../../state/AppContext";
import type { MonthlyFlow, BalancePoint, CashPoint } from "../../data/stats";
import type { DonutSlice } from "../../lib/donut";

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
        margin={{ top: 20, right: 20, bottom: 28, left: 56 }}
        xScale={{ type: "point" }}
        yScale={{ type: "linear", min: "auto", max: "auto" }}
        curve="monotoneX"
        colors={[color]}
        lineWidth={2.5}
        enablePoints={false}
        enableArea
        areaOpacity={0.12}
        enableGridX={false}
        useMesh
        axisBottom={{ tickSize: 0, tickPadding: 8 }}
        axisLeft={{ tickSize: 0, tickPadding: 6, format: (v) => `${Math.round(Number(v))}` }}
        motionConfig="gentle"
        tooltip={({ point }) => (
          <Tip>
            {String(point.data.x)} · <b>{formatEUR(Number(point.data.y))}</b>
          </Tip>
        )}
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
