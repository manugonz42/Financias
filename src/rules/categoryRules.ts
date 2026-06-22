// Taxonomía de categorías y reglas de autocategorización.
//
// Las reglas se siembran a partir de los comercios reales que aparecen en los
// extractos. El motor normaliza el concepto (mayúsculas, sin acentos) y aplica
// la primera regla que casa por orden de prioridad (menor = antes).
//
// Esto vive en código (no en datos personales) y se vuelca a la tabla
// `category_rules` al inicializar la base de datos, donde el usuario puede
// editarlas/añadir las suyas.

export type CategoryKind = "gasto" | "ingreso" | "interno";

export interface CategorySeed {
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string;
}

export type Subtype =
  | "compra"
  | "cajero"
  | "recibo"
  | "transferencia"
  | "nomina"
  | "interes"
  | "comision"
  | "abono"
  | "otro";

export interface RuleSeed {
  /** Expresión regular (texto) que se prueba sobre el concepto normalizado. */
  pattern: string;
  category: string;
  /** Si la regla fuerza un subtipo concreto. */
  subtype?: Subtype;
  priority: number;
}

// --- Categorías ---------------------------------------------------------------

export const CATEGORIES: CategorySeed[] = [
  // Gastos
  { name: "Supermercado", kind: "gasto", color: "#22c55e", icon: "🛒" },
  { name: "Restauración", kind: "gasto", color: "#f97316", icon: "🍔" },
  { name: "Combustible", kind: "gasto", color: "#ef4444", icon: "⛽" },
  { name: "Coche y Moto", kind: "gasto", color: "#7c3aed", icon: "🚗" },
  { name: "Suministros", kind: "gasto", color: "#eab308", icon: "💡" },
  { name: "Telefonía e Internet", kind: "gasto", color: "#06b6d4", icon: "📱" },
  { name: "Seguros", kind: "gasto", color: "#3b82f6", icon: "🛡️" },
  { name: "Mascotas", kind: "gasto", color: "#a855f7", icon: "🐾" },
  { name: "Transporte", kind: "gasto", color: "#14b8a6", icon: "🚇" },
  { name: "Viajes", kind: "gasto", color: "#0891b2", icon: "✈️" },
  { name: "Compras y Tecnología", kind: "gasto", color: "#6366f1", icon: "📦" },
  { name: "Ocio y Digital", kind: "gasto", color: "#ec4899", icon: "🎮" },
  { name: "Salud y Farmacia", kind: "gasto", color: "#10b981", icon: "💊" },
  { name: "Impuestos y Tasas", kind: "gasto", color: "#64748b", icon: "🏛️" },
  { name: "Ropa", kind: "gasto", color: "#d946ef", icon: "👕" },
  { name: "Hogar", kind: "gasto", color: "#f59e0b", icon: "🏠" },
  { name: "Alquiler", kind: "gasto", color: "#e11d48", icon: "🔑" },
  { name: "Cajero / Efectivo", kind: "gasto", color: "#0ea5e9", icon: "🏧" },
  { name: "Comisiones bancarias", kind: "gasto", color: "#94a3b8", icon: "🏦" },
  { name: "Otros gastos", kind: "gasto", color: "#9ca3af", icon: "•" },
  // Ingresos
  { name: "Nómina", kind: "ingreso", color: "#16a34a", icon: "💼" },
  { name: "Intereses", kind: "ingreso", color: "#84cc16", icon: "📈" },
  { name: "Devoluciones y Abonos", kind: "ingreso", color: "#4ade80", icon: "↩️" },
  { name: "Otros ingresos", kind: "ingreso", color: "#65a30d", icon: "➕" },
  // Interno (no computa como gasto/ingreso real)
  { name: "Traspaso interno", kind: "interno", color: "#475569", icon: "🔁" },
];

export const FALLBACK_EXPENSE = "Otros gastos";
export const FALLBACK_INCOME = "Otros ingresos";
export const INTERNAL_CATEGORY = "Traspaso interno";
export const CASH_CATEGORY = "Cajero / Efectivo";

// --- Reglas de comercios (sobre concepto normalizado) -------------------------
// Nota: el concepto se normaliza a MAYÚSCULAS y SIN ACENTOS antes de probar.

