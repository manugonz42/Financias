import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../state/AppContext";
import { listUncategorized, assignGroup, type UncatGroup } from "../data/review";
import { addRuleForKey } from "../data/rules";
import { formatEUR, formatDate } from "../lib/format";

export function Categorizar() {
  const { categories, reload } = useApp();
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
    reload(); // refresca el resto de la app (no recarga esta cola)
    setIdx((i) => i + 1);
    setWorking(false);
  }

  function skip() {
    setIdx((i) => i + 1);
  }

  const done = !loading && idx >= groups.length;
  const total = groups.length;

  return (
    <div>
      <div className="topbar">
        <h1>Categorizar</h1>
        {total > 0 && !done && (
          <span className="muted">{idx} / {total} revisados</span>
        )}
      </div>

      <p className="muted" style={{ marginTop: -6, maxWidth: 680 }}>
        Movimientos que quedaron en <b>«Otros gastos»</b>, agrupados por comercio.
        Asigna una categoría y se aplicará a <b>todos</b> los movimientos con ese
        mismo concepto. Si marcas «recordar», las próximas importaciones lo
        categorizarán solas.
      </p>

      {loading && <div className="card"><span className="muted">Cargando…</span></div>}

      {!loading && total === 0 && (
        <div className="card">
          <p>🎉 No hay nada sin clasificar. Todos los gastos tienen categoría.</p>
          <Link to="/movimientos"><button>Ver movimientos</button></Link>
        </div>
      )}

      {done && total > 0 && (
        <div className="card">
          <p>✅ Revisión completada: {total} conceptos procesados.</p>
          <div className="row" style={{ gap: 8 }}>
            <button onClick={() => void load()}>Buscar más</button>
            <Link to="/movimientos"><button className="primary">Ver movimientos</button></Link>
          </div>
        </div>
      )}

      {current && !done && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="muted" style={{ fontSize: 13 }}>Concepto</div>
            <div style={{ fontSize: 18, fontWeight: 600, margin: "4px 0 10px", wordBreak: "break-word" }}>
              {current.key}
            </div>
            <div className="row" style={{ gap: 24, flexWrap: "wrap" }}>
              <span className="muted">
                Movimientos: <b style={{ color: "var(--text)" }}>{current.count}</b>
              </span>
              <span className="muted">
                Total: <b className="amount neg">{formatEUR(current.total)}</b>
              </span>
              <span className="muted">
                Último: <b style={{ color: "var(--text)" }}>{formatDate(current.last_seen)}</b>
              </span>
            </div>
          </div>

          <div className="card">
            <div className="row" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Asignar categoría</h3>
              <span className="spacer" />
              <label className="row" style={{ gap: 6, cursor: "pointer", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                Recordar para próximas importaciones
              </label>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => void assign(c.id)}
                  disabled={working}
                  className="cat-btn"
                  style={{ borderLeft: `4px solid ${c.color}` }}
                >
                  {c.icon} {c.name}
                </button>
              ))}
            </div>

            <div className="row" style={{ marginTop: 14, gap: 8 }}>
              <button onClick={skip} disabled={working}>Saltar →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
