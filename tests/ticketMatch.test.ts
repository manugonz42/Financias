import { describe, it, expect } from "vitest";
import { matchTicket, ticketTokens, type MatchTx } from "../src/lib/ticketMatch";

const txs: MatchTx[] = [
  { id: 1, fecha: "2026-06-12", importe: -4.34, merchant: "MERCADONA", concepto: "COMPRA EN MERCADONA" },
  { id: 2, fecha: "2026-06-11", importe: -4.34, merchant: "LIDL", concepto: "COMPRA EN LIDL" },
  { id: 3, fecha: "2026-06-12", importe: -20.0, merchant: "REPSOL", concepto: "GASOLINERA" },
  { id: 4, fecha: "2026-06-12", importe: 1000, merchant: null, concepto: "NOMINA" },
];

describe("matchTicket", () => {
  it("prioriza importe que cuadra y, a igualdad, fecha y comercio", () => {
    const res = matchTicket({ date: "2026-06-12", total: 4.34, text: "MERCADONA S.A. LECHE PAN" }, txs);
    // Solo los de importe 4,34 son candidatos (id 1 y 2); el 3 y 4 quedan fuera.
    expect(res.map((r) => r.tx.id)).toEqual([1, 2]);
    // El 1 gana: misma fecha + coincide "mercadona".
    expect(res[0].tx.id).toBe(1);
  });

  it("descarta ingresos y movimientos sin importe coincidente", () => {
    const res = matchTicket({ date: "2026-06-12", total: 20.0, text: "REPSOL" }, txs);
    expect(res.map((r) => r.tx.id)).toEqual([3]);
  });

  it("sin total, empareja por fecha+palabras dentro de la ventana", () => {
    const res = matchTicket({ date: "2026-06-12", total: null, text: "MERCADONA" }, txs);
    expect(res[0].tx.id).toBe(1);
  });
});

describe("ticketTokens", () => {
  it("normaliza (mayúsculas, sin acentos) y filtra palabras cortas", () => {
    expect(ticketTokens("Café S.A. 12 MERCADONA")).toContain("MERCADONA");
    expect(ticketTokens("Café S.A. 12")).not.toContain("12");
  });
});
