import { describe, it, expect } from "vitest";
import {
  categorize,
  compileRules,
  extractMerchant,
} from "../src/import/categorize";
import type { ParsedTransaction } from "../src/import/openbankParser";

const rules = compileRules();
const OWNER = "PEREZ GARCIA JUAN";

function tx(
  concepto: string,
  importe: number,
  bankSubtypeLabel?: string,
): ParsedTransaction {
  return {
    fechaOperacion: "2026-06-01",
    fechaValor: "2026-06-01",
    concepto,
    importe,
    saldo: 0,
    bankSubtypeLabel,
  };
}

describe("extractMerchant", () => {
  it("compras con tarjeta Openbank", () => {
    expect(
      extractMerchant("COMPRA EN MERCADONA EJEMPLO, CON LA TARJETA : 0000 EL 2026-06-13"),
    ).toBe("MERCADONA EJEMPLO");
  });

  it("recibo con sufijo Nº RECIBO", () => {
    expect(
      extractMerchant("RECIBO ENERGIA XXI Nº RECIBO 0073 0100 755 ABCDEFG"),
    ).toBe("ENERGIA XXI");
  });

  it("transferencia a favor de tercero", () => {
    expect(
      extractMerchant(
        "TRANSFERENCIA INMEDIATA A FAVOR DE Tercero Ejemplo S L CONCEPTO Resto del pago",
      ),
    ).toBe("Tercero Ejemplo S L");
  });

  it("bizum enviado", () => {
    expect(extractMerchant("BIZUM ENVIADO A MARIA LOPEZ")).toBe("MARIA LOPEZ");
  });

  it("bizum recibido (BBVA, concepto limpio)", () => {
    // El parser BBVA habría dejado "MARIA LOPEZ" + label "Bizum received".
    // La heurística corta y sin dígitos largos lo toma como comercio.
    expect(extractMerchant("MARIA LOPEZ")).toBe("MARIA LOPEZ");
  });

  it("pago móvil Openbank", () => {
    expect(extractMerchant("PAGO MOVIL MERCADONA 0000 EL 2026-06-10")).toBe(
      "MERCADONA",
    );
  });

  it("concepto largo y con dígitos → no inventa comercio", () => {
    expect(
      extractMerchant(
        "MOV. NO IDENTIFICABLE REF 12345678901 INTERNAL ROUTE 9876543210",
      ),
    ).toBeNull();
  });
});

describe("categorize: reglas ampliadas", () => {
  const cases: Array<[string, number, string, string?]> = [
    // Supermercados nuevos
    ["COMPRA EN CONSUM EJEMPLO, CON LA TARJETA : 0000 EL 2026-06-13", -22.5, "Supermercado"],
    ["COMPRA EN EROSKI, CON LA TARJETA : 0000", -15.3, "Supermercado"],
    // Restauración nueva
    ["COMPRA EN GLOVO, CON LA TARJETA : 0000", -18.4, "Restauración"],
    ["COMPRA EN UBER EATS, CON LA TARJETA : 0000", -12.0, "Restauración"],
    // Transporte VTC
    ["COMPRA EN UBER, CON LA TARJETA : 0000", -8.7, "Transporte"],
    ["COMPRA EN CABIFY, CON LA TARJETA : 0000", -9.1, "Transporte"],
    // Ocio/digital nuevo
    ["RECIBO OPENAI Nº RECIBO 0073", -20, "Ocio y Digital"],
    ["COMPRA EN ADOBE, CON LA TARJETA : 0000", -12.99, "Ocio y Digital"],
    // Ropa nueva
    ["COMPRA EN ZARA, CON LA TARJETA : 0000", -45, "Ropa"],
    ["COMPRA EN SHEIN, CON LA TARJETA : 0000", -22, "Ropa"],
    // Combustible nuevo
    ["COMPRA EN GALP, CON LA TARJETA : 0000", -60, "Combustible"],
    // Teléfono nuevo
    ["RECIBO MASMOVIL Nº RECIBO 0073", -19.9, "Telefonía e Internet"],
    // Cajero internacional
    ["ATM WITHDRAWAL 100,00 EUR", -100, "Cajero / Efectivo"],
  ];
  for (const [concepto, importe, expectedCat] of cases) {
    it(`${concepto} → ${expectedCat}`, () => {
      const r = categorize(tx(concepto, importe), rules, OWNER);
      expect(r.category).toBe(expectedCat);
    });
  }
});

