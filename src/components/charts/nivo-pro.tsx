// Gráficos "pro" auto-contenidos en SVG, con tres estilos conmutables por
// `WidgetLook` (minimal | colorful | aurora). Se dibujan a mano (sin depender de
// la API de Nivo salvo el sunburst) para controlar degradados, glow y
// animaciones de entrada de forma coherente entre estilos.

import { useEffect, useId, useRef, useState } from "react";
import { ResponsiveSunburst } from "@nivo/sunburst";
import { formatEUR } from "../../lib/format";
import { VIZ_PALETTE, type WidgetLook } from "../../lib/widgetLook";
import type { SunburstNode } from "../../lib/donut";

/* ---------- utilidades compartidas ---------- */

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Inyecta (una vez) las animaciones de entrada de los gráficos pro. */
if (typeof document !== "undefined" && !document.getElementById("pro-chart-styles")) {
  const el = document.createElement("style");
  el.id = "pro-chart-styles";
  el.textContent = `
@keyframes proDraw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes proFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes proRise { from { transform: scaleY(0.001); } to { transform: scaleY(1); } }
@keyframes proGrowX { from { transform: scaleX(0.001); } to { transform: scaleX(1); } }
.pro-line { stroke-dasharray: 1; animation: proDraw 900ms cubic-bezier(0.16,1,0.3,1) both; }
.pro-fade { animation: proFadeUp 500ms cubic-bezier(0.16,1,0.3,1) both; }
.pro-bar { transform-box: fill-box; transform-origin: bottom; animation: proRise 650ms cubic-bezier(0.16,1,0.3,1) both; }
.pro-hbar { transform-box: fill-box; transform-origin: left center; animation: proGrowX 650ms cubic-bezier(0.16,1,0.3,1) both; }
.pro-glow { filter: drop-shadow(0 0 6px currentColor); }
@media (prefers-reduced-motion: reduce) {
  .pro-line, .pro-fade, .pro-bar, .pro-hbar { animation: none !important; stroke-dasharray: none !important; }
}`;
  document.head.appendChild(el);
}

/** Mide el contenedor (ResizeObserver) para dibujar el SVG a tamaño real. */
function useMeasure() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ width: Math.round(r.width), height: Math.round(r.height) });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

/** Etiqueta compacta para ejes: 1234 → "1,2k". Sin símbolo para ahorrar sitio. */
function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1000) {
    const v = n / 1000;
    return `${v.toFixed(a >= 10000 ? 0 : 1)}k`.replace(".", ",");
  }
  return `${Math.round(n)}`;
}

/** Path suave (Catmull-Rom → Bézier) a partir de puntos [x,y]. */
function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  if (pts.length < 3) return "M" + pts.map((p) => `${p[0]},${p[1]}`).join(" L");
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

interface Tokens {
  text: string;
  dim: string;
  grid: string;
  card: string;
}
function baseTokens(): Tokens {
  return {
    text: cssVar("--text", "#e5e7eb"),
    dim: cssVar("--text-dim", "#94a3b8"),
    grid: cssVar("--border", "#334155"),
    card: cssVar("--bg-card", "#0f172a"),
  };
}

/* ============================================================= *
 *  ProLineChart — línea/área (saldo, liquidez, tendencia)       *
 * ============================================================= */

export interface LineSeries {
  id: string;
  values: number[];
  /** Color base; si se omite se deriva del estilo. */
  color?: string;
  dashed?: boolean;
  /** No rellena área bajo la curva (p.ej. la línea de tendencia). */
  noArea?: boolean;
}

export interface ProLineProps {
  labels: string[];
  series: LineSeries[];
  look: WidgetLook;
  /** Gradiente para el estilo aurora [inicio, fin]; si se omite usa indigo→cian. */
  gradient?: [string, string];
  /** El eje Y arranca en 0 (para gasto). Por defecto se ajusta al rango. */
  zeroBased?: boolean;
  valueFmt?: (n: number) => string;
}

