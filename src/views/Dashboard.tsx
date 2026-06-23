import { useEffect, useState } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Link } from "react-router-dom";
import { useApp } from "../state/AppContext";
import { AccountSelector, DateRange, ExcludeInternalToggle } from "../components/Controls";
import { WIDGETS } from "../widgets/widgets";
import { dateBounds } from "../data/transactions";
import { loadLayout, saveLayoutItem, setWidgetVisible, resetLayout } from "../data/dashboard";

const Grid = WidthProvider(GridLayout);

function defaultLayout(): Layout[] {
  let x = 0;
  let y = 0;
  let rowH = 0;
  const out: Layout[] = [];
  for (const w of WIDGETS) {
    if (x + w.w > 12) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    out.push({ i: w.key, x, y, w: w.w, h: w.h });
    x += w.w;
    rowH = Math.max(rowH, w.h);
  }
  return out;
}

export function Dashboard() {
  const { accountId, excludeInternal, version, reload } = useApp();
  const [bounds, setBounds] = useState<{ min: string; max: string } | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [layout, setLayout] = useState<Layout[]>([]);
  const [visible, setVisible] = useState<Set<string>>(new Set());
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
      const vis = new Set<string>();
      const lay = defaultLayout().map((d) => {
        const r = byKey.get(d.i);
        if (r) {
          if (r.visible) vis.add(d.i);
          return { i: d.i, x: r.x, y: r.y, w: r.w, h: r.h };
        }
        vis.add(d.i);
        return d;
      });
      setLayout(lay);
      setVisible(vis);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [version]);

  function onLayoutChange(next: Layout[]) {
    setLayout((prev) => {
      const map = new Map(prev.map((l) => [l.i, l]));
      for (const n of next) map.set(n.i, n);
      return [...map.values()];
    });
    for (const n of next) void saveLayoutItem(n.i, n.x, n.y, n.w, n.h, 1);
  }

  function hide(key: string) {
    setVisible((v) => {
      const n = new Set(v);
      n.delete(key);
      return n;
    });
    void setWidgetVisible(key, 0);
  }

  function show(key: string) {
    setVisible((v) => new Set(v).add(key));
    const l = layout.find((x) => x.i === key);
    if (l) void saveLayoutItem(l.i, l.x, l.y, l.w, l.h, 1);
    else void setWidgetVisible(key, 1);
  }

  async function resetDash() {
    await resetLayout();
    reload(); // recarga con la disposición por defecto
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

  const visibleLayout = layout.filter((l) => visible.has(l.i));
  const hidden = WIDGETS.filter((w) => !visible.has(w.key));

  return (
    <div>
      <div className="topbar">
        <h1>Dashboard</h1>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <AccountSelector />
          <DateRange
            from={from}
            to={to}
            onFrom={setFrom}
            onTo={setTo}
            min={bounds?.min}
            max={bounds?.max}
          />
          <ExcludeInternalToggle />
          {hidden.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && show(e.target.value)}
              title="Añadir widget"
            >
              <option value="">+ Añadir widget</option>
              {hidden.map((w) => (
                <option key={w.key} value={w.key}>{w.title}</option>
              ))}
            </select>
          )}
          <button onClick={() => void resetDash()} title="Volver a la disposición por defecto">
            Restablecer disposición
          </button>
        </div>
      </div>

      {ready && (
        <Grid
          className="layout"
          layout={visibleLayout}
          cols={12}
          rowHeight={40}
          draggableHandle=".widget-head"
          onLayoutChange={onLayoutChange}
          margin={[14, 14]}
        >
          {visibleLayout.map((l) => {
            const def = WIDGETS.find((w) => w.key === l.i)!;
            const Body = def.Body;
            return (
              <div key={l.i} className="card widget">
                <div className="widget-head">
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{def.title}</span>
                  <button className="widget-hide" onClick={() => hide(l.i)} title="Ocultar">✕</button>
                </div>
                <div className="widget-body">
                  <Body
                    accountId={accountId}
                    excludeInternal={excludeInternal}
                    from={from}
                    to={to}
                    version={version}
                  />
                </div>
              </div>
            );
          })}
        </Grid>
      )}
    </div>
  );
}
