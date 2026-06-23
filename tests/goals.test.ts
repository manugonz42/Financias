import { describe, it, expect } from "vitest";
import { goalPercent, monthlyTarget } from "../src/lib/goals";

describe("goalPercent", () => {
  it("acota entre 0 y 100", () => {
    expect(goalPercent(50, 200)).toBe(25);
    expect(goalPercent(300, 200)).toBe(100);
    expect(goalPercent(10, 0)).toBe(0);
  });
});

describe("monthlyTarget", () => {
  it("reparte lo que falta entre los meses hasta la fecha", () => {
    const today = new Date("2026-01-01T00:00:00");
    // ~6 meses hasta julio; faltan 600 → ~100/mes.
    const pace = monthlyTarget(600, "2026-07-01", today)!;
    expect(pace).toBeGreaterThan(90);
    expect(pace).toBeLessThan(110);
  });

  it("devuelve null sin fecha, ya conseguida o fecha pasada", () => {
    const today = new Date("2026-06-01T00:00:00");
    expect(monthlyTarget(600, null, today)).toBeNull();
    expect(monthlyTarget(0, "2026-12-01", today)).toBeNull();
    expect(monthlyTarget(600, "2026-01-01", today)).toBeNull();
  });
});
