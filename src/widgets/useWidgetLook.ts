// Combina el override por widget (settings → clave `look:<widgetKey>`) con el
// estilo global del AppContext. Si no hay override ("inherit"), usa el global.
// Espejo de `useChartPalette` (src/components/charts/useChartPalette.ts).

import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import { getSetting, setSetting } from "../data/settings";
import { isWidgetLook, type WidgetLook } from "../lib/widgetLook";

export type LookOverride = WidgetLook | "inherit";

export interface WidgetLookState {
  /** Estilo efectivo ya resuelto (global u override). */
  look: WidgetLook;
  /** Valor del override almacenado (incluye "inherit" para "Usar global"). */
  override: LookOverride;
  setOverride: (v: LookOverride) => void;
}

function parseOverride(v: string | null | undefined): LookOverride {
  if (v === "inherit") return "inherit";
  return isWidgetLook(v) ? v : "inherit";
}

export function useWidgetLook(widgetKey?: string): WidgetLookState {
  const { widgetLook } = useApp();
  const [override, setOverrideState] = useState<LookOverride>("inherit");

  useEffect(() => {
    if (!widgetKey) return;
    let cancelled = false;
    void getSetting(`look:${widgetKey}`).then((v) => {
      if (!cancelled) setOverrideState(parseOverride(v));
    });
    return () => {
      cancelled = true;
    };
  }, [widgetKey]);

  const setOverride = (v: LookOverride) => {
    setOverrideState(v);
    if (widgetKey) void setSetting(`look:${widgetKey}`, v);
  };

  const look: WidgetLook = override === "inherit" ? widgetLook : override;
  return { look, override, setOverride };
}
