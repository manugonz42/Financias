// Estilo de barras por widget (settings → key `barstyle:<widgetKey>`).
// Espejo de `useChartPalette`: carga el override guardado y lo persiste al cambiar.

import { useEffect, useState } from "react";
import { getSetting, setSetting } from "../../data/settings";
import { barStyleById, isBarStyleId, DEFAULT_BAR_STYLE, type BarStyle } from "../../lib/barStyles";

export interface ChartBarStyle {
  id: string;
  style: BarStyle;
  setStyle: (id: string) => void;
}

export function useBarStyle(widgetKey?: string): ChartBarStyle {
  const [id, setId] = useState<string>(DEFAULT_BAR_STYLE);

  useEffect(() => {
    if (!widgetKey) return;
    let cancelled = false;
    void getSetting(`barstyle:${widgetKey}`).then((v) => {
      if (!cancelled) setId(isBarStyleId(v) ? v : DEFAULT_BAR_STYLE);
    });
    return () => {
      cancelled = true;
    };
  }, [widgetKey]);

  const setStyle = (v: string) => {
    setId(v);
    if (widgetKey) void setSetting(`barstyle:${widgetKey}`, v);
  };

  return { id, style: barStyleById(id), setStyle };
}
