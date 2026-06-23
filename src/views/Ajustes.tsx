import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import { ExcludeInternalToggle } from "../components/Controls";
import { CategoryManager } from "../components/CategoryManager";
import { ManualAccounts } from "../components/ManualAccounts";
import {
  getOwnerName,
  setSetting,
  getReconcileConfig,
  setReconcileConfig,
  type ReconcileConfig,
} from "../data/settings";
import { listAccounts, currentBalance, accountTypeLabel } from "../data/accounts";
import { exportBackup, importBackup } from "../data/backup";
import {
  reconcileTransfers,
  listTransferMatches,
  unlinkTransfer,
  type TransferMatch,
} from "../data/reconcile";
import { resetData } from "../db/database";
import { formatEUR, formatDate } from "../lib/format";
import type { Account } from "../types";

export function Ajustes() {
  const { reload } = useApp();
  const [owner, setOwner] = useState("");
  const [accounts, setAccounts] = useState<Array<Account & { balance: number }>>([]);
  const [confirming, setConfirming] = useState(false);
  const [wiping, setWiping] = useState(false);

  // Copia de seguridad.
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  // Conciliación de traspasos.
  const [cfg, setCfg] = useState<ReconcileConfig | null>(null);
  const [matches, setMatches] = useState<TransferMatch[]>([]);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null);

  function loadAccounts() {
    void (async () => {
      const accs = (await listAccounts()).filter((a) => !a.manual);
      const withBal = await Promise.all(
        accs.map(async (a) => ({ ...a, balance: await currentBalance(a.id) })),
      );
      setAccounts(withBal);
    })();
  }

  function loadMatches() {
    void listTransferMatches().then(setMatches);
  }

  useEffect(() => {
    void getOwnerName().then(setOwner);
    void getReconcileConfig().then(setCfg);
    loadAccounts();
    loadMatches();
  }, []);

  async function doExport() {
    try {
      const ok = await exportBackup();
      setBackupMsg(ok ? "Copia guardada." : null);
    } catch (e) {
      setBackupMsg(`Error al exportar: ${String(e)}`);
    }
  }

  async function doImport() {
    try {
      const ok = await importBackup();
      if (ok) {
        setBackupMsg("Copia restaurada.");
        loadAccounts();
        loadMatches();
        reload();
      }
    } catch (e) {
      setBackupMsg(`Error al restaurar: ${String(e)}`);
    }
  }

  async function saveCfg(next: ReconcileConfig) {
    setCfg(next);
    await setReconcileConfig(next);
  }

  async function doReconcile() {
    setReconciling(true);
    const n = await reconcileTransfers();
    setReconcileMsg(`${n} movimiento(s) marcados como traspaso.`);
    setReconciling(false);
    loadMatches();
    reload();
  }

  async function unlink(id: number) {
    await unlinkTransfer(id);
    loadMatches();
    reload();
  }

  async function saveOwner() {
    await setSetting("owner_name", owner.trim());
    reload();
  }

  async function wipe() {
    setWiping(true);
    await resetData();
    setConfirming(false);
    setWiping(false);
    setOwner("");
    loadAccounts();
    reload();
  }

  return (
    <div>
      <div className="topbar"><h1>Ajustes</h1></div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Cuentas importadas</h3>
        {accounts.length === 0 && <span className="muted">Aún no hay cuentas importadas.</span>}
        {accounts.map((a) => (
          <div className="result-line" key={a.id}>
            <span>
              <b>{a.name}</b>{" "}
              <span className="muted">· {accountTypeLabel(a.type)}{a.last4 ? ` ····${a.last4}` : ""}</span>
            </span>
            <span className="spacer" />
            <span>{formatEUR(a.balance)}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Cuentas manuales</h3>
        <ManualAccounts />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Titular (para detectar traspasos internos)</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Las transferencias hacia/desde este nombre se marcan como traspaso interno
          y no cuentan como gasto/ingreso real. Se rellena automáticamente al importar.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <input className="grow" value={owner} onChange={(e) => setOwner(e.target.value)} />
          <button className="primary" onClick={saveOwner}>Guardar</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Categorías</h3>
        <CategoryManager />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Análisis</h3>
        <ExcludeInternalToggle />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Conciliación de traspasos</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Empareja la salida de una cuenta con el ingreso del mismo importe en otra
          y marca ambos lados como traspaso interno (no cuentan como gasto/ingreso).
          Útil cuando el otro lado no lleva tu nombre en el extracto.
        </p>
        {cfg && (
          <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label>
              <span className="muted" style={{ fontSize: 12, display: "block" }}>Margen de días</span>
              <input
                type="number"
                value={cfg.windowDays}
                onChange={(e) => void saveCfg({ ...cfg, windowDays: Number(e.target.value) })}
                style={{ width: 90 }}
              />
            </label>
            <label>
              <span className="muted" style={{ fontSize: 12, display: "block" }}>Tolerancia (€)</span>
              <input
                type="number"
                step="0.01"
                value={cfg.amountTolerance}
                onChange={(e) => void saveCfg({ ...cfg, amountTolerance: Number(e.target.value) })}
                style={{ width: 90 }}
              />
            </label>
            <span className="spacer" />
            <button className="primary" onClick={() => void doReconcile()} disabled={reconciling}>
              {reconciling ? "Conciliando…" : "Conciliar ahora"}
            </button>
          </div>
        )}
        {reconcileMsg && <p className="muted" style={{ fontSize: 13 }}>{reconcileMsg}</p>}
        {matches.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cuenta</th>
                  <th>Concepto</th>
                  <th className="right">Importe</th>
                  <th>Contrapartida</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.id}>
                    <td>{formatDate(m.fecha_operacion)}</td>
                    <td>{m.account_name}</td>
                    <td className="concepto">{m.merchant || m.concepto}</td>
                    <td className={`right amount ${m.importe >= 0 ? "pos" : "neg"}`}>{formatEUR(m.importe)}</td>
                    <td className="muted">{m.match_account_name} · {formatEUR(m.match_importe)}</td>
                    <td>
                      <button className="danger" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => void unlink(m.id)}>
                        Deshacer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Copia de seguridad</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Exporta toda la base de datos a un archivo JSON (respaldo o para mover los
          datos a otro equipo). Restaurar <b>reemplaza</b> todos los datos actuales.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <button className="primary" onClick={() => void doExport()}>⬇ Exportar copia</button>
          <button onClick={() => void doImport()}>⬆ Restaurar copia</button>
          <span className="spacer" />
          {backupMsg && <span className="muted">{backupMsg}</span>}
        </div>
      </div>

      <div className="card" style={{ borderColor: "var(--bad)" }}>
        <h3 style={{ color: "var(--bad)" }}>Zona de peligro</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Borra todos los movimientos, lotes de importación y cuentas. Conserva
          categorías, reglas y presupuestos. Esta acción no se puede deshacer.
        </p>
        {!confirming ? (
          <button onClick={() => setConfirming(true)}>🗑 Borrar todos los datos</button>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <span className="amount neg">¿Seguro? Se borrará todo lo importado.</span>
            <span className="spacer" />
            <button onClick={() => setConfirming(false)} disabled={wiping}>Cancelar</button>
            <button
              onClick={() => void wipe()}
              disabled={wiping}
              style={{ background: "var(--bad)", color: "#fff", borderColor: "var(--bad)" }}
            >
              {wiping ? "Borrando…" : "Sí, borrar todo"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
