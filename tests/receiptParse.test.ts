import { describe, it, expect } from "vitest";
import { parseReceipt, parseAmount } from "../src/lib/receiptParse";

describe("parseAmount", () => {
  it("interpreta formatos es/en", () => {
    expect(parseAmount("12,34")).toBeCloseTo(12.34);
    expect(parseAmount("1.234,56")).toBeCloseTo(1234.56);
    expect(parseAmount("1234.56")).toBeCloseTo(1234.56);
    expect(parseAmount("3,50 €")).toBeCloseTo(3.5);
  });
});

describe("parseReceipt", () => {
  it("saca productos y fecha, ignorando totales/IVA", () => {
    const lines = [
      "MERCADONA S.A.",
      "12/06/2026  18:42",
      "LECHE ENTERA 1L      1,15",
      "PAN RUSTICO          0,89",
      "PLATANOS             2,30 €",
      "SUBTOTAL             4,34",
      "IVA 4%               0,17",
      "TOTAL                4,34",
      "TARJETA              4,34",
    ];
    const { items, date, total } = parseReceipt(lines);
    expect(date).toBe("2026-06-12");
    expect(total).toBeCloseTo(4.34);
    expect(items.map((i) => i.description)).toEqual(["LECHE ENTERA 1L", "PAN RUSTICO", "PLATANOS"]);
    expect(items[0].amount).toBeCloseTo(1.15);
    expect(items[2].amount).toBeCloseTo(2.3);
    // no incluye SUBTOTAL/IVA/TOTAL/TARJETA
    expect(items).toHaveLength(3);
  });

  it("descarta líneas sin importe o sin descripción", () => {
    const { items } = parseReceipt(["Gracias por su compra", "   ", "9,99"]);
    expect(items).toHaveLength(0);
  });
});
