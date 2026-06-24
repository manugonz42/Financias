import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Eraser, ArrowRight } from "lucide-react";
import { useApp } from "../state/AppContext";
import {
  listUncategorized,
  assignGroup,
  recategorizePending,
  clearManualCategories,
  countManualCategories,
  type UncatGroup,
} from "../data/review";
import { addRuleForKey } from "../data/rules";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/ui/button";
import { formatEUR, formatDate } from "../lib/format";

export function Categorizar() {
  const { categories, reload, toast } = useApp();
  const [groups, setGroups] = useState<UncatGroup[]>([]);
  const [idx, setIdx] = useState(0);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const g = await listUncategorized();
    setGroups(g);
    setIdx(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const current = groups[idx];

  async function assign(categoryId: number) {
    if (!current || working) return;
    setWorking(true);
    await assignGroup(current.key, categoryId);
    if (remember) await addRuleForKey(current.key, categoryId);
    reload();
    setIdx((i) => i + 1);
    setWorking(false);
  }

  function skip() {
    setIdx((i) => i + 1);
  }

  async function rebatch() {
    if (working) return;
    setWorking(true);
    try {
      const { total, updated } = await recategorizePending();
      let msg: string;
      if (total === 0) {
        msg = "No hay movimientos en «Otros gastos / Otros ingresos» para reclasificar";
      } else if (updated === 0) {
        msg = `${total} pendientes revisados, ninguno encaja con las reglas actuales`;
      } else {
        msg = `${updated} de ${total} movimientos reclasificados`;
      }
      toast(msg);
      reload();
      await load();
    } finally {
      setWorking(false);
    }
  }

  async function clearManuals() {
    if (working) return;
    const marked = await countManualCategories();
    if (marked === 0) {
      toast("No hay categorizaciones manuales en esta sesión");
      return;
    }
    if (
      !confirm(
        `Esto devolverá al fallback ${marked} movimientos que categorizaste a mano. ¿Continuar?`,
      )
    ) {
      return;
    }
    setWorking(true);
    try {
      const n = await clearManualCategories();
      toast(`${n} movimientos devueltos al fallback`);
      reload();
      await load();
    } finally {
      setWorking(false);
    }
  }

  const done = !loading && idx >= groups.length;
  const total = groups.length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-bold text-foreground">Categorizar</h1>
          {total > 0 && !done && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {idx} / {total}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void rebatch()}
            disabled={working}
            title="Reaplica las reglas actuales a todos los movimientos en «Otros gastos/Otros ingresos»"
          >
            <RefreshCw /> Re-clasificar pendientes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void clearManuals()}
            disabled={working}
            title="Devuelve al fallback los movimientos que asignaste a mano"
          >
            <Eraser /> Borrar manuales
          </Button>
        </div>
      </div>

      <p className="mb-4 max-w-[680px] text-sm text-muted-foreground">
        Movimientos que quedaron en <b className="text-foreground">«Otros gastos»</b>,
        agrupados por comercio. Asigna una categoría y se aplicará a{" "}
        <b className="text-foreground">todos</b> los movimientos con ese mismo
        concepto. Si marcas «recordar», las próximas importaciones lo
        categorizarán solas.
      </p>

      {loading && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Cargando…
        </div>
      )}

      {!loading && total === 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <EmptyState
            icon="🎉"
            title="No hay nada sin clasificar"
            hint="Todos los gastos tienen categoría. Cuando importes nuevos extractos, lo que no se categorice solo aparecerá aquí."
            action={
              <Link to="/movimientos">
                <Button>Ver movimientos</Button>
              </Link>
            }
          />
        </div>
      )}

      {done && total > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm">
            ✅ Revisión completada: {total} conceptos procesados.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Buscar más
            </Button>
            <Link to="/movimientos">
              <Button size="sm">Ver movimientos</Button>
            </Link>
          </div>
        </div>
      )}

      {current && !done && (
        <div className="grid gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Concepto
            </div>
            <div className="mt-1 break-words text-lg font-semibold text-foreground">
              {current.key}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip label="Movimientos" value={current.count.toString()} />
              <Chip
                label="Total"
                value={formatEUR(current.total)}
                tone="negative"
              />
              <Chip label="Último" value={formatDate(current.last_seen)} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Asignar categoría
              </h3>
              <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Recordar para próximas importaciones
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => void assign(c.id)}
                  disabled={working}
                  className="group flex items-center gap-2 overflow-hidden rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-50"
                >
                  <span
                    aria-hidden
                    className="h-6 w-1 shrink-0 rounded-full"
                    style={{ background: c.color }}
                  />
                  <span className="text-base leading-none">{c.icon}</span>
                  <span className="truncate text-foreground">{c.name}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={skip}
                disabled={working}
              >
                Saltar <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "negative";
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
      <span>{label}:</span>
      <b
        className={
          tone === "negative"
            ? "text-destructive font-mono tabular-nums"
            : "text-foreground font-mono tabular-nums"
        }
      >
        {value}
      </b>
    </span>
  );
}
