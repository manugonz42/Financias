import { query, exec } from "../db/database";

export type InvestmentKind = "accion" | "fondo" | "cripto" | "otro";

export interface Investment {
  id: number;
  name: string;
  kind: InvestmentKind;
  ticker: string | null;
  currency: string;
  current_price: number;
  updated_at: string | null;
}

export interface InvestmentRow extends Investment {
  units: number; // unidades en cartera (compras - ventas)
  cost_net: number; // coste neto invertido (incluye comisiones)
  market_value: number; // valor actual = unidades * precio actual
  pl: number; // pérdida/ganancia = valor actual - coste neto
  pl_pct: number;
}

export interface Lot {
  id: number;
  investment_id: number;
  fecha: string;
  units: number;
  price: number;
  fees: number;
  notes: string | null;
}

export async function listInvestments(): Promise<InvestmentRow[]> {
  const rows = await query<Investment & { units: number; cost_net: number }>(
    `SELECT i.id, i.name, i.kind, i.ticker, i.currency, i.current_price, i.updated_at,
            COALESCE(SUM(l.units), 0) AS units,
            COALESCE(SUM(l.units * l.price + l.fees), 0) AS cost_net
       FROM investments i
       LEFT JOIN investment_lots l ON l.investment_id = i.id
      GROUP BY i.id
      ORDER BY i.name`,
  );
  return rows.map((r) => {
    const market_value = r.units * r.current_price;
    const pl = market_value - r.cost_net;
    const pl_pct = r.cost_net > 0 ? (pl / r.cost_net) * 100 : 0;
    return { ...r, market_value, pl, pl_pct };
  });
}

export interface PortfolioSummary {
  cost: number;
  value: number;
  pl: number;
  pl_pct: number;
}

export async function portfolioSummary(): Promise<PortfolioSummary> {
  const rows = await listInvestments();
  const cost = rows.reduce((s, r) => s + Math.max(r.cost_net, 0), 0);
  const value = rows.reduce((s, r) => s + r.market_value, 0);
  const pl = value - cost;
  return { cost, value, pl, pl_pct: cost > 0 ? (pl / cost) * 100 : 0 };
}

export async function createInvestment(i: {
  name: string;
  kind: InvestmentKind;
  ticker?: string | null;
  currency?: string;
  current_price?: number;
}): Promise<number> {
  const res = await exec(
    "INSERT INTO investments (name, kind, ticker, currency, current_price, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
    [i.name, i.kind, i.ticker ?? null, i.currency ?? "EUR", i.current_price ?? 0],
  );
  return Number(res.lastInsertId);
}

export async function updateInvestmentPrice(id: number, price: number): Promise<void> {
  await exec("UPDATE investments SET current_price = ?, updated_at = datetime('now') WHERE id = ?", [
    price,
    id,
  ]);
}

export async function deleteInvestment(id: number): Promise<void> {
  await exec("DELETE FROM investment_lots WHERE investment_id = ?", [id]);
  await exec("DELETE FROM investments WHERE id = ?", [id]);
}

export async function listLots(investmentId: number): Promise<Lot[]> {
  return query<Lot>(
    "SELECT * FROM investment_lots WHERE investment_id = ? ORDER BY fecha DESC, id DESC",
    [investmentId],
  );
}

export async function addLot(l: {
  investmentId: number;
  fecha: string;
  units: number;
  price: number;
  fees?: number;
  notes?: string | null;
}): Promise<void> {
  await exec(
    "INSERT INTO investment_lots (investment_id, fecha, units, price, fees, notes) VALUES (?, ?, ?, ?, ?, ?)",
    [l.investmentId, l.fecha, l.units, l.price, l.fees ?? 0, l.notes ?? null],
  );
}

export async function deleteLot(id: number): Promise<void> {
  await exec("DELETE FROM investment_lots WHERE id = ?", [id]);
}
