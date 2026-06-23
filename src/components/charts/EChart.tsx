import { useEffect, useRef } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

type EventHandlers = Record<string, (params: any) => void>;

export function EChart({
  option,
  height,
  onEvents,
}: {
  option: EChartsOption;
  height?: number | string;
  onEvents?: EventHandlers;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  // Reajusta el gráfico cuando su contenedor cambia de tamaño (p. ej. al
  // redimensionar el widget en la rejilla), evitando que el lienzo/leyenda
  // se salga del widget.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      chartRef.current?.getEchartsInstance?.()?.resize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} style={{ height: height ?? "100%", width: "100%", overflow: "hidden" }}>
      <ReactECharts
        ref={chartRef}
        option={option}
        notMerge
        lazyUpdate
        onEvents={onEvents}
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}
