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
  return (
    <ReactECharts
      option={option}
      notMerge
      lazyUpdate
      onEvents={onEvents}
      style={{ height: height ?? "100%", width: "100%" }}
    />
  );
}
