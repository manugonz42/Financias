// Tipos del dominio compartidos por la UI y la capa de datos.

export type AccountType = "checking" | "savings";

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  number: string | null;
  last4: string | null;
  holder: string | null;
  currency: string;
}

export interface Category {
  id: number;
  name: string;
  kind: "gasto" | "ingreso" | "interno";
  color: string;
  icon: string;
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
