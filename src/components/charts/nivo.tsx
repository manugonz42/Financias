// Gráficos con Nivo (rosco, barras, líneas, efectivo). Leen los tokens del tema
// activo (claro/oscuro) y se reaniman al entrar. Sustituyen a ECharts.

import { useMemo, useState, useEffect, useRef } from "react";
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
import { CategoryGlyph } from "../../lib/icons";
import type { MonthlyFlow, BalancePoint, CashPoint, DailySpend } from "../../data/stats";
import type { DonutSlice, SunburstNode } from "../../lib/donut";
import type { BudgetRow } from "../../data/budgets";
import type { Goal } from "../../types";
import type { BarStyle } from "../../lib/barStyles";

const EXPENSE = "#ef4444";
const INCOME = "#22c55e";
const CASH = "#0ea5e9";
const CALENDAR_SCALE = ["#c7d2fe", "#a5b4fc", "#818cf8", "#6366f1", "#4338ca"];

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
  const minimal = isMinimalistTheme();
  return (
    <div
      style={{
        background: minimal ? "var(--bg-card)" : "var(--bg-card)",
        color: "var(--text)",
        border: "1px solid var(--border)",
        borderRadius: minimal ? 6 : 8,
        padding: "6px 10px",
        fontSize: 12,
        boxShadow: minimal ? "none" : "0 6px 18px rgba(0,0,0,0.35)",
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

/**
 * Traduce un `BarStyle` (relleno + colores) a las props de color de `ResponsiveBar`
 * para un gráfico de dos series. Con colores `null` usa los intrínsecos del gráfico;
 * en modo "gradient" genera los `defs`/`fill` de degradado vertical.
 */
function barFills(
  style: BarStyle,
  keys: [string, string],
  intrinsic: [string, string],
) {
  const past = style.past ?? intrinsic[0];
  const now = style.now ?? intrinsic[1];
  const colors = ({ id }: { id: string | number }) => (id === keys[0] ? past : now);
  // "flat" = sin degradado; "gradient" y "neon" usan el mismo relleno degradado
  // (el "neon" además añade un halo en una capa aparte del gráfico).
  if (style.fill === "flat") return { colors, defs: [], fill: [] as { match: { id: string }; id: string }[] };
  return {
    colors,
    defs: [
      linearGradientDef("barA", [
        { offset: 0, color: past },
        { offset: 100, color: past, opacity: 0.55 },
      ]),
      linearGradientDef("barB", [
        { offset: 0, color: now },
        { offset: 100, color: now, opacity: 0.55 },
      ]),
    ],
    fill: [
      { match: { id: keys[0] }, id: "barA" },
      { match: { id: keys[1] }, id: "barB" },
    ],
  };
}

/** Capa de Nivo (antes de "bars") que pinta un halo desenfocado del color de cada
 *  barra detrás de ella → efecto "neón"/luz sobre fondo oscuro. */
const NeonGlow = ({ bars }: { bars: { key: string; x: number; y: number; width: number; height: number; color: string }[] }) =>
  bars.map((b) => (
    <rect
      key={b.key}
      x={b.x}
      y={b.y}
      width={b.width}
      height={b.height}
      rx={6}
      ry={6}
      fill={b.color}
      opacity={0.85}
      pointerEvents="none"
      style={{ filter: "blur(7px)" }}
    />
  ));

/** Orden de capas de las barras con el halo neón insertado antes de "bars". */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NEON_LAYERS: any[] = ["grid", "axes", NeonGlow, "bars", "markers", "legends", "annotations"];

/** Variante del theme con los ticks de los ejes en la fuente mono de la app
 *  (cifras "tabular", look técnico de Linear). */
function withMonoTicks<T extends ReturnType<typeof useNivoTheme>>(theme: T) {
  return {
    ...theme,
    axis: {
      ...theme.axis,
      ticks: {
        ...theme.axis.ticks,
        text: { ...theme.axis.ticks.text, fontFamily: "var(--font-mono)" },
      },
    },
  };
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
  palette,
  hiddenIds,
  onToggleId,
}: {
  slices: DonutSlice[];
  centerLabel?: string;
  onSlice?: (id: number) => void;
  /** Si se pasa, pinta cada porción por índice; si es null/undefined, color de cada categoría. */
  palette?: string[] | null;
  /** Si se proporciona junto con onToggleId, el rosco filtra estas categorías
   *  del gráfico y renderiza una leyenda JSX a la derecha clicable. */
  hiddenIds?: Set<number>;
  onToggleId?: (id: number) => void;
}) {
  const theme = useNivoTheme();
  const text = cssVar("--text", "#e2e8f0");
  const minimal = isMinimalistTheme();

  // Datos completos para la leyenda; los visibles para el gráfico.
  const allData: PieDatum[] = slices.map((s, i) => ({
    id: String(s.id),
    catId: s.id,
    label: s.name,
    value: +s.value.toFixed(2),
    color: palette && palette.length ? palette[i % palette.length] : s.color,
    drillable: s.drillable,
  }));
  const interactive = !!onToggleId;
  const data = interactive
    ? allData.filter((d) => !hiddenIds?.has(d.catId))
    : allData;
  const total = data.reduce((s, x) => s + x.value, 0) || 1;

  const CenterLabel = ({ centerX, centerY }: { centerX: number; centerY: number }) =>
    centerLabel ? (
      <text x={centerX} y={centerY} textAnchor="middle" dominantBaseline="central" style={{ fill: text, fontSize: 14, fontWeight: 700 }}>
        {centerLabel}
      </text>
    ) : null;

  const pie = (
    <ResponsivePie
      data={data}
      theme={theme}
      margin={{ top: 16, right: interactive ? 16 : 120, bottom: 16, left: 16 }}
      innerRadius={0.6}
      padAngle={0.3}
      cornerRadius={2}
      activeOuterRadiusOffset={minimal ? 3 : 8}
      colors={{ datum: "data.color" }}
      borderWidth={minimal ? 0.5 : 1.5}
      borderColor={minimal ? "none" : { from: "color", modifiers: [["darker", 0.5]] }}
      enableArcLabels={false}
      enableArcLinkLabels={false}
      motionConfig="gentle"
      transitionMode="pushIn"
      layers={["arcs", "arcLabels", "arcLinkLabels", "legends", CenterLabel]}
      legends={
        interactive
          ? []
          : [
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
            ]
      }
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
  );

  if (!interactive) return <Fill>{pie}</Fill>;

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>{pie}</div>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          width: 130,
          overflowY: "auto",
          fontSize: 12,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {allData.map((d) => {
          const hidden = !!hiddenIds?.has(d.catId);
          return (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => onToggleId?.(d.catId)}
                title={
                  hidden
                    ? `Mostrar ${d.label}`
                    : `Ocultar ${d.label} del rosco`
                }
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "2px 4px",
                  width: "100%",
                  borderRadius: 4,
                  opacity: hidden ? 0.4 : 1,
                  textDecoration: hidden ? "line-through" : "none",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: d.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    color: "var(--text-dim, #94a3b8)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {d.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ----------------------------------------------- Barras: gastos vs ingresos */

export function NivoFlows({ rows, palette, style }: { rows: MonthlyFlow[]; palette?: string[] | null; style: BarStyle }) {
  const theme = withMonoTicks(useNivoTheme());
  const minimal = isMinimalistTheme();
  const dark = isDarkTheme();
  const data = rows.map((r) => ({
    month: monthLabelShort(r.month),
    Gastos: +r.expense.toFixed(2),
    Ingresos: +r.income.toFixed(2),
  }));
  // Minimalista: blanco y negro puro. Gastos = negro/oscuro, Ingresos = gris claro.
  const expense = minimal
    ? (dark ? "#f0efec" : "#111111")
    : (palette && palette.length ? palette[0] : EXPENSE);
  const income = minimal
    ? (dark ? "#6a6862" : "#a09e98")
    : (palette && palette.length > 1 ? palette[1] : (palette && palette.length ? palette[0] : INCOME));
  const effectiveStyle = minimal ? { ...style, fill: "flat" as const } : style;
  const { colors, defs, fill } = barFills(effectiveStyle, ["Gastos", "Ingresos"], [expense, income]);
  return (
    <Fill>
      <ResponsiveBar
        data={data}
        theme={theme}
        keys={["Gastos", "Ingresos"]}
        indexBy="month"
        groupMode="grouped"
        margin={{ top: 28, right: 16, bottom: 28, left: 52 }}
        padding={minimal ? 0.55 : 0.4}
        innerPadding={minimal ? 3 : 3}
        borderRadius={minimal ? 2 : 6}
        colors={colors}
        defs={defs}
        fill={fill}
        layers={!minimal && style.fill === "neon" ? NEON_LAYERS : undefined}
        enableLabel={false}
        enableGridX={false}
        enableGridY={false}
        axisBottom={{ tickSize: 0, tickPadding: 10 }}
        axisLeft={{ tickSize: 0, tickPadding: 8, format: (v) => `${Math.round(Number(v))}` }}
        motionConfig="gentle"
        tooltip={({ id, value, color }) => (
          <Tip>
            <Swatch color={color} />
            {id}: <b style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{formatEUR(Number(value))}</b>
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

/* ------------------------------------ Barras: comparativa por categoría (mes a mes) */

export function NivoCategoryCompare({
  rows,
  mode,
  style,
}: {
  rows: { name: string; color: string; icon: string; prev: number; now: number }[];
  mode: "eur" | "pct";
  style: BarStyle;
}) {
  const theme = withMonoTicks(useNivoTheme());
  const { iconStyle } = useApp();
  const minimal = isMinimalistTheme();
  const dark = isDarkTheme();
  // Minimalista: blanco y negro puro. Pasado = gris medio, Este mes = negro/blanco.
  const intrinsic: [string, string] = minimal
    ? [dark ? "#6a6862" : "#a09e98", dark ? "#f0efec" : "#111111"]
    : [cssVar("--text-dim", "#8a8f98"), cssVar("--text", "#f7f8f8")];
  // En minimalista siempre "flat".
  const effectiveStyle = minimal ? { ...style, fill: "flat" as const } : style;
  const { colors, defs, fill } = barFills(effectiveStyle, ["Pasado", "Este mes"], intrinsic);
  const pct = mode === "pct";
  const totalPrev = rows.reduce((s, r) => s + r.prev, 0) || 1;
  const totalNow = rows.reduce((s, r) => s + r.now, 0) || 1;
  const iconByName = new Map(rows.map((r) => [r.name, r.icon]));
  const data = rows.map((r) => ({
    name: r.name,
    Pasado: pct ? +((r.prev / totalPrev) * 100).toFixed(1) : +r.prev.toFixed(2),
    "Este mes": pct ? +((r.now / totalNow) * 100).toFixed(1) : +r.now.toFixed(2),
  }));
  const fmt = (v: number) => (pct ? `${v}%` : formatEUR(v));
  return (
    <Fill>
      <ResponsiveBar
        data={data}
        theme={theme}
        keys={["Pasado", "Este mes"]}
        indexBy="name"
        groupMode="grouped"
        margin={{ top: 28, right: 16, bottom: 34, left: 48 }}
        padding={minimal ? 0.55 : 0.42}
        innerPadding={minimal ? 3 : 3}
        borderRadius={minimal ? 2 : 6}
        colors={colors}
        defs={defs}
        fill={fill}
        layers={!minimal && style.fill === "neon" ? NEON_LAYERS : undefined}
        enableLabel={false}
        enableGridX={false}
        enableGridY={false}
        axisBottom={{
          tickSize: 0,
          tickPadding: 6,
          // Eje inferior con iconos de categoría (respeta el estilo Color/Lineal).
          renderTick: (tick) => (
            <g transform={`translate(${tick.x},${tick.y})`}>
              <foreignObject x={-11} y={6} width={22} height={22} style={{ overflow: "visible" }}>
                <div style={{ display: "flex", justifyContent: "center", fontSize: 16, lineHeight: 1, color: "var(--text-dim)" }}>
                  <CategoryGlyph icon={iconByName.get(String(tick.value)) ?? "•"} mode={iconStyle} />
                </div>
              </foreignObject>
            </g>
          ),
        }}
        axisLeft={{ tickSize: 0, tickPadding: 8, format: (v) => (pct ? `${Math.round(Number(v))}%` : `${Math.round(Number(v))}`) }}
        motionConfig="gentle"
        tooltip={({ id, value, color, indexValue }) => (
          <Tip>
            <Swatch color={color} />
            {String(indexValue)} · {id}: <b style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{fmt(Number(value))}</b>
          </Tip>
        )}
        legends={[
          {
            dataFrom: "keys",
            anchor: "top-right",
            direction: "row",
            translateY: -24,
            itemWidth: 78,
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

function isMinimalistTheme() {
  if (typeof document === "undefined") return false;
  const t = document.documentElement.getAttribute("data-theme");
  return t === "minimalist" || t === "minimalist-dark";
}

function isDarkTheme() {
  if (typeof document === "undefined") return true;
  const t = document.documentElement.getAttribute("data-theme");
  return t !== "light" && t !== "minimalist";
}

/* ------------------------------------------------- Línea: saldo/patrimonio */

// Capa personalizada: dibuja la curva con trazo en degradado (url) y un glow sutil.
// En modo minimalista: trazo fino sin glow, color sólido.
const GlowLine = ({ series, lineGenerator }: any) => {
  const minimal = isMinimalistTheme();
  const dark = isDarkTheme();
  return series.map((s: any) => (
    <path
      key={s.id}
      d={lineGenerator(s.data.map((d: any) => d.position))}
      fill="none"
      stroke={minimal ? (dark ? "#f0efec" : "#111111") : "url(#lineGradient)"}
      strokeWidth={minimal ? 1.5 : 2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={minimal ? {} : { filter: "drop-shadow(0 1px 5px rgba(94,106,210,0.5))" }}
    />
  ));
};

export function NivoBalance({ points, name, palette }: { points: BalancePoint[]; name: string; palette?: string[] | null }) {
  const theme = useNivoTheme();
  const minimal = isMinimalistTheme();
  const dark = isDarkTheme();
  const color = palette && palette.length ? palette[0] : cssVar("--accent", "#6366f1");
  const data = [
    {
      id: name,
      data: points.map((p) => ({ x: monthLabelShort(p.month), y: +p.saldo.toFixed(2) })),
    },
  ];

  // En modo minimalista: área sutil con color sólido, sin gradiente complejo.
  const areaOpacity = minimal ? 0.06 : 0;
  const lineColor = minimal ? (dark ? "#f0efec" : "#111111") : color;

  return (
    <Fill>
      <ResponsiveLine
        data={data}
        theme={theme}
        margin={{ top: 24, right: 24, bottom: 28, left: 56 }}
        xScale={{ type: "point" }}
        yScale={{ type: "linear", min: "auto", max: "auto" }}
        curve="monotoneX"
        colors={[lineColor]}
        lineWidth={minimal ? 1.5 : 3}
        enablePoints={false}
        enableArea
        areaOpacity={minimal ? areaOpacity : 1}
        defs={
          minimal
            ? []
            : [
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
              ]
        }
        fill={minimal ? [] : [{ match: "*", id: "balanceArea" }]}
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
              <Swatch color={lineColor} />
              {String(pt.data.x)} · <b>{formatEUR(Number(pt.data.y))}</b>
            </Tip>
          );
        }}
      />
    </Fill>
  );
}

/* ---------------------------------------- Línea minimalista: saldo/patrimonio */

/**
 * Convierte puntos de control catmull-rom a un path SVG cubic bezier suave.
 * tension: 0 = lineal, 0.5 = catmull-rom estándar, 1 = muy redondeado.
 */
function catmullRomToBezier(pts: { x: number; y: number }[], tension = 0.5): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;

  const d: string[] = [`M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`];

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
    const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
    const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
    const cp2y = p2.y - (p3.y - p1.y) * tension / 3;

    d.push(`C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`);
  }

  return d.join(" ");
}

/**
 * Widget de evolución de saldo con diseño 100% minimalista editorial.
 * SVG custom: línea curva suave, área sutil, sin ejes visibles.
 * Incluye luz animada con estela que recorre la línea (toggleable).
 * Se usa solo cuando el tema es minimalista o minimalist-dark.
 */
export function NivoBalanceMinimalist({
  points,
  name: _name,
  palette,
  hoveredIdx: _hoveredIdx,
  onHover,
}: {
  points: BalancePoint[];
  name: string;
  palette?: string[] | null;
  hoveredIdx?: number | null;
  onHover?: (idx: number | null) => void;
}) {
  const dark = isDarkTheme();
  const fg = dark ? "#f0efec" : "#111111";
  const fgDim = dark ? "#6a6862" : "#787774";
  const lineColor = palette && palette.length ? palette[0] : fg;

  // Layout — sin padding de ejes
  const W = 600;
  const H = 220;
  const pad = { top: 16, right: 16, bottom: 16, left: 16 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (points.length === 0) return <Fill><div style={{ color: fgDim }}>Sin datos.</div></Fill>;

  const values = points.map((p) => p.saldo);
  const yMin = Math.min(...values);
  const yMax = Math.max(...values);
  const yRange = yMax - yMin || 1;
  const yPad = yRange * 0.1;
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;

  const xScale = (i: number) => pad.left + (i / Math.max(points.length - 1, 1)) * cw;
  const yScale = (v: number) => pad.top + ch - ((v - yLo) / (yHi - yLo)) * ch;

  // Puntos escalados para curva catmull-rom
  const scaledPts = points.map((p, i) => ({ x: xScale(i), y: yScale(p.saldo) }));
  const curvedPath = catmullRomToBezier(scaledPts, 0.6);

  // Path del área (bajo la curva)
  const last = scaledPts[scaledPts.length - 1];
  const first = scaledPts[0];
  const areaPath =
    curvedPath +
    ` L${last.x.toFixed(1)},${(pad.top + ch).toFixed(1)}` +
    ` L${first.x.toFixed(1)},${(pad.top + ch).toFixed(1)} Z`;

  // Tooltip: punto más cercano al mouse
  const svgRef = useRef<SVGSVGElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; idx: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    // Encontrar índice más cercano
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < scaledPts.length; i++) {
      const d = Math.abs(scaledPts[i].x - svgX);
      if (d < minDist) { minDist = d; closest = i; }
    }
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, idx: closest });
    onHover?.(closest);
  };

  const handleMouseLeave = () => { setTip(null); onHover?.(null); };

  const tipPt = tip ? points[tip.idx] : null;

  return (
    <Fill>
      <div style={{ position: "relative", width: "100%", height: "100%", opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(8px)", transition: "opacity 400ms ease-out, transform 400ms ease-out" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "100%", fontFamily: "var(--font-mono)" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* Degradado vertical para el área: lineColor → transparente */}
            <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0.01} />
            </linearGradient>
          </defs>

          {/* Área con degradado bajo la curva */}
          <path d={areaPath} fill="url(#area-grad)" />

          {/* Línea principal curva */}
          <path
            d={curvedPath}
            fill="none"
            stroke={lineColor}
            strokeWidth={2}
            strokeLinecap="round"
          />

          {/* Hover: rect invisible para capturar mouse */}
          <rect
            x={pad.left}
            y={pad.top}
            width={cw}
            height={ch}
            fill="transparent"
            style={{ cursor: "crosshair" }}
          />

          {/* Hover: línea vertical + punto */}
          {tip && (
            <g>
              <line
                x1={scaledPts[tip.idx].x}
                y1={pad.top}
                x2={scaledPts[tip.idx].x}
                y2={pad.top + ch}
                stroke={fgDim}
                strokeWidth={0.5}
                strokeDasharray="3,3"
              />
              <circle
                cx={scaledPts[tip.idx].x}
                cy={scaledPts[tip.idx].y}
                r={4}
                fill={fg}
                stroke={dark ? "#1a1a18" : "#FFFFFF"}
                strokeWidth={2}
              />
            </g>
          )}
        </svg>

        {/* Tooltip flotante */}
        {tip && tipPt && (
          <div
            style={{
              position: "absolute",
              left: Math.min(tip.x + 12, (svgRef.current?.getBoundingClientRect().width ?? 300) - 120),
              top: tip.y - 40,
              background: dark ? "#1a1a18" : "#FFFFFF",
              border: "1px solid #EAEAEA",
              borderRadius: 8,
              padding: "6px 10px",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: fg,
              pointerEvents: "none",
              whiteSpace: "nowrap",
              zIndex: 10,
            }}
          >
            <span style={{ color: fgDim }}>{monthLabelShort(tipPt.month)}</span>
            <span style={{ margin: "0 4px", color: fgDim }}>·</span>
            <span>{formatEUR(tipPt.saldo)}</span>
          </div>
        )}
      </div>
    </Fill>
  );
}

/* --------------------------------------------------- Barras: efectivo cajero */

export function NivoCash({ rows, palette }: { rows: CashPoint[]; palette?: string[] | null }) {
  const theme = useNivoTheme();
  const minimal = isMinimalistTheme();
  const dark = isDarkTheme();
  const cash = minimal
    ? (dark ? "#a09e98" : "#6a6862")
    : (palette && palette.length ? palette[0] : CASH);
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
        padding={minimal ? 0.5 : 0.35}
        borderRadius={minimal ? 2 : 4}
        colors={[cash]}
        defs={
          minimal
            ? []
            : [
                linearGradientDef("gCash", [
                  { offset: 0, color: cash },
                  { offset: 100, color: cash, opacity: 0.45 },
                ]),
              ]
        }
        fill={minimal ? [] : [{ match: "*", id: "gCash" }]}
        enableLabel={false}
        enableGridX={false}
        axisBottom={{ tickSize: 0, tickPadding: 8 }}
        axisLeft={{ tickSize: 0, tickPadding: 6, format: (v) => `${Math.round(Number(v))}` }}
        motionConfig="gentle"
        tooltip={({ data: d }) => (
          <Tip>
            <Swatch color={cash} />
            {d.month} · <b>{formatEUR(Number(d.total))}</b> · {d.count} disposiciones
          </Tip>
        )}
      />
    </Fill>
  );
}

/* ------------------------------------------------ Heatmap calendario (días) */

export function NivoCalendar({ data, from, to, palette }: { data: DailySpend[]; from: string; to: string; palette?: string[] | null }) {
  const theme = useNivoTheme();
  const empty = cssVar("--bg-elev", "#273549");
  const card = cssVar("--bg-card", "#1e293b");
  // Escala de la heatmap: si la paleta tiene ≥3 colores la usamos (primeros 5), si no la del tema.
  const scale = palette && palette.length >= 3 ? palette.slice(0, 5) : CALENDAR_SCALE;
  return (
    <Fill>
      <ResponsiveCalendar
        data={data}
        from={from || `${new Date().getFullYear()}-01-01`}
        to={to || `${new Date().getFullYear()}-12-31`}
        theme={theme}
        margin={{ top: 24, right: 16, bottom: 8, left: 24 }}
        emptyColor={empty}
        colors={scale}
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

export function NivoSunburst({ root, palette }: { root: SunburstNode; palette?: string[] | null }) {
  const theme = useNivoTheme();
  return (
    <Fill>
      <ResponsiveSunburst
        data={root}
        theme={theme}
        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        id="id"
        value="value"
        cornerRadius={3}
        borderWidth={1.5}
        borderColor={{ from: "color", modifiers: [["darker", 0.5]] }}
        colors={
          palette && palette.length
            ? (node: any) => {
                // Reparte la paleta por nodo (usando la posición del id en la lista).
                const k = String(node.id ?? "");
                let h = 0;
                for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
                return palette[h % palette.length];
              }
            : (node: any) => node.data?.color ?? "#888"
        }
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
  const { iconStyle } = useApp();
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
              <span><CategoryGlyph icon={b.icon} mode={iconStyle} /> {b.category_name}</span>
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
