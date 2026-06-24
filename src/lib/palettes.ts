// Paletas de color para los gráficos. La opción "categoria" usa el color
// guardado de cada categoría (comportamiento por defecto); las demás son
// secuencias fijas que se aplican por índice.

export type PaletteId = "categoria" | "joya" | "neon" | "pastel" | "curado";

export interface PaletteDef {
  id: PaletteId;
  label: string;
  /** null = usar color por categoría; array = secuencia cíclica por índice. */
  colors: string[] | null;
}

export const PALETTES: PaletteDef[] = [
  { id: "categoria", label: "Categoría", colors: null },
  {
    id: "joya",
    label: "Joya",
    colors: ["#10b981", "#3b82f6", "#e11d48", "#8b5cf6", "#f59e0b", "#14b8a6", "#ec4899", "#0ea5e9", "#84cc16", "#f43f5e"],
  },
  {
    id: "neon",
    label: "Neón",
    colors: ["#22d3ee", "#f472b6", "#a78bfa", "#a3e635", "#fb923c", "#2dd4bf", "#facc15", "#60a5fa", "#fb7185", "#34d399"],
  },
  {
    id: "pastel",
    label: "Pastel",
    colors: ["#86efac", "#93c5fd", "#fca5a5", "#c4b5fd", "#fcd34d", "#5eead4", "#f9a8d4", "#a5b4fc"],
  },
  {
    id: "curado",
    label: "Curado",
    colors: ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac"],
  },
];

export function isPaletteId(v: string | null | undefined): v is PaletteId {
  return !!v && PALETTES.some((p) => p.id === v);
}

/** Devuelve los colores de la paleta o `null` para «por categoría». */
export function paletteColors(id: PaletteId): string[] | null {
  return PALETTES.find((p) => p.id === id)?.colors ?? null;
}

export function paletteLabel(id: PaletteId): string {
  return PALETTES.find((p) => p.id === id)?.label ?? id;
}
