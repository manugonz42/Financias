import { useEffect, useMemo, useState, type FC } from "react";
import { createPortal } from "react-dom";
import { NivoDonut, NivoFlows, NivoBalance, NivoBalanceMinimalist, NivoCash, NivoCalendar, NivoSunburst, NivoBudgets, NivoGoals, NivoCategoryCompare } from "../components/charts/nivo";
import { Button } from "@/components/ui/button";
import { DateRangeMenu } from "../components/DateRangeMenu";
import { PaletteMenu } from "../components/PaletteMenu";
import { BarStyleMenu } from "../components/BarStyleMenu";
import { useChartPalette } from "../components/charts/useChartPalette";
import { useBarStyle } from "../components/charts/useBarStyle";
import { formatEUR, monthKey } from "../lib/format";
import { kpis, spendByCategoryId, monthlyFlows, accountBalanceSeries, netWorthSeries, netWorthNow, cashByMonth, detectSubscriptions, dailySpend, debugIncomeBreakdown, type IncomeDebugRow } from "../data/stats";
import { listBudgets, type BudgetRow } from "../data/budgets";
import { listGoals } from "../data/goals";
import { listScheduled, type ScheduledRow } from "../data/scheduled";
import { topReceiptItems, type ItemAggregate } from "../data/receipts";
import { daysUntil } from "../lib/schedule";
import { donutSlices, categorySunburst } from "../lib/donut";
import { subtreeIds } from "../data/categories";
import { CategoryGlyph } from "../lib/icons";
import { useApp } from "../state/AppContext";
import type { Category, Goal, TxFilters } from "../types";
import type { MonthlyFlow, BalancePoint, CashPoint, Subscription, KpiSummary, NetWorthNow, DailySpend } from "../data/stats";

export interface WidgetProps {
  accountId: number | "all";
  excludeInternal: boolean;
  from: string;
  to: string;
  version: number;
  /** Slot de la cabecera del widget (junto a la X) para controles propios. */
  headerSlot?: HTMLElement | null;
  /** Identificador del widget (sirve para persistir el override de paleta). */
  widgetKey?: string;
}

/**
 * Categorías de gasto que se excluyen del cálculo de «gasto corriente» (gastos
 * grandes y poco representativos del día a día). Se identifican por nombre e
 * incluyen sus subcategorías.
 */
const EXCLUDED_EXPENSE_NAMES = ["Alquiler", "Hogar", "Coche y Moto"];

const normalize = (s: string) => s.trim().toLowerCase();

/** Categorías raíz (de la lista plana) que coinciden con los nombres excluidos. */
function excludedRoots(categories: Category[]): Category[] {
  const targets = new Set(EXCLUDED_EXPENSE_NAMES.map(normalize));
  return categories.filter((c) => targets.has(normalize(c.name)));
}

/** IDs a excluir = raíces coincidentes + todos sus descendientes. */
function excludedExpenseIds(categories: Category[]): number[] {
  const ids = new Set<number>();
  for (const root of excludedRoots(categories)) {
    for (const id of subtreeIds(categories, root.id)) ids.add(id);
  }
  return [...ids];
}

/** Mes 'YYYY-MM' de una fecha. */
const ym = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** Una categoría raíz con su gasto en el mes actual y el anterior. */
interface CatCompareRow {
  id: number;
  name: string;
  color: string;
  icon: string;
  now: number;
  prev: number;
}

/**
 * Gasto por categoría raíz (roll-up de su subárbol) en el mes actual vs el anterior.
 * Devuelve solo las categorías con gasto en alguno de los dos meses, ordenadas por el
 * total de ambos meses. Reutiliza `spendByCategoryId` (filtro por mes) + `donutSlices`.
 */
