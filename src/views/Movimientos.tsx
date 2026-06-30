import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../state/AppContext";
import { CategoryGlyph } from "../lib/icons";
import { AccountSelector, MonthSelect, ExcludeInternalToggle } from "../components/Controls";
import { listTransactions, sumFlows, distinctMonths, distinctSubtypes, setReconciled, setReconciledBulk } from "../data/transactions";
import { reassignCategoryByElement } from "../data/categories";
import { SplitEditor } from "../components/SplitEditor";
import { ReceiptEditor } from "../components/ReceiptEditor";
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
  const { accountId, excludeInternal, categories, version, reload, toast, toastWithAction, iconStyle } = useApp();
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const [editingCat, setEditingCat] = useState<number | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  const [subtypes, setSubtypes] = useState<string[]>([]);
  const [month, setMonth] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [subtype, setSubtype] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [flow, setFlow] = useState<"" | "expense" | "income">("");
  const [recon, setRecon] = useState<"" | "yes" | "no">("");
  const [sort, setSort] = useState<"fecha-desc" | "fecha-asc" | "imp-desc" | "imp-asc">("fecha-desc");
  const [groupByDate, setGroupByDate] = useState(true);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [totals, setTotals] = useState({ expense: 0, income: 0 });
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [splitting, setSplitting] = useState<Transaction | null>(null);
  const [receipting, setReceipting] = useState<Transaction | null>(null);
  const [confirmingReconcile, setConfirmingReconcile] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void distinctMonths().then(setMonths);
    void distinctSubtypes().then(setSubtypes);
  }, [version]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters: TxFilters = useMemo(
    () => ({
      accountId,
      excludeInternal,
      month: month || undefined,
      categoryId: categoryId || undefined,
      subtype: subtype || undefined,
      search: search || undefined,
      flow: flow || undefined,
      reconciled: recon === "yes" ? true : recon === "no" ? false : undefined,
    }),
    [accountId, excludeInternal, month, categoryId, subtype, search, flow, recon],
  );

  useEffect(() => {
    setNote("");
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
    const tx = rows.find((r) => r.id === txId);
    const prevCatId = tx?.category_id ?? null;
    const n = await reassignCategoryByElement(txId, catId);
    setEditingCat(null);
    setNote(n > 1 ? `Actualizados ${n} movimientos con el mismo concepto.` : "");
    reload();
    if (n > 1 && prevCatId !== null && prevCatId !== catId) {
      toastWithAction(
        `Categoría aplicada a ${n} movimientos`,
        "Deshacer",
        () => { void reassignCategoryByElement(txId, prevCatId).then(() => reload()); },
      );
    } else {
      toast("Categoría actualizada");
    }
  }

  async function toggleReconciled(txId: number, value: boolean) {
    await setReconciled(txId, value);
    setRows((prev) => prev.map((r) => (r.id === txId ? { ...r, reconciled: value ? 1 : 0 } : r)));
  }

  function handleReconcileAll(value: boolean) {
    if (!confirmingReconcile) {
      setConfirmingReconcile(true);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmingReconcile(false), 5000);
      return;
    }
    setConfirmingReconcile(false);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    void reconcileAll(value);
  }

  async function reconcileAll(value: boolean) {
    await setReconciledBulk(rows.map((r) => r.id), value);
    setRows((prev) => prev.map((r) => ({ ...r, reconciled: value ? 1 : 0 })));
    toast(value ? "Movimientos conciliados" : "Conciliación deshecha");
  }

  const reconciledCount = rows.filter((r) => r.reconciled === 1).length;

  const sortedRows = useMemo(() => {
    const r = [...rows];
    if (sort === "fecha-asc") r.reverse();
    else if (sort === "imp-desc") r.sort((a, b) => Math.abs(b.importe) - Math.abs(a.importe));
    else if (sort === "imp-asc") r.sort((a, b) => Math.abs(a.importe) - Math.abs(b.importe));
    return r; // fecha-desc: ya viene así
  }, [rows, sort]);

  const showGroups = groupByDate && (sort === "fecha-desc" || sort === "fecha-asc");

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
            <option key={c.id} value={c.id}>{iconStyle === "color" ? `${c.icon} ` : ""}{c.name}</option>
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
        <select value={recon} onChange={(e) => setRecon(e.target.value as "" | "yes" | "no")} title="Estado de conciliación">
          <option value="">Conciliados y pendientes</option>
          <option value="yes">Solo conciliados</option>
          <option value="no">Solo pendientes</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} title="Ordenar">
          <option value="fecha-desc">Fecha (recientes)</option>
          <option value="fecha-asc">Fecha (antiguos)</option>
          <option value="imp-desc">Importe (mayor)</option>
          <option value="imp-asc">Importe (menor)</option>
        </select>
        <label className="row" style={{ gap: 6, cursor: "pointer", fontSize: 13 }} title="Mostrar separadores por fecha">
          <input type="checkbox" checked={groupByDate} onChange={(e) => setGroupByDate(e.target.checked)} style={{ width: 16, height: 16 }} />
          Agrupar por fecha
        </label>
        <input
          className="grow"
          placeholder="Buscar concepto o comercio…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <ExcludeInternalToggle />
      </div>

      <div className="row" style={{ marginBottom: 12, gap: 24 }}>
        <span className="muted">Gastos: <b className="amount neg">{formatEUR(totals.expense)}</b></span>
        <span className="muted">Ingresos: <b className="amount pos">{formatEUR(totals.income)}</b></span>
        <span className="muted">Neto: <b className={totals.income - totals.expense >= 0 ? "amount pos" : "amount neg"}>{formatEUR(totals.income - totals.expense)}</b></span>
        <span className="muted">Conciliados: <b style={{ color: "var(--text)" }}>{reconciledCount}/{rows.length}</b></span>
        {rows.length > 0 && (
          <button
            className="link-btn"
            onClick={() => handleReconcileAll(reconciledCount < rows.length)}
            style={confirmingReconcile ? { color: "var(--bad)", fontWeight: 600 } : undefined}
          >
            {confirmingReconcile
              ? `¿Seguro? ${reconciledCount < rows.length ? `Conciliar ${rows.length}` : "Desmarcar"} todos`
              : reconciledCount < rows.length ? "Conciliar todos" : "Desmarcar todos"}
          </button>
        )}
        {note && <span className="spacer" />}
        {note && <span style={{ color: "var(--accent)", fontSize: 13 }}>{note}</span>}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th title="Conciliado / revisado">✓</th>
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
            {(() => {
              let lastDate = "";
              return sortedRows.map((t) => {
                const showHeader = showGroups && t.fecha_operacion !== lastDate;
                lastDate = t.fecha_operacion;
                return (
                  <Fragment key={t.id}>
                    {showHeader && (
                      <tr className="date-group">
                        <td colSpan={8}>{formatDate(t.fecha_operacion)}</td>
                      </tr>
                    )}
                    <tr style={{ opacity: t.reconciled === 1 ? 0.6 : 1 }}>
                <td>
                  <input
                    type="checkbox"
                    checked={t.reconciled === 1}
                    onChange={(e) => void toggleReconciled(t.id, e.target.checked)}
                    title={t.reconciled === 1 ? "Conciliado" : "Marcar como conciliado"}
                    style={{ width: 16, height: 16 }}
                  />
                </td>
                <td>{formatDate(t.fecha_operacion)}</td>
                <td className="muted">{t.account_name}</td>
                <td className="concepto">
                  {t.merchant ?? t.concepto}
                  {t.is_internal === 1 && <span className="tag-internal"> · interno</span>}
                </td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    {t.split_count > 0 ? (
                      <button
                        className="link-btn"
                        onClick={() => setSplitting(t)}
                        title="Editar la división"
                        style={{ fontSize: 12 }}
                      >
                        ✂ Dividido ({t.split_count})
                      </button>
                    ) : editingCat === t.id ? (
                      <select
                        value={t.category_id ?? ""}
                        onChange={(e) => changeCategory(t.id, Number(e.target.value))}
                        onBlur={() => setEditingCat(null)}
                        autoFocus
                        style={{ maxWidth: 160, padding: "4px 6px", fontSize: 12 }}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{iconStyle === "color" ? `${c.icon} ` : ""}{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <>
                        <button
                          className="cat-badge"
                          onClick={() => setEditingCat(t.id)}
                          title="Clic para cambiar la categoría"
                          style={{
                            background: `${t.category_color ?? "#9ca3af"}22`,
                            borderColor: `${t.category_color ?? "#9ca3af"}55`,
                          }}
                        >
                          <CategoryGlyph icon={catById.get(t.category_id ?? -1)?.icon ?? "•"} mode={iconStyle} />
                          <span>{t.category_name ?? "—"}</span>
                        </button>
                        <button className="link-btn" onClick={() => setSplitting(t)} title="Dividir en varias categorías">✂</button>
                      </>
                    )}
                    <button
                      className="link-btn"
                      onClick={() => setReceipting(t)}
                      title="Recibo y desglose por líneas"
                    >
                      📎{t.receipt_path || t.item_count > 0 ? "•" : ""}
                    </button>
                  </div>
                </td>
                <td className="muted">{SUBTYPE_LABEL[t.subtype ?? ""] ?? t.subtype}</td>
                <td className={`right amount ${t.importe < 0 ? "neg" : "pos"}`}>{formatEUR(t.importe)}</td>
                <td className="right muted">{t.saldo != null ? formatEUR(t.saldo) : ""}</td>
                    </tr>
                  </Fragment>
                );
              });
            })()}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={8} className="muted" style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>🔍</div>
                Sin movimientos para estos filtros.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {splitting && (
        <SplitEditor
          tx={splitting}
          onClose={() => setSplitting(null)}
          onSaved={reload}
        />
      )}

      {receipting && (
        <ReceiptEditor
          tx={receipting}
          onClose={() => setReceipting(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
