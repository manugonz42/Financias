// Estilos de relleno+colores seleccionables para los gráficos de barras del
// dashboard. Se eligen desde el botón "Estilo" de la cabecera del widget y se
// persisten por widget (settings → key `barstyle:<widgetKey>`).

export type BarFill = "flat" | "gradient";

export interface BarStyle {
  id: string;
  label: string;
  fill: BarFill;
  /** Color de la barra "pasado". `null` = color intrínseco del gráfico. */
  past: string | null;
  /** Color de la barra "este mes". `null` = color intrínseco del gráfico. */
  now: string | null;
}

// 9 presets → rejilla 3×3 en el selector. Combinaciones de uso común.
export const BAR_STYLES: BarStyle[] = [
  { id: "default", label: "Por defecto", fill: "flat", past: null, now: null },
  { id: "mono", label: "Monocromo", fill: "gradient", past: "var(--text-dim)", now: "var(--text)" },
  { id: "indigo", label: "Índigo", fill: "gradient", past: "#a5b4fc", now: "#5e6ad2" },
  { id: "violet", label: "Verde y morado", fill: "gradient", past: "#4cc38a", now: "#7170ff" },
  { id: "ocean", label: "Océano", fill: "gradient", past: "#38bdf8", now: "#2563eb" },
  { id: "tealamber", label: "Teal y ámbar", fill: "gradient", past: "#2dd4bf", now: "#f59e0b" },
  { id: "sunset", label: "Atardecer", fill: "gradient", past: "#fb7185", now: "#a855f7" },
  { id: "emerald", label: "Esmeralda", fill: "gradient", past: "#6ee7b7", now: "#10b981" },
  { id: "warm", label: "Cálido", fill: "gradient", past: "#fbbf24", now: "#ef4444" },
];

export const DEFAULT_BAR_STYLE = "default";

export function isBarStyleId(v: unknown): v is string {
  return typeof v === "string" && BAR_STYLES.some((s) => s.id === v);
}

export function barStyleById(id: string | null | undefined): BarStyle {
  return BAR_STYLES.find((s) => s.id === id) ?? BAR_STYLES[0];
}
