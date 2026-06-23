import { useEffect, useState } from "react";
import {
  listInvestments,
  portfolioSummary,
  createInvestment,
  updateInvestmentPrice,
  deleteInvestment,
  listLots,
  addLot,
  deleteLot,
  type InvestmentRow,
  type PortfolioSummary,
  type InvestmentKind,
  type Lot,
} from "../data/investments";
import { formatEUR, formatDate } from "../lib/format";

const KIND_LABEL: Record<InvestmentKind, string> = {
  accion: "Acción",
  fondo: "Fondo",
  cripto: "Cripto",
  otro: "Otro",
};

const today = () => new Date().toISOString().slice(0, 10);

export function Inversiones() {
  const [rows, setRows] = useState<InvestmentRow[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  // Alta de activo.
  const [nName, setNName] = useState("");
  const [nKind, setNKind] = useState<InvestmentKind>("accion");
  const [nTicker, setNTicker] = useState("");
  const [nPrice, setNPrice] = useState("");

  async function refresh() {
    const [r, s] = await Promise.all([listInvestments(), portfolioSummary()]);
    setRows(r);
    setSummary(s);
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function add() {
    if (!nName.trim()) return;
    await createInvestment({
      name: nName.trim(),
      kind: nKind,
      ticker: nTicker.trim() || null,
      current_price: Number(nPrice.replace(",", ".")) || 0,
    });
    setNName("");
    setNTicker("");
    setNPrice("");
    await refresh();
  }

  return (
    <div>
      <div className="topbar"><h1>Inversiones</h1></div>

      {summary && rows.length > 0 && (
        <div className="kpi-grid">
          <div className="kpi"><div className="label">Invertido</div><div className="value">{formatEUR(summary.cost)}</div></div>
          <div className="kpi"><div className="label">Valor actual</div><div className="value">{formatEUR(summary.value)}</div></div>
          <div className="kpi"><div className="label">P/L</div><div className={`value ${summary.pl >= 0 ? "good" : "bad"}`}>{formatEUR(summary.pl)}</div></div>
          <div className="kpi"><div className="label">Rentabilidad</div><div className={`value ${summary.pl >= 0 ? "good" : "bad"}`}>{summary.pl_pct.toFixed(1)}%</div></div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Nuevo activo</h3>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input className="grow" placeholder="Nombre (p. ej. MSCI World)" value={nName} onChange={(e) => setNName(e.target.value)} />
          <select value={nKind} onChange={(e) => setNKind(e.target.value as InvestmentKind)}>
            {Object.entries(KIND_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input placeholder="Ticker" value={nTicker} onChange={(e) => setNTicker(e.target.value)} style={{ width: 110 }} />
          <input placeholder="Precio actual" value={nPrice} onChange={(e) => setNPrice(e.target.value)} style={{ width: 120 }} />
          <button className="primary" onClick={() => void add()} disabled={!nName.trim()}>Añadir</button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="import-box">
          <p className="muted">Añade tu primer activo y registra las aportaciones (compras/ventas) para ver su rentabilidad.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Activo</th>
                <th>Tipo</th>
                <th className="right">Unidades</th>
                <th className="right">Precio actual</th>
                <th className="right">Invertido</th>
                <th className="right">Valor</th>
                <th className="right">P/L</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <InvestmentRowView
                  key={r.id}
                  r={r}
                  isOpen={open === r.id}
                  onToggle={() => setOpen(open === r.id ? null : r.id)}
                  onChanged={refresh}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InvestmentRowView({
  r,
  isOpen,
  onToggle,
  onChanged,
}: {
  r: InvestmentRow;
  isOpen: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [price, setPrice] = useState(String(r.current_price));
  // Alta de lote.
  const [fecha, setFecha] = useState(today());
  const [units, setUnits] = useState("");
  const [lprice, setLprice] = useState("");
  const [fees, setFees] = useState("");

  useEffect(() => {
    if (isOpen) void listLots(r.id).then(setLots);
  }, [isOpen, r.id]);

  async function savePrice() {
    await updateInvestmentPrice(r.id, Number(price.replace(",", ".")) || 0);
    onChanged();
  }

  async function add() {
    const u = Number(units.replace(",", "."));
    const p = Number(lprice.replace(",", "."));
    if (!u || !p) return;
    await addLot({ investmentId: r.id, fecha, units: u, price: p, fees: Number(fees.replace(",", ".")) || 0 });
    setUnits("");
    setLprice("");
    setFees("");
    await listLots(r.id).then(setLots);
    onChanged();
  }

  async function removeLot(id: number) {
    await deleteLot(id);
    await listLots(r.id).then(setLots);
    onChanged();
  }

  return (
    <>
      <tr className={isOpen ? "row-open" : undefined}>
        <td><button className="expand-btn" onClick={onToggle}>{isOpen ? "▾" : "▸"}</button></td>
        <td><b>{r.name}</b>{r.ticker && <span className="muted"> · {r.ticker}</span>}</td>
        <td className="muted">{KIND_LABEL[r.kind]}</td>
        <td className="right">{r.units.toLocaleString("es-ES", { maximumFractionDigits: 4 })}</td>
        <td className="right">{formatEUR(r.current_price)}</td>
        <td className="right muted">{formatEUR(Math.max(r.cost_net, 0))}</td>
        <td className="right">{formatEUR(r.market_value)}</td>
        <td className={`right amount ${r.pl >= 0 ? "pos" : "neg"}`}>{formatEUR(r.pl)} <span style={{ fontSize: 11 }}>({r.pl_pct.toFixed(1)}%)</span></td>
        <td><button className="danger" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => void deleteInvestment(r.id).then(onChanged)}>🗑</button></td>
      </tr>
      {isOpen && (
        <tr className="detail-row">
          <td></td>
          <td colSpan={8}>
            <div className="detail">
              <div className="detail-block">
                <label className="muted">Precio actual por unidad</label>
                <div className="row" style={{ gap: 8 }}>
                  <input value={price} onChange={(e) => setPrice(e.target.value)} style={{ width: 120 }} />
                  <button onClick={() => void savePrice()}>Actualizar</button>
                  {r.updated_at && <span className="muted" style={{ fontSize: 12 }}>actualizado {r.updated_at.slice(0, 10)}</span>}
                </div>
              </div>

              <div className="detail-block">
                <label className="muted">Nueva aportación (unidades positivas = compra, negativas = venta)</label>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                  <input placeholder="Unidades" value={units} onChange={(e) => setUnits(e.target.value)} style={{ width: 100 }} />
                  <input placeholder="Precio/ud" value={lprice} onChange={(e) => setLprice(e.target.value)} style={{ width: 100 }} />
                  <input placeholder="Comisión" value={fees} onChange={(e) => setFees(e.target.value)} style={{ width: 90 }} />
                  <button className="primary" onClick={() => void add()}>Registrar</button>
                </div>
              </div>

              {lots.length > 0 && (
                <div className="detail-block">
                  <label className="muted">Operaciones</label>
                  <table style={{ fontSize: 12 }}>
                    <tbody>
                      {lots.map((l) => (
                        <tr key={l.id}>
                          <td>{formatDate(l.fecha)}</td>
                          <td className={l.units >= 0 ? "amount pos" : "amount neg"}>{l.units >= 0 ? "Compra" : "Venta"}</td>
                          <td className="right">{Math.abs(l.units).toLocaleString("es-ES", { maximumFractionDigits: 4 })} ud</td>
                          <td className="right">{formatEUR(l.price)}</td>
                          <td className="right muted">{l.fees ? `+${formatEUR(l.fees)} com.` : ""}</td>
                          <td className="right">{formatEUR(l.units * l.price + l.fees)}</td>
                          <td><button className="danger" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => void removeLot(l.id)}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
