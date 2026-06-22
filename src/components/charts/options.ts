// Constructores de opciones de ECharts con estilo oscuro.

import type { EChartsOption } from "echarts";
import { formatEUR } from "../../lib/format";
import { monthLabelShort } from "../../lib/format";
import type { CategorySlice, MonthlyFlow, BalancePoint, CashPoint } from "../../data/stats";

const AXIS = "#94a3b8";
const GRID_LINE = "#334155";

export function donutOption(slices: CategorySlice[]): EChartsOption {
  return {
    backgroundColor: "transparent",
    textStyle: { color: "#e2e8f0" },
    tooltip: {
      trigger: "item",
      formatter: (p: any) => `${p.name}<br/><b>${formatEUR(p.value)}</b> (${p.percent}%)`,
    },
    legend: {
      type: "scroll",
      orient: "vertical",
      right: 0,
      top: "center",
      textStyle: { color: AXIS, fontSize: 11 },
    },
    series: [
      {
        type: "pie",
        radius: ["45%", "72%"],
        center: ["32%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "#1e293b", borderWidth: 2 },
        label: { show: false },
        data: slices.map((s) => ({
          name: s.name,
          value: +s.value.toFixed(2),
          itemStyle: { color: s.color },
        })),
      },
    ],
  };
}

export function barFlowsOption(rows: MonthlyFlow[]): EChartsOption {
  return {
    backgroundColor: "transparent",
    textStyle: { color: "#e2e8f0" },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: any) => formatEUR(Number(v)),
    },
    legend: { textStyle: { color: AXIS }, top: 0 },
    grid: { left: 50, right: 16, top: 30, bottom: 30 },
    xAxis: {
      type: "category",
      data: rows.map((r) => monthLabelShort(r.month)),
      axisLabel: { color: AXIS, fontSize: 10 },
      axisLine: { lineStyle: { color: GRID_LINE } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: AXIS, formatter: (v: number) => `${Math.round(v)}` },
      splitLine: { lineStyle: { color: GRID_LINE } },
    },
    series: [
      { name: "Gastos", type: "bar", data: rows.map((r) => +r.expense.toFixed(2)), itemStyle: { color: "#ef4444" } },
      { name: "Ingresos", type: "bar", data: rows.map((r) => +r.income.toFixed(2)), itemStyle: { color: "#22c55e" } },
    ],
  };
}

export function lineOption(points: BalancePoint[], name: string, color = "#6366f1"): EChartsOption {
  return {
    backgroundColor: "transparent",
    textStyle: { color: "#e2e8f0" },
    tooltip: { trigger: "axis", valueFormatter: (v: any) => formatEUR(Number(v)) },
    grid: { left: 60, right: 16, top: 20, bottom: 30 },
    xAxis: {
      type: "category",
      data: points.map((p) => monthLabelShort(p.month)),
      axisLabel: { color: AXIS, fontSize: 10 },
      axisLine: { lineStyle: { color: GRID_LINE } },
    },
    yAxis: {
      type: "value",
      scale: true,
      axisLabel: { color: AXIS, formatter: (v: number) => `${Math.round(v)}` },
      splitLine: { lineStyle: { color: GRID_LINE } },
    },
    series: [
      {
        name,
        type: "line",
        smooth: true,
        showSymbol: false,
        data: points.map((p) => +p.saldo.toFixed(2)),
        itemStyle: { color },
        areaStyle: { color: `${color}22` },
      },
    ],
  };
}

export function cashBarOption(rows: CashPoint[]): EChartsOption {
  return {
    backgroundColor: "transparent",
    textStyle: { color: "#e2e8f0" },
    tooltip: {
      trigger: "axis",
      formatter: (ps: any) => {
        const p = ps[0];
        const row = rows[p.dataIndex];
        return `${monthLabelShort(row.month)}<br/><b>${formatEUR(row.total)}</b> · ${row.count} disposiciones`;
      },
    },
    grid: { left: 50, right: 16, top: 16, bottom: 30 },
    xAxis: {
      type: "category",
      data: rows.map((r) => monthLabelShort(r.month)),
      axisLabel: { color: AXIS, fontSize: 10 },
      axisLine: { lineStyle: { color: GRID_LINE } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: AXIS, formatter: (v: number) => `${Math.round(v)}` },
      splitLine: { lineStyle: { color: GRID_LINE } },
    },
    series: [{ name: "Cajero", type: "bar", data: rows.map((r) => +r.total.toFixed(2)), itemStyle: { color: "#0ea5e9" } }],
  };
}