async function categoryCompare(
  categories: Category[],
  base: { accountId: number | "all"; excludeInternal: boolean },
  thisM: string,
  prevM: string,
): Promise<CatCompareRow[]> {
  // Fuera las categorías de gasto grande/fijo (alquiler/casa, coche y moto): no aportan
  // a la comparación del día a día. No se rotula en el widget.
  const exclude = excludedExpenseIds(categories);
  const [nowLeaf, prevLeaf] = await Promise.all([
    spendByCategoryId({ ...base, month: thisM, excludeCategoryIds: exclude }),
    spendByCategoryId({ ...base, month: prevM, excludeCategoryIds: exclude }),
  ]);
  const nowById = new Map(
    donutSlices(categories, new Map(nowLeaf.map((r) => [r.id, r.value])), null).map((s) => [s.id, s.value]),
  );
  const prevById = new Map(
    donutSlices(categories, new Map(prevLeaf.map((r) => [r.id, r.value])), null).map((s) => [s.id, s.value]),
  );
  const byId = new Map(categories.map((c) => [c.id, c]));
  const ids = new Set<number>([...nowById.keys(), ...prevById.keys()]);
  return [...ids]
    .map((id) => {
      const c = byId.get(id);
      return {
        id,
        name: c?.name ?? "?",
        color: c?.color ?? "#888",
        icon: c?.icon ?? "•",
        now: nowById.get(id) ?? 0,
        prev: prevById.get(id) ?? 0,
      };
    })
    .sort((a, b) => b.now + b.prev - (a.now + a.prev));
}

/** Conmutador €/% que viaja a la cabecera del widget (junto a la X). */
function PctEurToggle({ mode, onToggle }: { mode: "eur" | "pct"; onToggle: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={onToggle}
      title={mode === "eur" ? "Mostrar variación en %" : "Mostrar diferencia en €"}
    >
      {mode === "eur" ? "€" : "%"}
    </Button>
  );
}

/** Filtro acotado al rango de fechas seleccionado en el dashboard. */
function scope(p: WidgetProps): TxFilters {
  return {
    accountId: p.accountId,
    from: p.from,
    to: p.to,
    excludeInternal: p.excludeInternal,
  };
}

const KpiBody: FC<WidgetProps> = (p) => {
  const [k, setK] = useState<KpiSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    void kpis(scope(p)).then((data) => { if (!cancelled) setK(data); });
    return () => { cancelled = true; };
  }, [p.accountId, p.from, p.to, p.excludeInternal, p.version]);
  if (!k) return <span className="muted">…</span>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Kpi label="Ingresos" value={k.income} cls="good" />
      <Kpi label="Gastos" value={k.expense} cls="bad" />
      <Kpi label="Ahorro" value={k.net} cls={k.net >= 0 ? "good" : "bad"} />
      <div className="kpi" style={{ padding: 0, border: "none", background: "transparent" }}>
        <div className="label">Tasa de ahorro</div>
        <div className={`value ${k.savingsRate >= 0 ? "good" : "bad"}`}>{k.savingsRate.toFixed(0)}%</div>
      </div>
    </div>
  );
};

function Kpi({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="kpi" style={{ padding: 0, border: "none", background: "transparent" }}>
      <div className="label">{label}</div>
      <div className={`value ${cls}`} style={{ fontSize: 22 }}>{formatEUR(value)}</div>
    </div>
  );
}

const CategoryDonutBody: FC<WidgetProps> = (p) => {
  const { categories } = useApp();
  const [valueById, setValueById] = useState<Map<number, number>>(new Map());
  // Pila de drill-down: ids de categorías padre por las que se ha ido entrando.
  const [stack, setStack] = useState<number[]>([]);
  // Categorías ocultadas desde la leyenda (clic en la lista de la derecha).
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  // Rango de fechas propio del widget (sobrescribe el global si se usa).
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const { colors, override, setOverride } = useChartPalette(p.widgetKey);
  const from = range?.from ?? p.from;
  const to = range?.to ?? p.to;

  useEffect(() => {
    let cancelled = false;
    void spendByCategoryId(scope({ ...p, from, to })).then((rows) => {
      if (cancelled) return;
      setValueById(new Map(rows.map((r) => [r.id, r.value])));
      setStack([]); // al cambiar filtros/datos, vuelve a la vista de padres
      setHidden(new Set()); // y también limpia las categorías ocultadas
    });
    return () => { cancelled = true; };
  }, [p.accountId, from, to, p.excludeInternal, p.version]);

  const toggleHidden = (id: number) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const parentId = stack.length ? stack[stack.length - 1] : null;
  const slices = useMemo(
    () => donutSlices(categories, valueById, parentId),
    [categories, valueById, parentId],
  );
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  if (valueById.size === 0)
    return <span className="muted">Sin gastos en el periodo seleccionado.</span>;

  const onSlice = (id: number) => setStack((s) => [...s, id]);

  const centerLabel = parentId != null ? byId.get(parentId)?.name : undefined;

  return (
    <div className="widget" style={{ gap: 6 }}>
      <div className="row" style={{ fontSize: 12, minHeight: 20, flexWrap: "wrap" }}>
        {stack.length === 0 ? (
          <span className="muted">Clic en una categoría para ver sus subcategorías</span>
        ) : (
          <>
            <button className="link-btn" onClick={() => setStack([])}>Todas</button>
            {stack.map((id, i) => (
              <span key={id}>
                <span className="muted"> › </span>
                <button className="link-btn" onClick={() => setStack(stack.slice(0, i + 1))}>
                  {byId.get(id)?.name ?? "?"}
                </button>
              </span>
            ))}
            <span className="spacer" />
            <button className="link-btn" onClick={() => setStack((s) => s.slice(0, -1))}>← Volver</button>
          </>
        )}
      </div>
      <div className="widget-body">
        <NivoDonut
          slices={slices}
          centerLabel={centerLabel}
          onSlice={onSlice}
          palette={colors}
          hiddenIds={hidden}
          onToggleId={toggleHidden}
        />
      </div>
      {p.headerSlot &&
        createPortal(
          <>
            <PaletteMenu value={override} onChange={setOverride} />
            <DateRangeMenu from={from} to={to} anchor={p.to} onChange={(f, t) => setRange({ from: f, to: t })} />
          </>,
          p.headerSlot,
        )}
    </div>
  );
};

