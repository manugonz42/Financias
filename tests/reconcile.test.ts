import { describe, it, expect } from "vitest";
import { matchTransfers, type Row } from "../src/data/reconcile";

// Cuentas: 1 = Nómina, 2 = Ahorro, 3 = Unicaja.
const r = (
  id: number,
  account_id: number,
  fecha: string,
  importe: number,
  is_internal = 0,
  category_id: number | null = null,
): Row => ({ id, account_id, fecha_operacion: fecha, importe, is_internal, category_id });

/** Ordena las marcas para comparaciones estables en los tests. */
const sortMarks = (m: Array<[number, number]>) =>
  [...m].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

const win = (windowDays: number) => ({ windowDays });

describe("matchTransfers — traspasos entre cuentas por importe", () => {
  it("marca el ingreso de Unicaja aunque la salida ya sea interna por el titular", () => {
    // Caso real: la salida de Openbank ya viene marcada interna ("A FAVOR DE
    // <titular>"); el ingreso en Unicaja, sin nombre, seguía contando.
    const rows = [
      r(1, 1, "2026-01-10", -700, 1), // salida Openbank YA interna
      r(2, 3, "2026-01-12", 700, 0), // ingreso Unicaja sin marcar
    ];
    // Solo se marca el ingreso (la salida ya estaba excluida).
    expect(matchTransfers(rows, win(7))).toEqual([[2, 1]]);
  });

  it("marca ambos lados cuando ninguno estaba marcado", () => {
    const rows = [r(1, 1, "2026-01-10", -700, 0), r(2, 3, "2026-01-12", 700, 0)];
    expect(sortMarks(matchTransfers(rows, win(7)))).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });

  it("cubre el sentido inverso: salida en Unicaja contra ingreso ya interno", () => {
    const rows = [
      r(1, 1, "2026-01-11", 500, 1), // ingreso Openbank YA interno
      r(2, 3, "2026-01-10", -500, 0), // salida Unicaja sin marcar
    ];
    expect(matchTransfers(rows, win(7))).toEqual([[2, 1]]);
  });

  it("no empareja fuera de la ventana de días", () => {
    const rows = [r(1, 1, "2026-01-01", -700, 1), r(2, 3, "2026-01-20", 700, 0)];
    expect(matchTransfers(rows, win(7))).toEqual([]);
  });

  it("no empareja importes distintos sin tolerancia", () => {
    const rows = [r(1, 1, "2026-01-10", -700, 1), r(2, 3, "2026-01-11", 650, 0)];
    expect(matchTransfers(rows, win(7))).toEqual([]);
  });

  it("con tolerancia, empareja importes casi iguales (comisión de transferencia)", () => {
    const rows = [
      r(1, 1, "2026-01-10", -700, 1), // salida 700
      r(2, 3, "2026-01-11", 698.5, 0), // llega 698,50 (1,50 de comisión)
    ];
    expect(matchTransfers(rows, { windowDays: 7, amountTolerance: 2 })).toEqual([[2, 1]]);
    expect(matchTransfers(rows, { windowDays: 7, amountTolerance: 1 })).toEqual([]);
  });

  it("no empareja dentro de la misma cuenta", () => {
    const rows = [r(1, 3, "2026-01-10", -700, 1), r(2, 3, "2026-01-11", 700, 0)];
    expect(matchTransfers(rows, win(7))).toEqual([]);
  });

  it("no empareja categorías excluidas (p. ej. la hipoteca)", () => {
    const rows = [
      r(1, 3, "2026-01-10", -700, 0, 99), // recibo hipoteca (categoría 99, excluida)
      r(2, 1, "2026-01-11", 700, 0), // ingreso real de 700 que no debe casar
    ];
    const opts = { windowDays: 7, excludedCategoryIds: new Set([99]) };
    expect(matchTransfers(rows, opts)).toEqual([]);
  });

  it("no cuenta un contrario más de una vez (1-a-1)", () => {
    const rows = [
      r(1, 1, "2026-01-10", -500, 1), // única salida de 500 (ya interna)
      r(2, 3, "2026-01-11", 500, 0), // ingreso A
      r(3, 2, "2026-01-12", 500, 0), // ingreso B (no debe reusar la misma salida)
    ];
    const marks = matchTransfers(rows, win(7));
    expect(marks).toHaveLength(1);
    expect(marks[0][1]).toBe(1); // emparejado con la salida 1
  });

  it("elige el contrario más cercano en fecha cuando hay varios del mismo importe", () => {
    const rows = [
      r(1, 1, "2026-01-01", -300, 1), // lejos
      r(2, 2, "2026-01-09", -300, 1), // más cercana al ingreso
      r(3, 3, "2026-01-10", 300, 0), // ingreso en Unicaja
    ];
    expect(matchTransfers(rows, win(30))).toEqual([[3, 2]]);
  });

  it("empareja varios traspasos del mismo importe de forma estable", () => {
    const rows = [
      r(1, 1, "2026-01-05", -200, 1),
      r(2, 1, "2026-02-05", -200, 1),
      r(3, 3, "2026-01-06", 200, 0),
      r(4, 3, "2026-02-06", 200, 0),
    ];
    expect(sortMarks(matchTransfers(rows, win(7)))).toEqual([
      [3, 1],
      [4, 2],
    ]);
  });
});
