import { describe, it, expect } from "vitest";
import { advanceDate, daysUntil } from "../src/lib/schedule";

describe("advanceDate", () => {
  it("avanza según la frecuencia", () => {
    expect(advanceDate("2026-01-15", "semanal")).toBe("2026-01-22");
    expect(advanceDate("2026-01-15", "mensual")).toBe("2026-02-15");
    expect(advanceDate("2026-01-15", "anual")).toBe("2027-01-15");
  });

  it("maneja fin de mes y cambio de año", () => {
    expect(advanceDate("2026-12-15", "mensual")).toBe("2027-01-15");
  });
});

describe("daysUntil", () => {
  it("cuenta días (negativo si pasó)", () => {
    const today = new Date("2026-06-10T12:00:00");
    expect(daysUntil("2026-06-15", today)).toBe(5);
    expect(daysUntil("2026-06-10", today)).toBe(0);
    expect(daysUntil("2026-06-07", today)).toBe(-3);
  });
});
