import { useEffect, useMemo, useState, type FC } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import { Link } from "react-router-dom";
import { RefreshCw, RotateCcw, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "../state/AppContext";
import { AccountSelector, DateRange, ExcludeInternalToggle } from "../components/Controls";
import { WIDGETS, type WidgetProps, type WidgetDef } from "../widgets/widgets";
import { dateBounds } from "../data/transactions";
import { loadLayout, saveLayoutItem, setWidgetVisible, resetLayout } from "../data/dashboard";

const ReactGridLayout = WidthProvider(GridLayout);
const COLS = 12;

interface WState {
  key: string;
  x: number;
  y: number;
  w: number; // columnas (1..12)
  h: number; // filas de 40px
  visible: boolean;
}

/** Empaqueta en "estantería" sobre 12 columnas → disposición inicial sin solapes. */
function flowPack(list: { key: string; w: number; h: number }[]): Map<string, { x: number; y: number; w: number; h: number }> {
  let x = 0,
    y = 0,
    rowH = 0;
  const out = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const it of list) {
    if (x + it.w > COLS) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    out.set(it.key, { x, y, w: it.w, h: it.h });
    x += it.w;
    rowH = Math.max(rowH, it.h);
  }
  return out;
}

export function Dashboard() {
  const { accountId, excludeInternal, version, reload } = useApp();
  const [bounds, setBounds] = useState<{ min: string; max: string } | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState<WState[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [b, rows] = await Promise.all([dateBounds(), loadLayout()]);
      if (cancelled) return;
      setBounds(b);
      if (b) {
        setFrom((cur) => cur || b.min);
        setTo((cur) => cur || b.max);
      }
      const byKey = new Map(rows.map((r) => [r.widget_key, r]));
      // Layout antiguo (dnd-kit) guardaba y=0 y x=orden → reempaquetar para no solapar.
      const legacy = rows.length > 1 && rows.every((r) => r.y === 0);

      let list: WState[];
      if (legacy) {
        const ordered = [...WIDGETS].sort(
          (a, b2) => (byKey.get(a.key)?.x ?? 999) - (byKey.get(b2.key)?.x ?? 999),
        );
        const pos = flowPack(
          ordered.map((w) => ({ key: w.key, w: byKey.get(w.key)?.w ?? w.w, h: byKey.get(w.key)?.h ?? w.h })),
        );
        list = WIDGETS.map((w) => {
          const p = pos.get(w.key)!;
          const r = byKey.get(w.key);
          return { key: w.key, x: p.x, y: p.y, w: p.w, h: p.h, visible: r ? !!r.visible : true };
        });
      } else {
        const maxY = rows.length ? Math.max(...rows.map((r) => r.y + r.h)) : 0;
        const missing = flowPack(WIDGETS.filter((w) => !byKey.has(w.key)).map((w) => ({ key: w.key, w: w.w, h: w.h })));
        list = WIDGETS.map((w) => {
          const r = byKey.get(w.key);
          if (r) return { key: w.key, x: r.x, y: r.y, w: r.w, h: r.h, visible: !!r.visible };
          const p = missing.get(w.key)!;
          return { key: w.key, x: p.x, y: maxY + p.y, w: p.w, h: p.h, visible: true };
        });
      }
      setItems(list);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [version]);

  const visibleItems = useMemo(() => items.filter((it) => it.visible), [items]);
  const hidden = items.filter((it) => !it.visible);
  const layout: Layout[] = useMemo(
    () => visibleItems.map((it) => ({ i: it.key, x: it.x, y: it.y, w: it.w, h: it.h, minW: 3, minH: 3 })),
    [visibleItems],
  );

  /** Persiste posiciones/tamaños tras mover o redimensionar (lo dispara también la compactación). */
  function onLayoutChange(next: Layout[]) {
    setItems((prev) =>
      prev.map((it) => {
        const l = next.find((n) => n.i === it.key);
        return l ? { ...it, x: l.x, y: l.y, w: l.w, h: l.h } : it;
      }),
    );
    next.forEach((l) => void saveLayoutItem(l.i, l.x, l.y, l.w, l.h, 1));
  }

  function hide(key: string) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, visible: false } : it)));
    void setWidgetVisible(key, 0);
  }
  function show(key: string) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, visible: true } : it)));
    void setWidgetVisible(key, 1);
  }
  async function resetDash() {
    await resetLayout();
    reload();
  }

  if (ready && !bounds) {
    return (
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[22px] font-bold text-foreground">Dashboard</h1>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Aún no hay movimientos.</p>
          <Button asChild>
            <Link to="/importar">Importar un extracto PDF</Link>
          </Button>
        </div>
      </div>
    );
  }

  const props: WidgetProps = { accountId, excludeInternal, from, to, version };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[22px] font-bold text-foreground">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2.5">
          <AccountSelector />
          <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} min={bounds?.min} max={bounds?.max} />
          <ExcludeInternalToggle />
          {hidden.length > 0 && (
            <select value="" onChange={(e) => e.target.value && show(e.target.value)} title="Añadir widget">
              <option value="">+ Añadir widget</option>
              {hidden.map((it) => {
                const def = WIDGETS.find((w) => w.key === it.key);
                return (
                  <option key={it.key} value={it.key}>
                    {def?.title ?? it.key}
                  </option>
                );
              })}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={() => reload()} title="Recalcular los widgets con los datos actuales">
            <RefreshCw /> Refrescar
          </Button>
          <Button variant="outline" size="sm" onClick={() => void resetDash()} title="Volver a la disposición por defecto">
            <RotateCcw /> Restablecer
          </Button>
        </div>
      </div>

      {ready && (
        <ReactGridLayout
          className="layout"
          layout={layout}
          cols={COLS}
          rowHeight={40}
          margin={[14, 14]}
          containerPadding={[0, 0]}
          compactType="vertical"
          draggableHandle=".widget-grip"
          onLayoutChange={onLayoutChange}
          resizeHandles={["se"]}
        >
          {visibleItems.map((it) => {
            const def = WIDGETS.find((w) => w.key === it.key);
            if (!def) return <div key={it.key} />;
            return (
              <div
                key={it.key}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card p-4"
              >
                <WidgetChrome def={def} chartProps={props} onHide={() => hide(it.key)} />
              </div>
            );
          })}
        </ReactGridLayout>
      )}
    </div>
  );
}

/** Cabecera (grip + título + acciones) y cuerpo de un widget. Expone un slot de
 *  acciones (junto a la X) al que el body envía sus controles por portal. */
function WidgetChrome({
  def,
  chartProps,
  onHide,
}: {
  def: WidgetDef;
  chartProps: WidgetProps;
  onHide: () => void;
}) {
  const [actionsEl, setActionsEl] = useState<HTMLElement | null>(null);
  const Body: FC<WidgetProps> = def.Body;
  return (
    <>
      <div className="mb-2 flex select-none items-center justify-between">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <span
            className="widget-grip cursor-grab text-muted-foreground group-hover:text-primary"
            title="Arrastra para mover"
          >
            <GripVertical className="size-4" />
          </span>
          <span className="truncate">{def.title}</span>
        </span>
        <span className="flex items-center gap-0.5">
          <span ref={setActionsEl} className="flex items-center gap-0.5" />
          <Button variant="ghost" size="icon-xs" onClick={onHide} title="Ocultar">
            <X />
          </Button>
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Body {...chartProps} headerSlot={actionsEl} />
      </div>
    </>
  );
}
