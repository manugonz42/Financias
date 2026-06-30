// Gráficos alternativos siguiendo principios de data-visualization skill.
// Estos componentes son versiones alternativas de los widgets existentes,
// diseñados para ofrecer diferentes perspectivas visuales.

import { useMemo } from "react";
import { ResponsiveBar, type BarDatum } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { formatEUR } from "../../lib/format";
import { useApp } from "../../state/AppContext";
import type { MonthlyFlow } from "../../data/stats";

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function useColors() {
  const { theme } = useApp();
  return useMemo(() => ({
    text: cssVar("--text-dim", "#787774"),
    grid: cssVar("--border", "#EAEAEA"),
    good: cssVar("--good", "#346538"),
    bad: cssVar("--bad", "#9F2F2D"),
    accent: cssVar("--accent", "#111111"),
  }), [theme]);
}

/**
 * Barras horizontales apiladas: ingresos vs gastos por mes.
 * Principio: "Comparison across categories" → Horizontal bar chart.
 * Ordenado por valor (mayor gasto arriba).
 */
export function NivoCashFlowBars({ data }: { data: MonthlyFlow[] }) {
  const colors = useColors();
  const sorted = useMemo(() => [...data].sort((a, b) => b.expense - a.expense), [data]);
  const barData: BarDatum[] = sorted.map((d) => ({ month: d.month, income: d.income, expense: d.expense }));

  return (
    <ResponsiveBar
      data={barData}
      keys={["income", "expense"]}
      indexBy="month"
      layout="vertical"
      margin={{ top: 10, right: 40, bottom: 10, left: 60 }}
      padding={0.3}
      colors={[colors.good, colors.bad]}
      enableGridY={false}
      enableGridX={true}
      axisBottom={{
        tickSize: 0,
        tickPadding: 8,
        format: (v) => formatEUR(Number(v)),
        tickValues: 5,
      }}
      axisLeft={{
        tickSize: 0,
        tickPadding: 8,
        tickRotation: 0,
      }}
      label={(d) => formatEUR(d.value as number)}
      labelSkipWidth={40}
      labelTextColor={colors.text}
      theme={{
        text: { fill: colors.text, fontSize: 11 },
        grid: { line: { stroke: colors.grid, strokeDasharray: "2 4" } },
      }}
      tooltip={({ id, value, indexValue }) => (
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "6px 10px",
          fontSize: 12,
        }}>
          <b>{indexValue}</b> · {id === "income" ? "Ingresos" : "Gastos"}: {formatEUR(value)}
        </div>
      )}
    />
  );
}

/**
 * Lollipop chart para categorías de gasto.
 * Principio: "Ranking" → Dot plot con línea.
 * Más preciso que donut para comparar valores similares.
 */