const NetWorthBody: FC<WidgetProps> = (p) => {
  const [nw, setNw] = useState<NetWorthNow | null>(null);
  useEffect(() => {
    let cancelled = false;
    void netWorthNow().then((data) => { if (!cancelled) setNw(data); });
    return () => { cancelled = true; };
  }, [p.version]);
  if (!nw) return <span className="muted">…</span>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Kpi label="Activos" value={nw.assets} cls="good" />
      <Kpi label="Pasivos" value={nw.liabilities} cls="bad" />
      <div className="kpi" style={{ gridColumn: "1 / -1", padding: 0, border: "none", background: "transparent" }}>
        <div className="label">Patrimonio neto</div>
        <div className={`value ${nw.net >= 0 ? "good" : "bad"}`}>{formatEUR(nw.net)}</div>
      </div>
    </div>
  );
};

const MonthlyBarsBody: FC<WidgetProps> = (p) => {
  const [data, setData] = useState<MonthlyFlow[]>([]);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const { id, style, setStyle } = useBarStyle(p.widgetKey);
  const from = range?.from ?? p.from;
  const to = range?.to ?? p.to;
  useEffect(() => {
    let cancelled = false;
    void monthlyFlows({ ...scope(p), from, to }).then((data) => { if (!cancelled) setData(data); });
    return () => { cancelled = true; };
  }, [p.accountId, from, to, p.excludeInternal, p.version]);
  if (data.length === 0) return <span className="muted">Sin datos.</span>;
  return (
    <>
      <NivoFlows rows={data} style={style} />
      {p.headerSlot &&
        createPortal(
          <>
            <BarStyleMenu value={id} onChange={setStyle} intrinsic={{ past: "var(--bad)", now: "var(--good)" }} />
            <DateRangeMenu from={from} to={to} anchor={p.to} onChange={(f, t) => setRange({ from: f, to: t })} />
          </>,
          p.headerSlot,
        )}
    </>
  );
};

