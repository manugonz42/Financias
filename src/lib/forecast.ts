// Cálculos puros de previsión de flujo de caja y alertas.
// Sin dependencias de BD — solo lógica matemática testeable.

/** Un punto en la serie histórica o proyectada. */
export interface FlowPoint {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  net: number;
}

/** Proyección con banda de confianza. */
export interface ProjectedFlow extends FlowPoint {
  low: number;
  high: number;
  projected: true;
}

/** Resultado del forecast completo. */
export interface CashFlowForecast {
  historical: FlowPoint[];
  projected: ProjectedFlow[];
  avgIncome: number;
  avgExpense: number;
  avgNet: number;
  bandPct: number;
}

/** Media y desviación estándar. */
export function meanAndStddev(values: number[]): { mean: number; stddev: number } {
  if (values.length === 0) return { mean: 0, stddev: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (values.length < 2) return { mean, stddev: 0 };
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return { mean, stddev: Math.sqrt(variance) };
}

/** Proyecta flujos mensuales usando regresión lineal. */
export function projectMonthlyFlows(
  historical: FlowPoint[],
  monthsAhead: number = 3,
): CashFlowForecast {
  if (historical.length === 0) {
    return { historical: [], projected: [], avgIncome: 0, avgExpense: 0, avgNet: 0, bandPct: 0 };
  }

  const incomes = historical.map((h) => h.income);
  const expenses = historical.map((h) => h.expense);
  const nets = historical.map((h) => h.net);

  const incStats = meanAndStddev(incomes);
  const expStats = meanAndStddev(expenses);
  const netStats = meanAndStddev(nets);

  const bandPct = incStats.mean > 0
    ? Math.min(0.5, netStats.stddev / Math.abs(incStats.mean))
    : 0.3;

  // Regresión lineal sobre net
  const n = historical.length;
  const xMean = (n - 1) / 2;
  const yMean = netStats.mean;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (nets[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den !== 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;

  const projected: ProjectedFlow[] = [];
  const lastMonth = historical[historical.length - 1].month;
  const [lastY, lastM] = lastMonth.split("-").map(Number);

  for (let i = 1; i <= monthsAhead; i++) {
    const projIdx = n - 1 + i;
    const projNet = intercept + slope * projIdx;
    const ratio = incStats.mean / (incStats.mean + expStats.mean || 1);
    const projIncome = incStats.mean + (projNet - netStats.mean) * ratio;
    const projExpense = projIncome - projNet;

    const totalM = lastM + i - 1;
    const y = lastY + Math.floor(totalM / 12);
    const m = (totalM % 12) + 1;
    const month = `${y}-${String(m).padStart(2, "0")}`;

    projected.push({
      month,
      income: Math.max(0, projIncome),
      expense: Math.max(0, projExpense),
      net: projNet,
      low: projNet - Math.abs(projNet) * bandPct,
      high: projNet + Math.abs(projNet) * bandPct,
      projected: true,
    });
  }

  return {
    historical,
    projected,
    avgIncome: incStats.mean,
    avgExpense: expStats.mean,
    avgNet: netStats.mean,
    bandPct,
  };
}

export type RiskType = "low_balance" | "overspend" | "income_missing" | "thin_data" | "large_expense";

export interface RiskFlag {
  type: RiskType;
  severity: "high" | "medium" | "low";
  message: string;
  month: string;
  amount: number;
}

/** Detecta banderas de riesgo en la proyección. */
export function detectRisks(
  forecast: CashFlowForecast,
  currentBalance: number,
  scheduledAmounts: Map<string, number> = new Map(),
): RiskFlag[] {
  const risks: RiskFlag[] = [];
  let runningBalance = currentBalance;

  for (const point of forecast.projected) {
    runningBalance += point.net;

    if (runningBalance < 0) {
      risks.push({
        type: "low_balance",
        severity: "high",
        message: `Saldo negativo en ${point.month}: €${runningBalance.toFixed(0)}`,
        month: point.month,
        amount: runningBalance,
      });
    }

    if (forecast.avgExpense > 0 && point.expense > forecast.avgExpense * 1.3) {
      risks.push({
        type: "overspend",
        severity: "medium",
        message: `Gasto ${((point.expense / forecast.avgExpense - 1) * 100).toFixed(0)}% sobre la media en ${point.month}`,
        month: point.month,
        amount: point.expense - forecast.avgExpense,
      });
    }

    if (forecast.avgIncome > 0 && point.income < forecast.avgIncome * 0.7) {
      risks.push({
        type: "income_missing",
        severity: "high",
        message: `Ingreso ${((1 - point.income / forecast.avgIncome) * 100).toFixed(0)}% bajo la media en ${point.month}`,
        month: point.month,
        amount: forecast.avgIncome - point.income,
      });
    }

    const scheduled = scheduledAmounts.get(point.month) ?? 0;
    if (scheduled > point.income * 0.5 && scheduled > 200) {
      risks.push({
        type: "large_expense",
        severity: "medium",
        message: `Pagos programados €${scheduled.toFixed(0)} en ${point.month} > 50% del ingreso`,
        month: point.month,
        amount: scheduled,
      });
    }
  }

  if (forecast.historical.length < 3) {
    risks.push({
      type: "thin_data",
      severity: "low",
      message: `Solo ${forecast.historical.length} meses de histórico — banda ±${(forecast.bandPct * 100).toFixed(0)}%`,
      month: forecast.projected[0]?.month ?? "",
      amount: 0,
    });
  }

  const sevOrder = { high: 0, medium: 1, low: 2 };
  return risks
    .sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 5);
}

export interface GoalProjection {
  goalId: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  remaining: number;
  targetDate: string | null;
  estimatedDate: string | null;
  monthlyNeeded: number | null;
  progressPct: number;
}

/** Calcula la proyección de una meta de ahorro. */
export function projectGoal(
  goal: { id: number; name: string; target_amount: number; current_amount: number; target_date: string | null },
  avgMonthlySavings: number,
): GoalProjection {
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  const progressPct = goal.target_amount > 0
    ? Math.min(100, (goal.current_amount / goal.target_amount) * 100)
    : 0;

  if (remaining <= 0) {
    return {
      goalId: goal.id, name: goal.name, targetAmount: goal.target_amount,
      currentAmount: goal.current_amount, remaining: 0, targetDate: goal.target_date,
      estimatedDate: null, monthlyNeeded: null, progressPct: 100,
    };
  }

  let monthlyNeeded: number | null = null;
  if (goal.target_date) {
    const target = new Date(goal.target_date + "T00:00:00");
    const now = new Date();
    const ms = target.getTime() - now.getTime();
    if (ms > 0) {
      monthlyNeeded = remaining / (ms / (1000 * 60 * 60 * 24 * 30.44));
    }
  }

  let estimatedDate: string | null = null;
  if (avgMonthlySavings > 0) {
    const monthsNeeded = remaining / avgMonthlySavings;
    const est = new Date();
    est.setMonth(est.getMonth() + Math.ceil(monthsNeeded));
    const p = (n: number) => String(n).padStart(2, "0");
    estimatedDate = `${est.getFullYear()}-${p(est.getMonth() + 1)}-${p(est.getDate())}`;
  }

  return {
    goalId: goal.id, name: goal.name, targetAmount: goal.target_amount,
    currentAmount: goal.current_amount, remaining, targetDate: goal.target_date,
    estimatedDate, monthlyNeeded, progressPct,
  };
}

export interface LiquidityDay {
  date: string;
  balance: number;
  isProjected: boolean;
}

/** Genera puntos de liquidez diaria proyectada. */
export function projectDailyLiquidity(
  currentBalance: number,
  dailyAvgNet: number,
  daysAhead: number = 90,
): LiquidityDay[] {
  const days: LiquidityDay[] = [];
  const today = new Date();
  let balance = currentBalance;

  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const p = (n: number) => String(n).padStart(2, "0");
    const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;

    days.push({ date, balance, isProjected: i > 0 });
    const noise = dailyAvgNet * (0.8 + Math.random() * 0.4);
    balance += i === 0 ? 0 : noise;
  }

  return days;
}
