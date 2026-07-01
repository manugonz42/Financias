// Capa de datos para previsión de flujo de caja.
// Conecta la librería pura de forecast con la BD.

import { query } from "../db/database";
import { buildWhere } from "./filters";
import { currentBalance, listAccounts } from "./accounts";
import { monthlyFlows } from "./stats";
import { listGoals } from "./goals";
import { listScheduled } from "./scheduled";
import {
  projectMonthlyFlows,
  detectRisks,
  projectGoal,
  projectDailyLiquidity,
  type CashFlowForecast,
  type RiskFlag,
  type GoalProjection,
  type LiquidityDay,
  type FlowPoint,
} from "../lib/forecast";
import type { TxFilters } from "../types";

/**
 * Obtiene el forecast completo de flujo de caja.
 * Combina histórico de transacciones con proyección lineal.
 */
export async function getCashFlowForecast(
  filters: TxFilters,
  monthsAhead: number = 3,
): Promise<CashFlowForecast> {
  const flows = await monthlyFlows(filters);

  const historical: FlowPoint[] = flows.map((f) => ({
    month: f.month,
    income: f.income,
    expense: f.expense,
    net: f.income - f.expense,
  }));

  return projectMonthlyFlows(historical, monthsAhead);
}

/**
 * Obtiene las banderas de riesgo para la proyección actual.
 * Cruza forecast con pagos programados y saldo actual.
 */
export async function getRiskFlags(filters: TxFilters): Promise<RiskFlag[]> {
  const forecast = await getCashFlowForecast(filters);

  // Saldo actual de la cuenta principal (o total si "all")
  let balance = 0;
  if (filters.accountId && filters.accountId !== "all") {
    balance = await currentBalance(filters.accountId as number);
  } else {
    const accounts = await listAccounts();
    for (const a of accounts) {
      balance += await currentBalance(a.id);
    }
  }

  // Pagos programados agrupados por mes
  const scheduled = await listScheduled();
  const scheduledAmounts = new Map<string, number>();
  for (const s of scheduled) {
    const month = s.next_date.slice(0, 7);
    scheduledAmounts.set(month, (scheduledAmounts.get(month) ?? 0) + s.amount);
  }

  return detectRisks(forecast, balance, scheduledAmounts);
}

/**
 * Obtiene las proyecciones de todas las metas de ahorro.
 */
export async function getGoalProjections(): Promise<GoalProjection[]> {
  const goals = await listGoals();

  // Ahorro mensual promedio de los últimos 6 meses
  const flows = await monthlyFlows({});
  const recent = flows.slice(-6);
  const avgSavings = recent.length > 0
    ? recent.reduce((s, f) => s + (f.income - f.expense), 0) / recent.length
    : 0;

  return goals.map((g) =>
    projectGoal(
      {
        id: g.id,
        name: g.name,
        target_amount: g.target_amount,
        current_amount: g.current_amount,
        target_date: g.target_date,
      },
      avgSavings,
    ),
  );
}

/**
 * Genera datos de liquidez diaria proyectada.
 * Usa el flujo neto diario promedio de los últimos 30 días.
 */
export async function getLiquidityHeatmap(
  filters: TxFilters,
  daysAhead: number = 90,
): Promise<LiquidityDay[]> {
  // Saldo actual
  let balance = 0;
  if (filters.accountId && filters.accountId !== "all") {
    balance = await currentBalance(filters.accountId as number);
  } else {
    const accounts = await listAccounts();
    for (const a of accounts) {
      balance += await currentBalance(a.id);
    }
  }

  // Flujo neto diario promedio de los últimos 30 días
  const { clause, params } = buildWhere({
    ...filters,
    from: daysAgo(30),
    to: today(),
  });
  const rows = await query<{ net: number }>(
    `SELECT COALESCE(SUM(t.importe), 0) AS net
     FROM transactions t ${clause}`,
    params,
  );
  const avgDailyNet = (rows[0]?.net ?? 0) / 30;

  return projectDailyLiquidity(balance, avgDailyNet, daysAhead);
}

/** Resumen para el widget principal de forecast. */
export interface ForecastSummary {
  forecast: CashFlowForecast;
  risks: RiskFlag[];
  goals: GoalProjection[];
  currentBalance: number;
}

/**
 * Obtiene todo lo necesario para los widgets de forecast en una sola llamada.
 */
export async function getForecastSummary(filters: TxFilters): Promise<ForecastSummary> {
  const [forecast, risks, goals] = await Promise.all([
    getCashFlowForecast(filters),
    getRiskFlags(filters),
    getGoalProjections(),
  ]);

  let balance = 0;
  if (filters.accountId && filters.accountId !== "all") {
    balance = await currentBalance(filters.accountId as number);
  } else {
    const accounts = await listAccounts();
    for (const a of accounts) {
      balance += await currentBalance(a.id);
    }
  }

  return { forecast, risks, goals, currentBalance: balance };
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function p(n: number): string {
  return String(n).padStart(2, "0");
}