const BalanceLineBody: FC<WidgetProps> = (p) => {
  const [data, setData] = useState<BalancePoint[]>([]);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const { colors, override, setOverride } = useChartPalette(p.widgetKey);
  const { isMinimalist } = useApp();
  useEffect(() => {
    let cancelled = false;
    const load = p.accountId === "all" ? netWorthSeries() : accountBalanceSeries(p.accountId);
    void load.then((data) => { if (!cancelled) setData(data); });
    return () => { cancelled = true; };
  }, [p.accountId, p.version]);
  if (data.length === 0) return <span className="muted">Sin datos.</span>;
  const from = range?.from ?? p.from;
  const to = range?.to ?? p.to;
  const fM = from.slice(0, 7);
  const tM = to.slice(0, 7);
  const points = data.filter((pt) => pt.month >= fM && pt.month <= tM);
  const name = p.accountId === "all" ? "Patrimonio neto" : "Saldo";
  const current = points.length > 0 ? points[points.length - 1].saldo : null;
  const first = points.length > 0 ? points[0].saldo : null;
  const delta = current !== null && first !== null && first !== 0
    ? ((current - first) / Math.abs(first)) * 100
    : null;
  const deltaAbs = current !== null && first !== null ? current - first : null;
  const deltaUp = delta !== null && delta >= 0;

  return (
    <>
      {isMinimalist ? (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* KPI header */}
          {current !== null && (
            <div style={{ padding: "8px 16px 0", display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1 }}>
                {formatEUR(current)}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", opacity: 0.5 }}>
                {name}
              </span>
              {deltaAbs !== null && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1, color: deltaUp ? "var(--good)" : "var(--bad)" }}>
                  {deltaUp ? "+" : ""}{formatEUR(deltaAbs)}
                </span>
              )}
              {delta !== null && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                    color: deltaUp ? "var(--good)" : "var(--bad)",
                    background: `color-mix(in srgb, ${deltaUp ? "var(--good)" : "var(--bad)"} 14%, transparent)`,
                    borderRadius: 9999,
                    padding: "1px 6px",
                    lineHeight: "16px",
                  }}
                >
                  {deltaUp ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
                </span>
              )}
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0 }}>
            <NivoBalanceMinimalist
              points={points}
              name={name}
              palette={colors}
            />
          </div>
        </div>
      ) : (
        <NivoBalance points={points} name={name} palette={colors} />
      )}
      {p.headerSlot &&
        createPortal(
          <>
            <PaletteMenu value={override} onChange={setOverride} />
            <DateRangeMenu from={from} to={to} anchor={p.to} onChange={(f, t) => setRange({ from: f, to: t })} />
          </>,
          p.headerSlot,
        )}
    </>
  );
};

const CashBody: FC<WidgetProps> = (p) => {
  const [data, setData] = useState<CashPoint[]>([]);
  const { colors, override, setOverride } = useChartPalette(p.widgetKey);
  useEffect(() => {
    let cancelled = false;
    void cashByMonth(scope(p)).then((data) => { if (!cancelled) setData(data); });
    return () => { cancelled = true; };
  }, [p.accountId, p.from, p.to, p.excludeInternal, p.version]);
  if (data.length === 0) return <span className="muted">Sin disposiciones de efectivo.</span>;
  const total = data.reduce((s, r) => s + r.total, 0);
  return (
    <div className="widget" style={{ gap: 6 }}>
      <div className="muted">Total retirado: <b style={{ color: "var(--text)" }}>{formatEUR(total)}</b></div>
      <div className="widget-body"><NivoCash rows={data} palette={colors} /></div>
      {p.headerSlot && createPortal(<PaletteMenu value={override} onChange={setOverride} />, p.headerSlot)}
    </div>
  );
};

const BudgetsBody: FC<WidgetProps> = (p) => {
  const [rows, setRows] = useState<BudgetRow[]>([]);
  // Los presupuestos son mensuales: se muestran los del mes de la fecha «hasta».
  const month = monthKey(p.to || "");
  useEffect(() => {
    let cancelled = false;
    if (month) void listBudgets(month).then((data) => { if (!cancelled) setRows(data); });
    return () => { cancelled = true; };
  }, [month, p.version]);
  if (rows.length === 0)
    return <span className="muted">Define presupuestos en la pestaña «Presupuestos».</span>;
  return <NivoBudgets rows={rows} />;
};

const SubscriptionsBody: FC<WidgetProps> = (p) => {
  const [rows, setRows] = useState<Subscription[]>([]);
  useEffect(() => {
    let cancelled = false;
    void detectSubscriptions().then((data) => { if (!cancelled) setRows(data); });
    return () => { cancelled = true; };
  }, [p.version]);
  if (rows.length === 0) return <span className="muted">No se detectaron pagos recurrentes.</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
      {rows.slice(0, 12).map((s) => (
        <div className="row" key={s.merchant} style={{ fontSize: 13 }}>
          <span title={s.merchant} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
            {s.merchant}
          </span>
          <span className="spacer" />
          <span className="muted">{s.months} meses</span>
          <span style={{ width: 80, textAlign: "right" }}>{formatEUR(s.avg_amount)}</span>
        </div>
      ))}
    </div>
  );
};

