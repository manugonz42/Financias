import { useEffect, useMemo, useState } from "react";
import { useApp } from "../state/AppContext";
import { AccountSelector, MonthSelect, ExcludeInternalToggle } from "../components/Controls";
import { listTransactions, sumFlows, distinctMonths, distinctSubtypes } from "../data/transactions";
import { reassignCategoryByElement } from "../data/categories";
import { exportTransactionsCSV } from "../lib/csv";
import { formatEUR, formatDate } from "../lib/format";
import type { Transaction, TxFilters } from "../types";

const SUBTYPE_LABEL: Record<string, string> = {
  compra: "Compra",
  cajero: "Cajero",
  recibo: "Recibo",
  transferencia: "Transferencia",
  nomina: "Nómina",
  interes: "Interés",
  comision: "Comisión",
  abono: "Abono",
  otro: "Otro",
};

export function Movimientos() {
  const { accountId, excludeInternal, categories, version, reload } = useApp();
  const [months, setMonths] = useState<string[]>([]);
  const [subtypes, setSubtypes] = useState<string[]>([]);
  const [month, setMonth] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [subtype, setSubtype] = useState("");
  const [search, setSearch] = useState("");
  const [flow, setFlow] = useState<"" | "expense" | "income">("");
  const [rows, setRows] = useState<Transaction[]>([]);
  const [totals, setTotals] = useState({ expense: 0, income: 0 });
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    void distinctMonths().then(setMonths);
    void distinctSubtypes().then(setSubtypes);
  }, [version]);

  const filters: TxFilters = useMemo(
    () => ({
      accountId,
      excludeInternal,
      month: month || undefined,
      categoryId: categoryId || undefined,
      subtype: subtype || undefined,
      search: search || undefined,
      flow: flow || undefined,
    }),
    [accountId, excludeInternal, month, categoryId, subtype, search, flow],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [txs, sums] = await Promise.all([listTransactions(filters), sumFlows(filters)]);
      if (cancelled) return;
      setRows(txs);
      setTotals(sums);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [filters, version]);

  async function changeCategory(txId: number, catId: number) {
    const n = await reassignCategoryByElement(txId, catId);
    setNote(n > 1 ? `Actualizados ${n} movimientos con el mismo concepto.` : "");
    reload();
  }

  return (
    <div>
      <div className="topbar">
        <h1>Movimientos</h1>
        <button onClick={() => exportTransactionsCSV(rows)} disabled={rows.length === 0}>
          ⬇ Exportar CSV ({rows.length})
        </button>
      </div>

      <div className="filters">
        <AccountSelector />
        <MonthSelect months={months} value={month} onChange={setMonth} allowAll />
        <select value={String(categoryId)} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        <select value={subtype} onChange={(e) => setSubtype(e.target.value)}>
          <option value="">Todos los tipos</option>
          {subtypes.map((s) => (
            <option key={s} value={s}>{SUBTYPE_LABEL[s] ?? s}</option>
          ))}
        </select>
        <select value={flow} onChange={(e) => setFlow(e.target.value as "" | "expense" | "income")}>
          <option value="">Gastos e ingresos</option>
          <option value="expense">Solo gastos</option>
          <option value="income">Solo ingresos</option>
        </select>
        <input
          className="grow"
          placeholder="Buscar concepto o comercio…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ExcludeInternalToggle />
      </div>

      <div className="row" style={{ marginBottom: 12, gap: 24 }}>
        <span className="muted">Gastos: <b className="amount neg">{formatEUR(totals.expense)}</b></span>
        <span className="muted">Ingresos: <b className="amount pos">{formatEUR(totals.income)}</b></span>
        <span className="muted">Neto: <b className={totals.income - totals.expense >= 0 ? "amount pos" : "amount neg"}>{formatEUR(totals.income - totals.expense)}</b></span>
        {note && <span className="spacer" />}
        {note && <span style={{ color: "var(--accent)", fontSize: 13 }}>{note}</span>}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cuenta</th>
              <th>Concepto</th>
              <th>Categoría</th>
              <th>Tipo</th>
              <th className="right">Importe</th>
              <th className="right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>{formatDate(t.fecha_operacion)}</td>
                <td className="muted">{t.account_name}</td>
                <td className="concepto">
                  {t.merchant ?? t.concepto}
                  {t.is_internal === 1 && <span className="tag-internal"> · interno</span>}
                </td>
                <td>
                  <select
                    value={t.category_id ?? ""}
                    onChange={(e) => changeCategory(t.id, Number(e.target.value))}
                    style={{ maxWidth: 170, padding: "4px 6px", fontSize: 12 }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </td>
                <td className="muted">{SUBTYPE_LABEL[t.subtype ?? ""] ?? t.subtype}</td>
                <td className={`right amount ${t.importe < 0 ? "neg" : "pos"}`}>{formatEUR(t.importe)}</td>
                <td className="right muted">{t.saldo != null ? formatEUR(t.saldo) : ""}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 30 }}>Sin movimientos para estos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