export const RULES: RuleSeed[] = [
  // Cajero / efectivo
  { pattern: "DISPOSICION EN CAJERO", category: "Cajero / Efectivo", subtype: "cajero", priority: 5 },

  // Suministros / telefonía / seguros (recibos domiciliados)
  { pattern: "ENERGIA XXI|\\bENDESA\\b|IBERDROLA|NATURGY|\\bENI\\b|REPSOL LUZ|HIDRALIA|AQUALIA|CANAL ISABEL|EMASESA|AGUAS DE|\\bEMACSA\\b", category: "Suministros", subtype: "recibo", priority: 10 },
  { pattern: "DIGI SPAIN|MOVISTAR|VODAFONE|ORANGE|JAZZTEL|PEPEPHONE|O2 ", category: "Telefonía e Internet", subtype: "recibo", priority: 10 },
  { pattern: "VERTI|MUTUA MADRILE|MAPFRE|ALLIANZ|AXA |LINEA DIRECTA|REALE |GENERALI|SANITAS|ADESLAS|ASISA", category: "Seguros", subtype: "recibo", priority: 10 },
  { pattern: "AYUNTAMIENTO DE MADRID|AYTO.?MADRID|AYTO MADRID", category: "Impuestos y Tasas", priority: 10 },
  // Impuestos / Seguridad Social (Hacienda, autónomos)
  { pattern: "A\\.?E\\.?A\\.?T|AGENCIA TRIBUTARIA|\\bHACIENDA\\b|\\bAUTONOMOS\\b|SEGURIDAD SOCIAL|\\bTGSS\\b|\\bRETA\\b|TASA |IMPUESTO", category: "Impuestos y Tasas", subtype: "recibo", priority: 11 },
  // Comisión de mantenimiento de cuenta
  { pattern: "^MANTENIMIENTO|COMISION MANTEN|MANTENIMIENTO CUENTA|COM\\.?\\s?MANTO", category: "Comisiones bancarias", subtype: "comision", priority: 44 },
  // Devoluciones de Hacienda (ingreso)
  { pattern: "DEVOLUCION(ES)? TRIBUTARIA|DEVOLUCION RENTA|ABONO A\\.?E\\.?A\\.?T", category: "Devoluciones y Abonos", subtype: "abono", priority: 11 },

  // Supermercados / alimentación
  {
    pattern:
      "MERCADONA|AHORRAMAS|\\bALDI\\b|\\bLIDL\\b|ALCAMPO|CARREF|\\bDIA \\b|DIA \\d|SUPECO|EL GUSTO|LA DESPENSA|AHORRAMAS SA|GRUPO (SUP )?AHORRAMAS|NAHAR FRUTERIA|FRUTERIA|CARNICERIA|HIPER SAN FERNANDO|LA SIRENA|BODEGON|MARKET JULIAN ROMEA|ALIMENTACION|SUMINISTROS ALCALARE",
    category: "Supermercado",
    priority: 20,
  },

  // Restauración / comida rápida
  {
    pattern:
      "\\bKFC\\b|BK\\d|BURGER|DOMINO|SUBWAY|TIKI TACO|PAPA JOHNS|ROYAL KEBAP|RESTAURANTE|\\bBAR \\b|BAR FLAMENCO|BAR LEON|ASADOR|FREIDOR|EL FOGON|SUPER POLLO|TAPAS Y COPAS|TABITAS|SALON ITALIANO|MANDUCARE|EUREST|DELIKIA|GANOSA|HELAOTAI|IPANEMA|SUKAO|ANDARRIO|PLATERO|FEVER",
    category: "Restauración",
    priority: 25,
  },

  // Combustible / gasolineras
  {
    pattern:
      "PLENERGY|PLENOIL|CEDIPSA|ATENOIL|BALLENOIL|TALOIL|MOEVE|PETROPRIX|GESLAMA|SURTIMOVIL|E\\. ?S\\.|EESS|E S ALCAMPO|ES MARIA AUXIL|PK SAN ANTONIO|GASOLINERA|US\\d+ PLEN|PLENOIL US",
    category: "Combustible",
    priority: 30,
  },

  // Coche y moto (mantenimiento, taller, ITV, peajes, parking, recambios…).
  // No incluye combustible (Combustible) ni el seguro del vehículo (Seguros).
  {
    pattern:
      "\\bTALLER\\b|\\bITV\\b|NEUMATICO|RUEDAS|RECAMBIO|AUTORECAMBIOS|MOTOS ESTEVARANZ|VINOTINTO MOTORS|CONCESIONARIO|MECANIC|\\bMOTOR\\b|AUTOMOVIL|MOTOCICLETA|PARKING|APARCAMIENTO|PARKIA|\\bSABA\\b|EMPARK|\\bONEPARK\\b|PEAJE|AUTOPISTA|\\bAUSOL\\b|\\bGRUA\\b|\\bDGT\\b|JEFATURA.*TRAFICO|MULTA",
    category: "Coche y Moto",
    priority: 36,
  },

  // Viajes (vuelos, hoteles, reservas, largo recorrido). Va antes que la
  // restauración genérica para que "HOTEL …" no caiga en otra categoría.
  {
    pattern:
      "RYANAIR|VUELING|IBERIA|\\bAIR EUROPA\\b|EASYJET|WIZZ ?AIR|\\bAENA\\b|AEROPUERTO|\\bHOTEL|HOSTEL|\\bHRS\\b|BOOKING|AIRBNB|EXPEDIA|TRIVAGO|EDREAMS|GOVOYAGES|ESKY|KIWI\\.COM|TRAINLINE|\\bALSA\\b|FLIXBUS|BLABLACAR|PARADOR|\\bAVE\\b|OUIGO|IRYO",
    category: "Viajes",
    priority: 33,
  },

  // Mascotas
  { pattern: "KIWOKO|VETERINARIA|ANICURA|ANIMARI|MASCOTA", category: "Mascotas", priority: 30 },

  // Transporte público
  {
    pattern: "APP CRTM|\\bCRTM\\b|METRO DE MADRID|RENFE|MADRID SUR MOVILIDAD|CERCANIAS|EUROPCAR|CENTAURO|\\bSIXT\\b",
    category: "Transporte",
    priority: 30,
  },

  // Salud / farmacia
  { pattern: "FARMACIA|FCIA |ANICURA", category: "Salud y Farmacia", priority: 30 },

  // Ocio y digital / suscripciones / juegos
  {
    pattern:
      "STEAM|BLIZZARD|INSTANT GAMING|\\bGITHUB\\b|ANTHROPIC|CLAUDE|NUVERSE|SPOTIFY|NETFLIX|AMAZON PRIME|HP\\*INSTANT|GROUPON|ATLANTIS AQUARIUM|KINEPOLIS|AYTO MADRID DEPORTES|AYTO\\.?MADRID-DEPORTES|DEPORTES|P DEPORTIVO",
    category: "Ocio y Digital",
    priority: 35,
  },

  // Ropa
  {
    pattern: "GUESS|UNIQLO|PRIMARK|FIFTY FACTORY|KIABI|SKECHERS|ALVARO MORENO|DECATHLON|HUMANA",
    category: "Ropa",
    priority: 35,
  },

  // Alquiler / vivienda
  { pattern: "ALQUILER|ARRENDAMIENTO|RENTA MENSUAL", category: "Alquiler", subtype: "recibo", priority: 18 },

  // Hogar / bricolaje
  { pattern: "IKEA|LEROY MERLIN|MEDIA MARKT|BRICO|FERRETERIA|MENAJE", category: "Hogar", priority: 38 },

  // Compras y tecnología / online
  {
    pattern: "AMAZON|AMZN|ALIEXPRESS|\\bTEMU\\b|LENOVO|APPLE STORE|WWW\\.MI\\.COM|SP EU SIHOO|SIHOO|MONDELEZ|CARREFOUR TECNOL|TELEFONICA CORNER",
    category: "Compras y Tecnología",
    priority: 40,
  },

  // Comisiones bancarias / ajustes
  { pattern: "COMISION POR COMPRAS|^COMISION|RETENCION HACIENDA", category: "Comisiones bancarias", subtype: "comision", priority: 45 },

  // Ingresos (palabras genéricas; las nóminas por nombre de empresa se pueden
  // afinar con reglas propias editables dentro de la app, no en el código).
  {
    pattern: "PAGO NOMINA|\\bNOMINA\\b|SUELDO|SALAR|FINIQ",
    category: "Nómina",
    subtype: "nomina",
    priority: 15,
  },
  { pattern: "LIQUIDACION CUENTA", category: "Intereses", subtype: "interes", priority: 12 },
  { pattern: "BONIFICACION SOBRE EL IMPORTE", category: "Devoluciones y Abonos", subtype: "abono", priority: 12 },
  { pattern: "ABONO EN LA TARJETA|REGULARIZACION|DEVOLUCION IMPORTE|UBER B\\.V\\.", category: "Devoluciones y Abonos", subtype: "abono", priority: 50 },
  // Ingreso de efectivo = dinero propio que se mete en la cuenta; se trata como
  // movimiento interno (no es un ingreso real, no computa en la tasa de ahorro).
  { pattern: "INGRESO DE EFECTIVO", category: "Traspaso interno", priority: 8 },
];
