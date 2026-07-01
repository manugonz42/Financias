// Estilo visual de los widgets "pro" del dashboard. Cada widget se puede pintar
// en tres versiones conmutables:
//   - "minimal"  → editorial monocromo (skill minimalist-ui): plano, sin
//                  degradados, líneas finas, cifras en mono.
//   - "colorful" → color con propósito (skill data-visualization): paleta
//                  colorblind-friendly, azul/naranja como par primario.
//   - "aurora"   → degradados, glow y animaciones de entrada.

export type WidgetLook = "minimal" | "colorful" | "aurora";

export const WIDGET_LOOKS: WidgetLook[] = ["minimal", "colorful", "aurora"];

export const DEFAULT_WIDGET_LOOK: WidgetLook = "minimal";

export function isWidgetLook(v: string | null | undefined): v is WidgetLook {
  return v === "minimal" || v === "colorful" || v === "aurora";
}

export function widgetLookLabel(l: WidgetLook): string {
  switch (l) {
    case "minimal":
      return "Minimalista";
    case "colorful":
      return "Colorido";
    case "aurora":
      return "Degradado";
  }
}

/** Etiqueta de una sola letra para el botón de la cabecera. */
export function widgetLookGlyph(l: WidgetLook): string {
  switch (l) {
    case "minimal":
      return "◦";
    case "colorful":
      return "◆";
    case "aurora":
      return "✦";
  }
}

/** Siguiente estilo en el ciclo minimal → colorful → aurora → minimal. */
export function nextWidgetLook(l: WidgetLook): WidgetLook {
  const i = WIDGET_LOOKS.indexOf(l);
  return WIDGET_LOOKS[(i + 1) % WIDGET_LOOKS.length];
}

/**
 * Paleta categórica colorblind-friendly (skill data-visualization). Par
 * primario azul/naranja en vez de rojo/verde. Se usa en el estilo "colorful".
 */
export const VIZ_PALETTE = [
  "#4C72B0",
  "#DD8452",
  "#55A868",
  "#C44E52",
  "#8172B3",
  "#937860",
  "#DA8BC3",
  "#8C8C8C",
  "#CCB974",
  "#64B5CD",
];

/**
 * Par semántico ingreso/gasto por estilo. En "colorful" se evita rojo/verde
 * (accesibilidad) usando azul/naranja; el resto usa los colores intrínsecos.
 */
export function flowColors(look: WidgetLook): { income: string; expense: string } {
  if (look === "colorful") return { income: "#4C72B0", expense: "#DD8452" };
  if (look === "aurora") return { income: "#34d399", expense: "#fb7185" };
  // Minimal: tonos editoriales apagados (skill minimalist-ui), no verde/rojo vivos.
  return { income: "#346538", expense: "#9F2F2D" };
}
