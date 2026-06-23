import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import { ExcludeInternalToggle } from "../components/Controls";
import { CategoryManager } from "../components/CategoryManager";
import { ManualAccounts } from "../components/ManualAccounts";
import { getOwnerName, setSetting } from "../data/settings";
import { listAccounts, currentBalance, accountTypeLabel, addBalanceSnapshot } from "../data/accounts";
import { resetData } from "../db/database";
import { formatEUR } from "../lib/format";
import type { Account } from "../types";

export function Ajustes() {
  const { reload } = useApp();
  const [owner, setOwner] = useState("");
  const [accounts, setAccounts] = useState<Array<Account & { balance: number }>>([]);
  const [confirming, setConfirming] = useState(false);
  const [wiping, setWiping] = useState(false);

  function loadAccounts() {
    void (async () => {
      const accs = (await listAccounts()).filter((a) => !a.manual);
      const withBal = await Promise.all(
        accs.map(async (a) => ({ ...a, balance: await currentBalance(a.id) })),
      );
      setAccounts(withBal);
    })();
  }

  useEffect(() => {
    void getOwnerName().then(setOwner);
    loadAccounts();
  }, []);

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
          <BalanceRow key={a.id} account={a} onSaved={() => { loadAccounts(); reload(); }} />
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

function BalanceRow({
  account,
  onSaved,
}: {
  account: Account & { balance: number };
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  function startEdit() {
    setValue(account.balance.toFixed(2));
    setDate(new Date().toISOString().slice(0, 10));
    setEditing(true);
  }

  async function save() {
    const n = parseFloat(value.replace(",", "."));
    if (!Number.isFinite(n)) return;
    setBusy(true);
    await addBalanceSnapshot(account.id, date, n);
    setBusy(false);
    setEditing(false);
    onSaved();
  }

  if (!editing) {
    return (
      <div className="result-line">
        <span>
          <b>{account.name}</b>{" "}
          <span className="muted">
            · {accountTypeLabel(account.type)}
            {account.last4 ? ` ····${account.last4}` : ""}
          </span>
        </span>
        <span className="spacer" />
        <span>{formatEUR(account.balance)}</span>
        <button className="link-btn" onClick={startEdit} style={{ marginLeft: 8 }}>
          Editar
        </button>
      </div>
    );
  }

  return (
    <div className="result-line" style={{ flexWrap: "wrap", gap: 8 }}>
      <span><b>{account.name}</b></span>
      <span className="spacer" />
      <label className="row" style={{ gap: 6, fontSize: 13 }}>
        <span className="muted">Fecha</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="row" style={{ gap: 6, fontSize: 13 }}>
        <span className="muted">Saldo €</span>
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ width: 130 }}
          autoFocus
        />
      </label>
      <button onClick={() => setEditing(false)} disabled={busy}>Cancelar</button>
      <button className="primary" onClick={() => void save()} disabled={busy || value === ""}>
        {busy ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}