export function NivoCategoryLollipop({
  items,
}: {
  items: { name: string; value: number; color: string }[];
}) {
  const colors = useColors();
  const sorted = useMemo(() => [...items].sort((a, b) => b.value - a.value).slice(0, 10), [items]);
  const maxVal = sorted[0]?.value ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
      {sorted.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 100, textAlign: "right", color: colors.text, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.name}
          </span>
          <div style={{ flex: 1, height: 16, position: "relative" }}>
            <div style={{
              position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
              height: 2, width: `${(item.value / maxVal) * 100}%`,
              background: colors.grid,
            }} />
            <div style={{
              position: "absolute", left: `${(item.value / maxVal) * 100}%`, top: "50%",
              transform: "translate(-50%, -50%)",
              width: 8, height: 8, borderRadius: "50%",
              background: item.color,
            }} />
          </div>
          <span style={{ width: 70, fontFamily: "var(--font-mono)", fontSize: 11, color: colors.text }}>
            {formatEUR(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Línea con anotaciones de insight.
 * Principio: "Title states the insight" + "Annotation highlights".
 * Marca automáticamente el punto máximo, mínimo y la tendencia.
 */
export function NivoInsightLine({ data }: { data: { month: string; value: number }[] }) {
  const colors = useColors();

  const { max, min, trend } = useMemo(() => {
    if (data.length === 0) return { max: null, min: null, trend: 0 };
    const vals = data.map((d) => d.value);
    const maxIdx = vals.indexOf(Math.max(...vals));
    const minIdx = vals.indexOf(Math.min(...vals));
    const first = vals[0];
    const last = vals[vals.length - 1];
    const trendPct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
    return {
      max: { idx: maxIdx, month: data[maxIdx].month, value: vals[maxIdx] },
      min: { idx: minIdx, month: data[minIdx].month, value: vals[minIdx] },
      trend: trendPct,
    };
  }, [data]);

  const lineData = [{
    id: "gasto",
    data: data.map((d) => ({ x: d.month, y: d.value })),
  }];

  const annotations = useMemo(() => {
    const pts: { x: string; y: number; label: string; color: string }[] = [];
    if (max) pts.push({ x: max.month, y: max.value, label: `Max: ${formatEUR(max.value)}`, color: colors.bad });
    if (min) pts.push({ x: min.month, y: min.value, label: `Min: ${formatEUR(min.value)}`, color: colors.good });
    return pts;
  }, [max, min, colors]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 12, color: colors.text }}>
        <span style={{ fontWeight: 600 }}>
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
        </span>
        <span style={{ marginLeft: 6, opacity: 0.7 }}>tendencia en {data.length} meses</span>
      </div>
      <div style={{ height: 180 }}>
        <ResponsiveLine
          data={lineData}
          margin={{ top: 20, right: 20, bottom: 25, left: 50 }}
          xScale={{ type: "point" }}
          yScale={{ type: "linear", min: "auto" }}
          axisBottom={{ tickSize: 0, tickPadding: 8, tickRotation: -45 }}
          axisLeft={{ tickSize: 0, tickPadding: 8, format: (v) => formatEUR(Number(v)) }}
          enablePoints={true}
          pointSize={5}
          pointColor={colors.accent}
          pointBorderWidth={2}
          pointBorderColor={colors.accent}
          enableArea={true}
          areaOpacity={0.08}
          colors={[colors.accent]}
          theme={{
            text: { fill: colors.text, fontSize: 10 },
            grid: { line: { stroke: colors.grid, strokeDasharray: "2 4" } },
          }}
          tooltip={({ point }) => (
            <div style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 12,
            }}>
              <b>{point.data.x}</b>: {formatEUR(point.data.y as number)}
            </div>
          )}
        />
      </div>
      {annotations.length > 0 && (
        <div style={{ display: "flex", gap: 12, fontSize: 10, color: colors.text }}>
          {annotations.map((a, i) => (
            <span key={i}>
              <span style={{ color: a.color, fontWeight: 600 }}>{a.label}</span>
              <span style={{ marginLeft: 4, opacity: 0.7 }}>({a.x})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Gauge de tasa de ahorro.
 * Principio: "Performance vs target" → Gauge/single KPI.
 * Muestra un semicírculo con la tasa de ahorro y un indicador de color.
 */
export function NivoSavingsGauge({ rate }: { rate: number }) {
  const colors = useColors();
  const clamped = Math.max(0, Math.min(100, rate));

  const gaugeColor = clamped >= 20 ? colors.good
    : clamped >= 10 ? "var(--warn, #956400)"
    : colors.bad;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 160, height: 90, overflow: "hidden" }}>
        {/* Fondo del gauge (semicírculo gris) */}
        <div style={{
          position: "absolute",
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: `conic-gradient(from 180deg, ${colors.grid} 0deg, ${colors.grid} 180deg, transparent 180deg)`,
        }} />
        {/* Gauge coloreado */}
        <div style={{
          position: "absolute",
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: `conic-gradient(from 180deg, ${gaugeColor} 0deg, ${gaugeColor} ${clamped * 1.8}deg, transparent ${clamped * 1.8}deg)`,
        }} />
        {/* Centro blanco */}
        <div style={{
          position: "absolute",
          top: 20,
          left: 20,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: "var(--bg-card)",
        }} />
        {/* Valor central */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 24,
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          color: gaugeColor,
        }}>
          {clamped.toFixed(0)}%
        </div>
      </div>
      <div style={{ fontSize: 12, color: colors.text }}>
        Tasa de ahorro
      </div>
      <div style={{ fontSize: 10, color: colors.text, opacity: 0.6 }}>
        {clamped >= 20 ? "Excelente" : clamped >= 10 ? "Buena" : "Mejorable"} · Objetivo: 20%+
      </div>
    </div>
  );
}

/**
 * Small multiples: un gráfico de barras por mes comparando categorías.
 * Principio: "Small multiples" → Faceted charts with shared scales.
 */
export function NivoMonthMultiples({
  months,
}: {
  months: { label: string; categories: { name: string; value: number; color: string }[] }[];
}) {
  const colors = useColors();
  const maxVal = useMemo(() => {
    let max = 0;
    for (const m of months) for (const c of m.categories) if (c.value > max) max = c.value;
    return max || 1;
  }, [months]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
      {months.map((month, mi) => (
        <div key={mi} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: colors.text }}>
            {month.label}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {month.categories.slice(0, 5).map((cat, ci) => (
              <div key={ci} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: 2,
                  background: cat.color, flexShrink: 0,
                }} />
                <div style={{ flex: 1, height: 8, background: colors.grid, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${(cat.value / maxVal) * 100}%`,
                    background: cat.color, borderRadius: 2,
                  }} />
                </div>
                <span style={{ fontSize: 9, color: colors.text, width: 50, textAlign: "right" }}>
                  {formatEUR(cat.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
