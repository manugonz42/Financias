// Tipos del dominio compartidos por la UI y la capa de datos.

export type AccountClass = "activo" | "pasivo";

export type AccountType =
  // Importadas (siempre activo)
  | "checking"
  | "savings"
  // Manuales — activos
  | "efectivo"
  | "inversion"
  | "inmueble"
  | "otro_activo"
  // Manuales — pasivos
  | "tarjeta_credito"
  | "prestamo"
  | "hipoteca"
  | "otro_pasivo";

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  number: string | null;
  last4: string | null;
  holder: string | null;
  currency: string;
  /** 1 = cuenta manual (creada a mano, sin extracto). */
  manual: number;
  /** Clasificación para el patrimonio neto. */
  class: AccountClass;
}

/** Apunte de saldo con fecha para cuentas manuales. */
export interface AccountBalance {
  id: number;
  account_id: number;
  date: string;
  balance: number;
}

export interface Category {
  id: number;
  name: string;
  kind: "gasto" | "ingreso" | "interno";
  color: string;
  icon: string;
  /** Categoría padre (NULL = raíz). Permite jerarquía de profundidad libre. */
  parent_id: number | null;
}

/** Categoría con sus hijas resueltas, para pintar el árbol. */
export interface CategoryNode extends Category {
  children: CategoryNode[];
  /** Profundidad en el árbol (0 = raíz). */
  depth: number;
}

export interface Transaction {
  id: number;
  account_id: number;
  account_name: string;
  account_type: AccountType;
  fecha_operacion: string;
  fecha_valor: string;
  concepto: string;
  importe: number;
  saldo: number | null;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  category_kind: string | null;
  subtype: string | null;
  merchant: string | null;
  card_last4: string | null;
  is_internal: number;
  source_file: string | null;
  /** Nº de partes si el movimiento está dividido en varias categorías (0 = no). */
  split_count: number;
}

/** Una parte de un movimiento dividido (importe = magnitud positiva). */
export interface TransactionSplit {
  id: number;
  transaction_id: number;
  category_id: number;
  amount: number;
  note: string | null;
}

/** Meta de ahorro. */
export interface Goal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  color: string;
  icon: string;
  created_at: string;
}

/** Filtros aplicables a la consulta de movimientos. */
export interface TxFilters {
  accountId?: number | "all";
  /** Mes 'YYYY-MM'. Si se indica, tiene prioridad sobre from/to. */
  month?: string;
  from?: string;
  to?: string;
  categoryId?: number;
  subtype?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  /** Excluir traspasos internos del resultado. */
  excludeInternal?: boolean;
  /** 'expense' = solo gastos, 'income' = solo ingresos. */
  flow?: "expense" | "income";
}

export interface ImportResult {
  filename: string;
  accountName: string;
  accountType: AccountType;
  total: number;
  nuevos: number;
  duplicados: number;
  warnings: string[];
}