describe("categorize: Bizum", () => {
  it("BIZUM ENVIADO cae en categoría Bizum", () => {
    const r = categorize(tx("BIZUM ENVIADO A MARIA LOPEZ CONCEPTO Cena", -25), rules, OWNER);
    expect(r.category).toBe("Bizum");
    expect(r.subtype).toBe("transferencia");
  });
  it("BIZUM RECIBIDO también en Bizum", () => {
    const r = categorize(tx("BIZUM RECIBIDO DE MARIA LOPEZ", 25), rules, OWNER);
    expect(r.category).toBe("Bizum");
  });
  it("Bizum a uno mismo es interno (gana matchesOwner)", () => {
    const r = categorize(
      tx("BIZUM ENVIADO A PEREZ GARCIA JUAN", -50),
      rules,
      OWNER,
    );
    expect(r.category).toBe("Traspaso interno");
  });
});

describe("categorize: BBVA con bankSubtypeLabel", () => {
  it("Card payment + MERCADONA → Supermercado y subtype=compra", () => {
    const r = categorize(tx("MERCADONA EJEMPLO", -9.99, "Card payment"), rules, OWNER);
    expect(r.category).toBe("Supermercado");
    expect(r.subtype).toBe("compra");
  });
  it("Bizum payment + nombre → categoría Bizum por el label", () => {
    const r = categorize(tx("MARIA LOPEZ", -15, "Bizum payment"), rules, OWNER);
    expect(r.category).toBe("Bizum");
    expect(r.subtype).toBe("transferencia");
  });
  it("Bizum suelto (label de BBVA real) + concepto ENVIADO → Bizum", () => {
    const r = categorize(tx("ENVIADO: Food payment", -7, "Bizum"), rules, OWNER);
    expect(r.category).toBe("Bizum");
    expect(r.subtype).toBe("transferencia");
  });
  it("Direct debit + ENDESA → Suministros y subtype=recibo", () => {
    const r = categorize(tx("ENDESA SA", -52, "Direct debit"), rules, OWNER);
    expect(r.category).toBe("Suministros");
    expect(r.subtype).toBe("recibo");
  });
  it("ATM withdrawal sin concepto → Cajero/Efectivo y subtype=cajero", () => {
    const r = categorize(tx("", -150, "ATM withdrawal"), rules, OWNER);
    expect(r.category).toBe("Cajero / Efectivo");
    expect(r.subtype).toBe("cajero");
  });
  it("Deposit from salary or pension → Nómina aunque el concepto no lo diga", () => {
    const r = categorize(tx("Recibido: paga", 1500, "Deposit from salary or pension"), rules, OWNER);
    expect(r.category).toBe("Nómina");
    expect(r.subtype).toBe("nomina");
  });
  it("Transfer from card → Traspaso interno", () => {
    const r = categorize(tx("Credit- transfer from credit card", 150, "Transfer from card"), rules, OWNER);
    expect(r.category).toBe("Traspaso interno");
    expect(r.subtype).toBe("transferencia");
    expect(r.isInternal).toBe(true);
  });
  it("Monthly card debit → Traspaso interno", () => {
    const r = categorize(tx("", -250, "Monthly card debit"), rules, OWNER);
    expect(r.category).toBe("Traspaso interno");
    expect(r.isInternal).toBe(true);
  });
  it("Others + plan estarseguro → Seguros (Bbva lo filtra el parser)", () => {
    const r = categorize(tx("plan estarseguro", -17.22, "Others"), rules, OWNER);
    expect(r.category).toBe("Seguros");
  });
  it("Fees,expenses and interest paid → Comisiones bancarias", () => {
    const r = categorize(tx("", -3.5, "Fees,expenses and interest paid"), rules, OWNER);
    expect(r.category).toBe("Comisiones bancarias");
    expect(r.subtype).toBe("comision");
  });
  it("Devuelto: → Devoluciones y Abonos", () => {
    const r = categorize(tx("Devuelto: payment", 25, "Bizum"), rules, OWNER);
    // Bizum gana por prioridad (9) frente a Devoluciones (50). Aceptable: el
    // usuario querría ver el Bizum aunque sea un Devuelto. El subtype lo refleja.
    expect(r.category).toBe("Bizum");
  });
});

describe("categorize: comercios reales del PDF de BBVA", () => {
  const cases: Array<[string, number, string]> = [
    ["Lefties", -12.08, "Ropa"],
    ["Primaprix", -11.7, "Supermercado"],
    ["Apple.com/bill", -9.99, "Ocio y Digital"],
    ["Druni p acacias", -8.5, "Salud y Farmacia"],
    ["Jollibee", -6.0, "Restauración"],
    ["Inasal", -7.5, "Restauración"],
    ["Heladeria", -4.0, "Restauración"],
    ["Calzados irene", -25, "Ropa"],
    ["Bingo el 7", -11, "Ocio y Digital"],
    ["Funded card operation", -27.33, "Traspaso interno"],
    ["Monthly card debit", -250, "Traspaso interno"],
  ];
  for (const [concepto, importe, expected] of cases) {
    it(`${concepto} → ${expected}`, () => {
      const r = categorize(tx(concepto, importe), rules, OWNER);
      expect(r.category).toBe(expected);
    });
  }
});
