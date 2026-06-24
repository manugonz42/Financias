// Combina el override por widget (settings → key `palette:<widgetKey>`) con la
// paleta global del AppContext. Si no hay override ("inherit"), usa la global.

import { useEffect, useState } from "react";
import { useApp } from "../../state/AppContext";
import { getSetting, setSetting } from "../../data/settings";
import { isPaletteId, paletteColors, type PaletteId } from "../../lib/palettes";

export type PaletteOverride = PaletteId | "inherit";

export interface ChartPalette {
  /** Paleta efectiva ya resuelta (global o override). */
  effectiveId: PaletteId;
  /** Colores a usar; `null` = pintar por categoría / acento por defecto. */
  colors: string[] | null;
  /** Valor del override almacenado (incluye "inherit" para "Usar global"). */
  override: PaletteOverride;
  setOverride: (v: PaletteOverride) => void;
}

function parseOverride(v: string | null | undefined): PaletteOverride {
  if (v === "inherit") return "inherit";
  return isPaletteId(v) ? v : "inherit";
}

export function useChartPalette(widgetKey?: string): ChartPalette {
  const { palette } = useApp();
  const [override, setOverrideState] = useState<PaletteOverride>("inherit");

  useEffect(() => {
    if (!widgetKey) return;
    let cancelled = false;
    void getSetting(`palette:${widgetKey}`).then((v) => {
      if (!cancelled) setOverrideState(parseOverride(v));
    });
    return () => {
      cancelled = true;
    };
  }, [widgetKey]);

  const setOverride = (v: PaletteOverride) => {
    setOverrideState(v);
    if (widgetKey) void setSetting(`palette:${widgetKey}`, v);
  };

  const effectiveId: PaletteId = override === "inherit" ? palette : override;
  return { effectiveId, colors: paletteColors(effectiveId), override, setOverride };
}
