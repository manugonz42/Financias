import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

export function EChart({ option, height }: { option: EChartsOption; height?: number | string }) {
  return (
    <ReactECharts
      option={option}
      notMerge
      lazyUpdate
      style={{ height: height ?? "100%", width: "100%" }}
    />
  );
}
