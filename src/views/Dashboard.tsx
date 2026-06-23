import { useEffect, useState, type FC } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "react-router-dom";
import { useApp } from "../state/AppContext";
import { AccountSelector, DateRange, ExcludeInternalToggle } from "../components/Controls";
import { WIDGETS, type WidgetProps } from "../widgets/widgets";
import { dateBounds } from "../data/transactions";
import { loadLayout, saveLayoutItem, setWidgetVisible, resetLayout } from "../data/dashboard";

const WIDTHS = [4, 6, 8, 12]; // 1/3, 1/2, 2/3, ancho completo (de 12 columnas)

interface WState {
  key: string;
  w: number; // columnas (1..12)
  h: number; // filas de 40px
  visible: boolean;
}

export function Dashboard() {
  const { accountId, excludeInternal, version, reload } = useApp();
  const [bounds, setBounds] = useState<{ min: string; max: string } | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState<WState[]>([]);
  const [ready, setReady] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

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
      const list = WIDGETS.map((w, i) => {
        const r = byKey.get(w.key);
        return {
          key: w.key,
          w: r?.w ?? w.w,
          h: r?.h ?? w.h,
          visible: r ? !!r.visible : true,
          order: r?.x ?? i,
        };
      });
      list.sort((a, b2) => a.order - b2.order);
      setItems(list.map(({ key, w, h, visible }) => ({ key, w, h, visible })));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [version]);

  /** Guarda el orden, tamaño y visibilidad de todos los widgets. */
  function persist(list: WState[]) {
    list.forEach((it, idx) => void saveLayoutItem(it.key, idx, 0, it.w, it.h, it.visible ? 1 : 0));
  }

  function commit(next: WState[]) {
    setItems(next);
    persist(next);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.key === active.id);
    const newIndex = items.findIndex((i) => i.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    commit(arrayMove(items, oldIndex, newIndex));
  }

  function cycleWidth(key: string) {
    commit(
      items.map((it) =>
        it.key === key ? { ...it, w: WIDTHS[(WIDTHS.indexOf(it.w) + 1) % WIDTHS.length] } : it,
      ),
    );
  }
  function bumpHeight(key: string, delta: number) {
    commit(items.map((it) => (it.key === key ? { ...it, h: Math.max(3, it.h + delta) } : it)));
  }
  function hide(key: string) {
    commit(items.map((it) => (it.key === key ? { ...it, visible: false } : it)));
  }
  function show(key: string) {
    const next = items.map((it) => (it.key === key ? { ...it, visible: true } : it));
    setItems(next);
    void setWidgetVisible(key, 1);
  }
  async function resetDash() {
    await resetLayout();
    reload();
  }

  if (ready && !bounds) {
    return (
      <div>
        <div className="topbar"><h1>Dashboard</h1></div>
        <div className="import-box">
          <p>Aún no hay movimientos.</p>
          <Link to="/importar"><button className="primary">Importar un extracto PDF</button></Link>
        </div>
      </div>
    );
  }

  const visibleItems = items.filter((it) => it.visible);
  const hidden = items.filter((it) => !it.visible);
  const props: WidgetProps = { accountId, excludeInternal, from, to, version };

  return (
    <div>
      <div className="topbar">
        <h1>Dashboard</h1>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <AccountSelector />
          <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} min={bounds?.min} max={bounds?.max} />
          <ExcludeInternalToggle />
          {hidden.length > 0 && (
            <select value="" onChange={(e) => e.target.value && show(e.target.value)} title="Añadir widget">
              <option value="">+ Añadir widget</option>
              {hidden.map((it) => {
                const def = WIDGETS.find((w) => w.key === it.key);
                return <option key={it.key} value={it.key}>{def?.title ?? it.key}</option>;
              })}
            </select>
          )}
          <button onClick={() => void resetDash()} title="Volver a la disposición por defecto">
            Restablecer disposición
          </button>
        </div>
      </div>

      {ready && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={visibleItems.map((i) => i.key)} strategy={rectSortingStrategy}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(12, 1fr)",
                gridAutoRows: "40px",
                gap: 14,
              }}
            >
              {visibleItems.map((it) => (
                <SortableWidget
                  key={it.key}
                  item={it}
                  props={props}
                  onCycleWidth={() => cycleWidth(it.key)}
                  onTaller={() => bumpHeight(it.key, 1)}
                  onShorter={() => bumpHeight(it.key, -1)}
                  onHide={() => hide(it.key)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableWidget({
  item,
  props,
  onCycleWidth,
  onTaller,
  onShorter,
  onHide,
}: {
  item: WState;
  props: WidgetProps;
  onCycleWidth: () => void;
  onTaller: () => void;
  onShorter: () => void;
  onHide: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  });
  const def = WIDGETS.find((w) => w.key === item.key);
  if (!def) return null;
  const Body: FC<WidgetProps> = def.Body;

  return (
    <div
      ref={setNodeRef}
      className="card widget"
      style={{
        gridColumn: `span ${item.w}`,
        gridRow: `span ${item.h}`,
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 100 : undefined,
        opacity: isDragging ? 0.85 : 1,
        boxShadow: isDragging ? "0 10px 28px rgba(0,0,0,0.45)" : undefined,
      }}
    >
      <div className="widget-head">
        <span className="row" style={{ gap: 6, fontWeight: 600, fontSize: 13, minWidth: 0 }}>
          <span
            className="grip"
            title="Arrastra para mover"
            style={{ cursor: "grab", touchAction: "none" }}
            {...attributes}
            {...listeners}
          >
            ⠿
          </span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{def.title}</span>
        </span>
        <span className="row" style={{ gap: 2 }}>
          <button className="widget-hide" onClick={onShorter} title="Más bajo">▾</button>
          <button className="widget-hide" onClick={onTaller} title="Más alto">▴</button>
          <button className="widget-hide" onClick={onCycleWidth} title="Cambiar ancho">⇄</button>
          <button className="widget-hide" onClick={onHide} title="Ocultar">✕</button>
        </span>
      </div>
      <div className="widget-body">
        <Body {...props} />
      </div>
    </div>
  );
}