export function ProLineChart({ labels, series, look, gradient, zeroBased, valueFmt }: ProLineProps) {
  const { ref, width, height } = useMeasure();
  const uid = useId().replace(/:/g, "");
  const t = baseTokens();
  const fmt = valueFmt ?? formatEUR;

  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 22;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = Math.max(0, height - padT - padB);

  const all = series.flatMap((s) => s.values);
  if (width === 0 || height === 0 || all.length === 0) {
    return <div ref={ref} style={{ width: "100%", height: "100%" }} />;
  }

  let yMin = Math.min(...all);
  let yMax = Math.max(...all);
  if (zeroBased) yMin = Math.min(0, yMin);
  if (yMin === yMax) {
    yMax += Math.abs(yMax || 1) * 0.1;
    yMin -= Math.abs(yMin || 1) * 0.1;
  } else {
    const pad = (yMax - yMin) * 0.08;
    yMax += pad;
    if (!zeroBased) yMin -= pad;
  }

  const n = labels.length;
  const sx = (i: number) => (n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const sy = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const grad: [string, string] = gradient ?? ["#818cf8", "#22d3ee"];
  const ticks = [yMin, (yMin + yMax) / 2, yMax];

  // Etiquetas del eje X: primera, central y última para no saturar.
  const xIdx = n <= 6 ? labels.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      <svg width={width} height={height} role="img">
        <defs>
          <linearGradient id={`stroke-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={grad[0]} />
            <stop offset="100%" stopColor={grad[1]} />
          </linearGradient>
          <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={grad[0]} stopOpacity={0.35} />
            <stop offset="100%" stopColor={grad[1]} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* rejilla + ticks Y */}
        {ticks.map((v, i) => (
          <g key={i}>
            <line
              x1={padL}
              y1={sy(v)}
              x2={width - padR}
              y2={sy(v)}
              stroke={t.grid}
              strokeWidth={1}
              strokeDasharray="2 4"
              opacity={look === "minimal" ? 0.5 : 0.7}
            />
            <text x={padL - 6} y={sy(v) + 3} textAnchor="end" fontSize={9} fontFamily="var(--font-mono)" fill={t.dim}>
              {compact(v)}
            </text>
          </g>
        ))}

        {/* etiquetas X */}
        {xIdx.map((i) => (
          <text key={i} x={sx(i)} y={height - 6} textAnchor="middle" fontSize={9} fontFamily="var(--font-mono)" fill={t.dim}>
            {labels[i]}
          </text>
        ))}

        {series.map((s, si) => {
          const pts = s.values.map((v, i) => [sx(i), sy(v)] as [number, number]);
          const line = smoothPath(pts);
          const baseline = sy(zeroBased ? 0 : yMin);
          const area = `${line} L ${pts[pts.length - 1][0]},${baseline} L ${pts[0][0]},${baseline} Z`;

          // Color por estilo.
          const stroke =
            s.color ??
            (look === "minimal" ? (si === 0 ? t.text : t.dim) : look === "colorful" ? VIZ_PALETTE[si % VIZ_PALETTE.length] : undefined);
          const strokeRef = look === "aurora" && !s.color ? `url(#stroke-${uid})` : stroke;
          const strokeW = look === "minimal" ? 1.75 : look === "colorful" ? 2.25 : 2.75;
          const showArea = !s.noArea && si === 0;
          const areaFill =
            look === "aurora" ? `url(#area-${uid})` : look === "colorful" ? (stroke ?? VIZ_PALETTE[0]) : t.text;
          const areaOpacity = look === "aurora" ? 1 : look === "colorful" ? 0.14 : 0.05;

          return (
            <g key={s.id}>
              {showArea && <path className="pro-fade" d={area} fill={areaFill} fillOpacity={areaOpacity} stroke="none" />}
              {/* glow aurora: copia difuminada detrás */}
              {look === "aurora" && !s.dashed && (
                <path
                  d={line}
                  fill="none"
                  stroke={strokeRef}
                  strokeWidth={strokeW + 3}
                  strokeLinecap="round"
                  opacity={0.5}
                  style={{ filter: "blur(6px)" }}
                />
              )}
              <path
                className="pro-line"
                pathLength={1}
                d={line}
                fill="none"
                stroke={strokeRef}
                strokeWidth={strokeW}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={s.dashed ? "5 5" : undefined}
                style={s.dashed ? { animation: "none" } : { animationDelay: `${si * 120}ms` }}
                opacity={s.dashed ? 0.85 : 1}
              />
              {/* puntos (colorful/aurora, no en la tendencia) */}
              {look !== "minimal" &&
                !s.dashed &&
                pts.map((p, i) => (
                  <circle key={i} cx={p[0]} cy={p[1]} r={look === "aurora" ? 3 : 2.5} fill={t.card} stroke={strokeRef} strokeWidth={1.5}>
                    <title>{`${labels[i]}: ${fmt(s.values[i])}`}</title>
                  </circle>
                ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ============================================================= *
 *  ProBars — barras verticales, 1 o 2 series (efectivo, flujos) *
 * ============================================================= */

export interface BarSegment {
  key: string;
  value: number;
  color: string;
}
export interface BarGroup {
  label: string;
  segments: BarSegment[];
}

export interface ProBarsProps {
  groups: BarGroup[];
  look: WidgetLook;
  valueFmt?: (n: number) => string;
}

export function ProBars({ groups, look, valueFmt }: ProBarsProps) {
  const { ref, width, height } = useMeasure();
  const uid = useId().replace(/:/g, "");
  const t = baseTokens();
  const fmt = valueFmt ?? formatEUR;

  const padL = 40;
  const padR = 10;
  const padT = 14;
  const padB = 22;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = Math.max(0, height - padT - padB);

  const all = groups.flatMap((g) => g.segments.map((s) => s.value));
  if (width === 0 || height === 0 || all.length === 0) {
    return <div ref={ref} style={{ width: "100%", height: "100%" }} />;
  }
  const yMax = Math.max(...all) * 1.12 || 1;
  const sy = (v: number) => padT + (1 - v / yMax) * plotH;
  const segCount = Math.max(1, groups[0]?.segments.length ?? 1);

  const nG = groups.length;
  const groupW = plotW / nG;
  const barsW = Math.min(groupW * 0.7, 54);
  const barGap = 3;
  const barW = (barsW - barGap * (segCount - 1)) / segCount;
  const baseY = sy(0);
  const showLabels = nG <= 10;
  const ticks = [0, yMax / 2, yMax];

  const uniqueColors = [...new Set(groups.flatMap((g) => g.segments.map((s) => s.color)))];

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      <svg width={width} height={height} role="img">
        <defs>
          {look === "aurora" &&
            uniqueColors.map((c, i) => (
              <linearGradient key={i} id={`bar-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity={1} />
                <stop offset="100%" stopColor={c} stopOpacity={0.35} />
              </linearGradient>
            ))}
        </defs>

        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={sy(v)} x2={width - padR} y2={sy(v)} stroke={t.grid} strokeWidth={1} strokeDasharray="2 4" opacity={0.6} />
            <text x={padL - 6} y={sy(v) + 3} textAnchor="end" fontSize={9} fontFamily="var(--font-mono)" fill={t.dim}>
              {compact(v)}
            </text>
          </g>
        ))}

        {groups.map((g, gi) => {
          const gx = padL + gi * groupW + (groupW - barsW) / 2;
          return (
            <g key={gi}>
              {g.segments.map((s, si) => {
                const x = gx + si * (barW + barGap);
                const h = Math.max(0, baseY - sy(s.value));
                const y = baseY - h;
                const fill =
                  look === "aurora"
                    ? `url(#bar-${uid}-${uniqueColors.indexOf(s.color)})`
                    : look === "minimal"
                      ? s.color
                      : s.color;
                return (
                  <g key={si}>
                    {look === "aurora" && (
                      <rect x={x} y={y} width={barW} height={h} rx={4} fill={s.color} opacity={0.5} style={{ filter: "blur(5px)" }} pointerEvents="none" />
                    )}
                    <rect
                      className="pro-bar"
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      rx={look === "minimal" ? 2 : 4}
                      fill={fill}
                      fillOpacity={look === "minimal" ? 0.85 : 1}
                      style={{ animationDelay: `${gi * 50 + si * 30}ms` }}
                    >
                      <title>{`${g.label} · ${s.key}: ${fmt(s.value)}`}</title>
                    </rect>
                  </g>
                );
              })}
              {showLabels && segCount === 1 && (
                <text x={gx + barsW / 2} y={sy(g.segments[0].value) - 5} textAnchor="middle" fontSize={9} fontFamily="var(--font-mono)" fill={t.dim}>
                  {compact(g.segments[0].value)}
                </text>
              )}
              <text x={padL + gi * groupW + groupW / 2} y={height - 6} textAnchor="middle" fontSize={9} fontFamily="var(--font-mono)" fill={t.dim}>
                {g.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ============================================================= *
 *  ProRankBars — ranking horizontal con comparación (ahora/prev)*
 * ============================================================= */

export interface RankRow {
  id: number;
  label: string;
  now: number;
  prev: number;
  color: string;
}

export interface ProRankBarsProps {
  rows: RankRow[];
  look: WidgetLook;
}

export function ProRankBars({ rows, look }: ProRankBarsProps) {
  const { ref, width, height } = useMeasure();
  const uid = useId().replace(/:/g, "");
  const t = baseTokens();

  if (width === 0 || rows.length === 0) {
    return <div ref={ref} style={{ width: "100%", height: "100%" }} />;
  }

  const labelW = Math.min(96, Math.max(64, width * 0.28));
  const valueW = 58;
  const padR = 12;
  const trackX = labelW + 6;
  const trackW = Math.max(10, width - trackX - valueW - padR);
  const max = Math.max(...rows.flatMap((r) => [r.now, r.prev])) || 1;
  const rowH = Math.max(22, Math.min(40, height / rows.length));

  return (
    <div ref={ref} style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <svg width={width} height={rows.length * rowH} role="img">
        <defs>
          {look === "aurora" &&
            rows.map((r, i) => (
              <linearGradient key={i} id={`rank-${uid}-${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={r.color} stopOpacity={0.7} />
                <stop offset="100%" stopColor={r.color} stopOpacity={1} />
              </linearGradient>
            ))}
        </defs>
        {rows.map((r, i) => {
          const cy = i * rowH + rowH / 2;
          const barH = Math.min(12, rowH * 0.42);
          const nowW = (r.now / max) * trackW;
          const prevX = trackX + (r.prev / max) * trackW;
          const delta = r.prev > 0 ? ((r.now - r.prev) / r.prev) * 100 : r.now > 0 ? 100 : 0;
          const up = r.now > r.prev;
          const fill =
            look === "aurora" ? `url(#rank-${uid}-${i})` : look === "minimal" ? t.text : r.color;
          return (
            <g key={r.id}>
              <text x={labelW} y={cy + 3} textAnchor="end" fontSize={11} fill={t.text} className="pro-fade" style={{ animationDelay: `${i * 40}ms` }}>
                {r.label.length > 14 ? r.label.slice(0, 13) + "…" : r.label}
              </text>
              {/* pista */}
              <rect x={trackX} y={cy - barH / 2} width={trackW} height={barH} rx={barH / 2} fill={t.grid} opacity={0.25} />
              {/* barra "ahora" */}
              <rect
                className="pro-hbar"
                x={trackX}
                y={cy - barH / 2}
                width={Math.max(2, nowW)}
                height={barH}
                rx={barH / 2}
                fill={fill}
                fillOpacity={look === "minimal" ? 0.8 : 1}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <title>{`${r.label} — ahora ${formatEUR(r.now)} · antes ${formatEUR(r.prev)}`}</title>
              </rect>
              {/* marca del periodo anterior */}
              {r.prev > 0 && (
                <line x1={prevX} y1={cy - barH / 2 - 3} x2={prevX} y2={cy + barH / 2 + 3} stroke={t.dim} strokeWidth={1.5} strokeDasharray="2 2" />
              )}
              {/* valor + variación */}
              <text x={width - padR} y={cy - 1} textAnchor="end" fontSize={10} fontFamily="var(--font-mono)" fill={t.text}>
                {compact(r.now)}
              </text>
              <text
                x={width - padR}
                y={cy + 10}
                textAnchor="end"
                fontSize={9}
                fontFamily="var(--font-mono)"
                fill={up ? cssVar("--bad", "#ef4444") : cssVar("--good", "#22c55e")}
              >
                {`${up ? "▲" : "▼"} ${Math.abs(delta).toFixed(0)}%`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ============================================================= *
 *  ProSunburstChart — jerarquía de categorías (envuelve Nivo)   *
 * ============================================================= */

export function ProSunburstChart({ root, look }: { root: SunburstNode; look: WidgetLook }) {
  const t = baseTokens();
  const border = cssVar("--bg-card", "#0f172a");

  // Escala de grises por profundidad para el estilo minimalista.
  const grays = ["#3f3f46", "#5b5f63", "#7c8085", "#9aa0a6", "#b8bec4"];

  const colorFn = (node: { depth?: number; data?: { color?: string } }): string => {
    if (look === "minimal") return grays[Math.min(grays.length - 1, node.depth ?? 0)];
    return node.data?.color || (look === "colorful" ? VIZ_PALETTE[0] : "#818cf8");
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        filter: look === "aurora" ? "drop-shadow(0 0 10px rgba(129,140,248,0.35))" : undefined,
      }}
    >
      <ResponsiveSunburst
        data={root}
        margin={{ top: 6, right: 6, bottom: 6, left: 6 }}
        id="id"
        value="value"
        cornerRadius={look === "minimal" ? 0 : 3}
        borderColor={border}
        borderWidth={look === "minimal" ? 1 : 2}
        colors={colorFn}
        inheritColorFromParent={look !== "minimal"}
        childColor={
          look === "aurora"
            ? { from: "color", modifiers: [["brighter", 0.3]] }
            : { from: "color", modifiers: [["opacity", 0.85]] }
        }
        enableArcLabels
        arcLabelsSkipAngle={16}
        arcLabelsTextColor={{ from: "color", modifiers: [["darker", look === "minimal" ? 2.4 : 1.6]] }}
        animate
        motionConfig="gentle"
        transitionMode="pushIn"
        tooltip={(node: { id: string | number; value: string | number; color: string }) => (
          <div
            style={{
              background: t.card,
              color: t.text,
              border: `1px solid ${t.grid}`,
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: node.color, marginRight: 6 }} />
            {node.id}: <b>{formatEUR(Number(node.value))}</b>
          </div>
        )}
      />
    </div>
  );
}

/* ============================================================= *
 *  ProSparkline — mini línea sin ejes (para KPIs)               *
 * ============================================================= */

export function ProSparkline({ values, look, color }: { values: number[]; look: WidgetLook; color?: string }) {
  const { ref, width, height } = useMeasure();
  const uid = useId().replace(/:/g, "");
  const t = baseTokens();
  if (width === 0 || values.length < 2) return <div ref={ref} style={{ width: "100%", height: "100%" }} />;

  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sx = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const sy = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (height - pad * 2);
  const pts = values.map((v, i) => [sx(i), sy(v)] as [number, number]);
  const line = smoothPath(pts);
  const stroke = color ?? (look === "colorful" ? VIZ_PALETTE[0] : look === "aurora" ? `url(#spark-${uid})` : t.dim);
  const area = `${line} L ${pts[pts.length - 1][0]},${height - pad} L ${pts[0][0]},${height - pad} Z`;

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      <svg width={width} height={height} role="img">
        <defs>
          <linearGradient id={`spark-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        {look !== "minimal" && <path d={area} fill={color ?? "#818cf8"} fillOpacity={0.12} stroke="none" />}
        <path className="pro-line" pathLength={1} d={line} fill="none" stroke={stroke} strokeWidth={look === "aurora" ? 2 : 1.5} strokeLinecap="round" />
      </svg>
    </div>
  );
}