const GoalsBody: FC<WidgetProps> = (p) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  useEffect(() => {
    let cancelled = false;
    void listGoals().then((data) => { if (!cancelled) setGoals(data); });
    return () => { cancelled = true; };
  }, [p.version]);
  if (goals.length === 0)
    return <span className="muted">Define metas en la pestaña «Metas».</span>;
  return <NivoGoals goals={goals} />;
};

const UpcomingBody: FC<WidgetProps> = (p) => {
  const [rows, setRows] = useState<ScheduledRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    void listScheduled().then((data) => { if (!cancelled) setRows(data); });
    return () => { cancelled = true; };
  }, [p.version]);
  if (rows.length === 0)
    return <span className="muted">Programa pagos en la pestaña «Programados».</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
      {rows.slice(0, 12).map((s) => {
        const d = daysUntil(s.next_date);
        const overdue = d < 0;
        return (
          <div className="row" key={s.id} style={{ fontSize: 13 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
              {s.category_icon ?? "📅"} {s.name}
            </span>
            <span className="spacer" />
            <span className={overdue ? "amount neg" : "muted"} style={{ fontSize: 12 }}>
              {overdue ? `−${-d}d` : `${d}d`}
            </span>
            <span style={{ width: 80, textAlign: "right" }}>{formatEUR(s.amount)}</span>
          </div>
        );
      })}
    </div>
  );
};

