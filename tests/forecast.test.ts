import { describe, it, expect } from "vitest";
import {
  meanAndStddev,
  projectMonthlyFlows,
  detectRisks,
  projectGoal,
  projectDailyLiquidity,
} from "../src/lib/forecast";
import type { FlowPoint } from "../src/lib/forecast";

describe("meanAndStddev", () => {
  it("calcula media y desviación", () => {
    const { mean, stddev } = meanAndStddev([10, 12, 14, 16, 18]);
    expect(mean).toBe(14);
    expect(stddev).toBeGreaterThan(0);
  });

  it("devuelve 0 para array vacío", () => {
    expect(meanAndStddev([])).toEqual({ mean: 0, stddev: 0 });
  });

  it("desviación 0 con un solo elemento", () => {
    expect(meanAndStddev([5])).toEqual({ mean: 5, stddev: 0 });
  });
});

describe("projectMonthlyFlows", () => {
  const hist: FlowPoint[] = [
    { month: "2026-01", income: 2000, expense: 1500, net: 500 },
    { month: "2026-02", income: 2000, expense: 1400, net: 600 },
    { month: "2026-03", income: 2100, expense: 1600, net: 500 },
    { month: "2026-04", income: 2000, expense: 1450, net: 550 },
    { month: "2026-05", income: 2050, expense: 1500, net: 550 },
    { month: "2026-06", income: 2000, expense: 1400, net: 600 },
  ];

  it("devuelve histórico y proyección", () => {
    const result = projectMonthlyFlows(hist, 3);
    expect(result.historical).toHaveLength(6);
    expect(result.projected).toHaveLength(3);
    expect(result.projected[0].projected).toBe(true);
  });

  it("la banda es >= 0", () => {
    const result = projectMonthlyFlows(hist, 3);
    expect(result.bandPct).toBeGreaterThanOrEqual(0);
    expect(result.bandPct).toBeLessThanOrEqual(0.5);
  });

  it("proyección tiene low < net < high", () => {
    const result = projectMonthlyFlows(hist, 3);
    for (const p of result.projected) {
      expect(p.low).toBeLessThanOrEqual(p.net);
      expect(p.high).toBeGreaterThanOrEqual(p.net);
    }
  });

  it("con hist vacío devuelve todo a 0", () => {
    const result = projectMonthlyFlows([], 3);
    expect(result.historical).toHaveLength(0);
    expect(result.projected).toHaveLength(0);
  });
});

describe("detectRisks", () => {
  const forecast = projectMonthlyFlows([
    { month: "2026-01", income: 2000, expense: 1500, net: 500 },
    { month: "2026-02", income: 2000, expense: 1400, net: 600 },
    { month: "2026-03", income: 2100, expense: 1600, net: 500 },
  ], 3);

  it("detecta saldo negativo", () => {
    const risks = detectRisks(forecast, -2000);
    expect(risks.some((r) => r.type === "low_balance")).toBe(true);
  });

  it("devuelve array con max 5 items", () => {
    const risks = detectRisks(forecast, -10000);
    expect(risks.length).toBeLessThanOrEqual(5);
  });
});

describe("projectGoal", () => {
  it("calcula estimatedDate con ahorro positivo", () => {
    const goal = { id: 1, name: "Viaje", target_amount: 3000, current_amount: 1000, target_date: "2027-01-01" };
    const result = projectGoal(goal, 200);
    expect(result.remaining).toBe(2000);
    expect(result.estimatedDate).not.toBeNull();
    expect(result.monthlyNeeded).toBeGreaterThan(0);
  });

  it("remaining 0 si ya está conseguida", () => {
    const goal = { id: 1, name: "Viaje", target_amount: 1000, current_amount: 1000, target_date: null };
    const result = projectGoal(goal, 200);
    expect(result.remaining).toBe(0);
    expect(result.progressPct).toBe(100);
  });
});

describe("projectDailyLiquidity", () => {
  it("genera daysAhead + 1 puntos", () => {
    const days = projectDailyLiquidity(1000, 10, 30);
    expect(days).toHaveLength(31);
    expect(days[0].isProjected).toBe(false);
    expect(days[1].isProjected).toBe(true);
  });

  it("saldo inicial es el primero", () => {
    const days = projectDailyLiquidity(5000, 0, 10);
    expect(days[0].balance).toBe(5000);
  });
});