const ReceiptItemsBody: FC<WidgetProps> = (p) => {
  const [rows, setRows] = useState<ItemAggregate[]>([]);
  useEffect(() => {
    let cancelled = false;
    void topReceiptItems(12).then((data) => { if (!cancelled) setRows(data); });
    return () => { cancelled = true; };
  }, [p.version]);
  if (rows.length === 0)
    return <span className="muted">Desglosa recibos (📎 en Movimientos) para ver en qué se va el dinero.</span>;
  const max = rows[0]?.total || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
      {rows.map((r) => (
        <div key={r.description}>
          <div className="row" style={{ fontSize: 13 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{r.description}</span>
            <span className="spacer" />
            <span className="muted">{formatEUR(r.total)}{r.n > 1 ? ` · ${r.n}×` : ""}</span>
          </div>
          <div className="bar">
            <span style={{ width: `${(r.total / max) * 100}%`, background: "var(--accent)" }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const CalendarBody: FC<WidgetProps> = (p) => {
  const [data, setData] = useState<DailySpend[]>([]);
  const { colors, override, setOverride } = useChartPalette(p.widgetKey);
  useEffect(() => {
    let cancelled = false;
    void dailySpend(scope(p)).then((data) => { if (!cancelled) setData(data); });
    return () => { cancelled = true; };
  }, [p.accountId, p.from, p.to, p.excludeInternal, p.version]);
  if (data.length === 0) return <span className="muted">Sin gastos en el periodo seleccionado.</span>;
  return (
    <>
      <NivoCalendar data={data} from={p.from} to={p.to} palette={colors} />
      {p.headerSlot && createPortal(<PaletteMenu value={override} onChange={setOverride} />, p.headerSlot)}
    </>
  );
};

const SunburstBody: FC<WidgetProps> = (p) => {
  const { categories } = useApp();
  const [valueById, setValueById] = useState<Map<number, number>>(new Map());
  const { colors, override, setOverride } = useChartPalette(p.widgetKey);
  useEffect(() => {
    let cancelled = false;
    void spendByCategoryId(scope(p)).then((rows) => {
      if (cancelled) return;
      setValueById(new Map(rows.map((r) => [r.id, r.value])));
    });
    return () => { cancelled = true; };
  }, [p.accountId, p.from, p.to, p.excludeInternal, p.version]);
  const root = useMemo(() => categorySunburst(categories, valueById), [categories, valueById]);
  if (valueById.size === 0) return <span className="muted">Sin gastos en el periodo seleccionado.</span>;
  return (
    <>
      <NivoSunburst root={root} palette={colors} />
      {p.headerSlot && createPortal(<PaletteMenu value={override} onChange={setOverride} />, p.headerSlot)}
    </>
  );
};

const MonthCompareBody: FC<WidgetProps> = (p) => {
  const { categories } = useApp();
  const [data, setData] = useState<{ now: number; prev: number } | null>(null);
  const excludedIds = useMemo(() => excludedExpenseIds(categories), [categories]);
  useEffect(() => {
    let cancelled = false;
    const d = new Date();
    const thisM = ym(d);
    const prevM = ym(new Date(d.getFullYear(), d.getMonth() - 1, 1));
    const base = {
      accountId: p.accountId,
      excludeInternal: p.excludeInternal,
      excludeCategoryIds: excludedIds,
    };
    void Promise.all([kpis({ ...base, month: thisM }), kpis({ ...base, month: prevM })]).then(
      ([a, b]) => { if (!cancelled) setData({ now: a.expense, prev: b.expense }); },
    );
    return () => { cancelled = true; };
  }, [p.accountId, p.excludeInternal, p.version, excludedIds]);

  if (!data) return <span className="muted">…</span>;
  const delta = data.prev > 0 ? ((data.now - data.prev) / data.prev) * 100 : 0;
  const up = data.now > data.prev; // gastar más que el mes pasado = peor
  return (
    <div className="relative flex h-full flex-col justify-center gap-4 overflow-hidden">
      {/* Acento superior degradado (coherente con «Gastos de este mes») */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-20 opacity-[0.07]"
        style={{ background: "linear-gradient(180deg, var(--accent), transparent)" }}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-muted-foreground">Gasto este mes</div>
          <div className="font-mono text-3xl font-bold tabular-nums text-foreground">{formatEUR(data.now)}</div>
        </div>
        {data.prev > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-semibold tabular-nums"
            style={{
              color: up ? "var(--bad)" : "var(--good)",
              background: `color-mix(in srgb, ${up ? "var(--bad)" : "var(--good)"} 14%, transparent)`,
            }}
          >
            {up ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>
      <div className="relative">
        <div className="text-xs text-muted-foreground">Mes pasado</div>
        <div className="font-mono text-lg tabular-nums text-muted-foreground">{formatEUR(data.prev)}</div>
      </div>
      <div className="relative text-[11px] text-muted-foreground/70">sin alquiler ni coche</div>
    </div>
  );
};

const MonthExpenseBody: FC<WidgetProps> = (p) => {
  const { categories, iconStyle } = useApp();
  const [data, setData] = useState<{ now: number; prev: number; day: number } | null>(null);
  const excludedIds = useMemo(() => excludedExpenseIds(categories), [categories]);
  const excluded = useMemo(() => excludedRoots(categories), [categories]);

  useEffect(() => {
    let cancelled = false;
    const d = new Date();
    const thisM = ym(d);
    const prevM = ym(new Date(d.getFullYear(), d.getMonth() - 1, 1));
    const base = {
      accountId: p.accountId,
      excludeInternal: p.excludeInternal,
      excludeCategoryIds: excludedIds,
    };
    void Promise.all([kpis({ ...base, month: thisM }), kpis({ ...base, month: prevM })]).then(
      ([a, b]) => { if (!cancelled) setData({ now: a.expense, prev: b.expense, day: d.getDate() }); },
    );
    return () => { cancelled = true; };
  }, [p.accountId, p.excludeInternal, p.version, excludedIds]);

  if (!data) return <span className="muted">…</span>;
  const delta = data.prev > 0 ? ((data.now - data.prev) / data.prev) * 100 : 0;
  const up = data.now > data.prev; // gastar más = peor
  const perDay = data.day > 0 ? data.now / data.day : 0;

  return (
    <div className="relative flex h-full flex-col gap-3 overflow-hidden">
      {/* Acento superior degradado */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-20 opacity-[0.07]"
        style={{ background: "linear-gradient(180deg, var(--accent), transparent)" }}
      />
      <div className="relative flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground">Gasto corriente del mes</span>
        {data.prev > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-semibold tabular-nums"
            style={{
              color: up ? "var(--bad)" : "var(--good)",
              background: `color-mix(in srgb, ${up ? "var(--bad)" : "var(--good)"} 14%, transparent)`,
            }}
          >
            {up ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>

      <div className="relative">
        <div className="font-mono text-4xl font-bold leading-none tabular-nums text-foreground">
          {formatEUR(data.now)}
        </div>
        <div className="mt-1.5 text-xs text-muted-foreground">
          ≈ {formatEUR(perDay)}/día · mes pasado {formatEUR(data.prev)}
        </div>
      </div>

      <div className="relative mt-auto flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground">Excluye</span>
        {excluded.length === 0 ? (
          <span className="text-[11px] text-muted-foreground/70">alquiler · coche y moto</span>
        ) : (
          excluded.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
              style={{
                borderColor: `color-mix(in srgb, ${c.color} 45%, transparent)`,
                background: `color-mix(in srgb, ${c.color} 12%, transparent)`,
                color: "var(--text)",
              }}
            >
              <CategoryGlyph icon={c.icon} mode={iconStyle} />
              {c.name}
            </span>
          ))
        )}
      </div>
    </div>
  );
};

/** Hook común a los dos comparadores: carga el gasto por categoría de este mes vs el
 *  pasado y mantiene el conmutador €/%. */
function useCategoryCompare(p: WidgetProps) {
  const { categories } = useApp();
  const [rows, setRows] = useState<CatCompareRow[] | null>(null);
  const [mode, setMode] = useState<"eur" | "pct">("eur");
  useEffect(() => {
    let cancelled = false;
    const d = new Date();
    const thisM = ym(d);
    const prevM = ym(new Date(d.getFullYear(), d.getMonth() - 1, 1));
    void categoryCompare(categories, { accountId: p.accountId, excludeInternal: p.excludeInternal }, thisM, prevM).then(
      (data) => { if (!cancelled) setRows(data); },
    );
    return () => { cancelled = true; };
  }, [p.accountId, p.excludeInternal, p.version, categories]);
  return { rows, mode, toggle: () => setMode((m) => (m === "eur" ? "pct" : "eur")) };
}

const CatCompareBody: FC<WidgetProps> = (p) => {
  const { iconStyle } = useApp();
  const { rows, mode, toggle } = useCategoryCompare(p);
  const toggleEl = p.headerSlot && createPortal(<PctEurToggle mode={mode} onToggle={toggle} />, p.headerSlot);

  if (!rows) return <span className="muted">…</span>;
  if (rows.length === 0)
    return (
      <>
        <span className="muted">Sin gastos este mes ni el pasado.</span>
        {toggleEl}
      </>
    );

  return (
    <div className="flex h-full flex-col gap-1.5 overflow-y-auto">
      {rows.map((r) => {
        const diff = r.now - r.prev;
        const up = diff > 0;
        // Etiqueta de la diferencia según el modo (€ de diferencia o % de variación).
        let label: string;
        if (mode === "eur") {
          label = `${up ? "+" : diff < 0 ? "−" : ""}${formatEUR(Math.abs(diff))}`;
        } else if (r.prev === 0) {
          label = "nuevo";
        } else {
          const pct = (diff / r.prev) * 100;
          label = `${up ? "+" : "−"}${Math.abs(pct).toFixed(0)}%`;
        }
        const tone = up ? "var(--bad)" : diff < 0 ? "var(--good)" : "var(--text-dim)";
        return (
          <div key={r.id} className="flex items-center gap-2 text-[13px]">
            <span className="flex min-w-0 items-center gap-1.5">
              <span style={{ color: r.color }}>
                <CategoryGlyph icon={r.icon} mode={iconStyle} />
              </span>
              <span className="truncate text-foreground">{r.name}</span>
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-2 font-mono tabular-nums">
              <span className="text-muted-foreground/70">{formatEUR(r.prev)}</span>
              <span aria-hidden className="text-muted-foreground/40">→</span>
              <span className="font-semibold text-foreground">{formatEUR(r.now)}</span>
              <span
                className="inline-flex w-[64px] justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ color: tone, background: `color-mix(in srgb, ${tone} 14%, transparent)` }}
              >
                {label}
              </span>
            </span>
          </div>
        );
      })}
      {toggleEl}
    </div>
  );
};

const CatCompareBarsBody: FC<WidgetProps> = (p) => {
  const { rows, mode, toggle } = useCategoryCompare(p);
  const { id, style, setStyle } = useBarStyle(p.widgetKey);
  const headerEl =
    p.headerSlot &&
    createPortal(
      <>
        <BarStyleMenu value={id} onChange={setStyle} intrinsic={{ past: "var(--text-dim)", now: "var(--text)" }} />
        <PctEurToggle mode={mode} onToggle={toggle} />
      </>,
      p.headerSlot,
    );
  if (!rows) return <span className="muted">…</span>;
  if (rows.length === 0)
    return (
      <>
        <span className="muted">Sin gastos este mes ni el pasado.</span>
        {headerEl}
      </>
    );
  return (
    <>
      <NivoCategoryCompare rows={rows} mode={mode} style={style} />
      {headerEl}
    </>
  );
};

/* ---- Debug: desglose de ingresos por categoría ---- */
const IncomeDebugBody: FC<WidgetProps> = (p) => {
  const [rows, setRows] = useState<IncomeDebugRow[]>([]);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const from = range?.from ?? p.from;
  const to = range?.to ?? p.to;
  useEffect(() => {
    let cancelled = false;
    void debugIncomeBreakdown(from, to).then((data) => { if (!cancelled) setRows(data); });
    return () => { cancelled = true; };
  }, [from, to, p.version]);
  if (rows.length === 0) return <span className="muted">Sin datos.</span>;
  return (
    <div className="widget" style={{ gap: 6 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.5, overflowX: "auto", flex: 1, minHeight: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #EAEAEA", color: "var(--text-dim, #787774)" }}>
              <th style={{ padding: "4px 8px" }}>Mes</th>
              <th style={{ padding: "4px 8px" }}>Categoría</th>
              <th style={{ padding: "4px 8px" }}>Kind</th>
              <th style={{ padding: "4px 8px", textAlign: "right" }}>N</th>
              <th style={{ padding: "4px 8px", textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                <td style={{ padding: "3px 8px" }}>{r.month}</td>
                <td style={{ padding: "3px 8px" }}>{r.category}</td>
                <td style={{ padding: "3px 8px", opacity: 0.6 }}>{r.kind ?? "—"}</td>
                <td style={{ padding: "3px 8px", textAlign: "right" }}>{r.cnt}</td>
                <td style={{ padding: "3px 8px", textAlign: "right", color: r.total >= 0 ? "var(--good)" : "var(--bad)" }}>
                  {formatEUR(r.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {p.headerSlot &&
        createPortal(
          <DateRangeMenu from={from} to={to} anchor={p.to} onChange={(f, t) => setRange({ from: f, to: t })} />,
          p.headerSlot,
        )}
    </div>
  );
};

export interface WidgetDef {
  key: string;
  title: string;
  w: number;
  h: number;
  Body: FC<WidgetProps>;
}

export const WIDGETS: WidgetDef[] = [
  { key: "donut", title: "Gasto por categoría", w: 8, h: 10, Body: CategoryDonutBody },
  { key: "kpis", title: "Resumen del periodo", w: 4, h: 4, Body: KpiBody },
  { key: "monthcompare", title: "Gasto: mes pasado vs este mes", w: 4, h: 4, Body: MonthCompareBody },
  { key: "monthexpense", title: "Gastos de este mes", w: 4, h: 5, Body: MonthExpenseBody },
  { key: "catcompare", title: "Comparativa por categoría", w: 4, h: 7, Body: CatCompareBody },
  { key: "catcomparebars", title: "Comparativa por categoría (barras)", w: 6, h: 7, Body: CatCompareBarsBody },
  { key: "networth", title: "Patrimonio neto", w: 4, h: 4, Body: NetWorthBody },
  { key: "bars", title: "Gastos vs ingresos por mes", w: 8, h: 8, Body: MonthlyBarsBody },
  { key: "balance", title: "Evolución de saldo / patrimonio", w: 8, h: 8, Body: BalanceLineBody },
  { key: "budgets", title: "Presupuestos del mes", w: 4, h: 8, Body: BudgetsBody },
  { key: "goals", title: "Metas de ahorro", w: 4, h: 7, Body: GoalsBody },
  { key: "upcoming", title: "Próximos pagos", w: 4, h: 7, Body: UpcomingBody },
  { key: "items", title: "En qué se gasta (recibos)", w: 4, h: 7, Body: ReceiptItemsBody },
  { key: "cash", title: "Efectivo en cajero", w: 6, h: 7, Body: CashBody },
  { key: "subs", title: "Pagos recurrentes", w: 6, h: 7, Body: SubscriptionsBody },
  { key: "calendar", title: "Gasto diario (calendario)", w: 8, h: 6, Body: CalendarBody },
  { key: "sunburst", title: "Categorías (sunburst)", w: 6, h: 10, Body: SunburstBody },
  { key: "debug_income", title: "DEBUG: Ingresos por categoría", w: 8, h: 8, Body: IncomeDebugBody },
];
