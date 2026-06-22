import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import { ExcludeInternalToggle } from "../components/Controls";
import { getOwnerName, setSetting } from "../data/settings";
import { listAccounts, currentBalance } from "../data/accounts";
import { formatEUR } from "../lib/format";
import type { Account } from "../types";

export function Ajustes() {
  const { reload } = useApp();
  const [owner, setOwner] = useState("");
  const [accounts, setAccounts] = useState<Array<Account & { balance: number }>>([]);

  useEffect(() => {
    void getOwnerName().then(setOwner);
    void (async () => {
      const accs = await listAccounts();
      const withBal = await Promise.all(
        accs.map(async (a) => ({ ...a, balance: await currentBalance(a.id) })),
      );
      setAccounts(withBal);
    })();
  }, []);

  async function saveOwner() {
    await setSetting("owner_name", owner.trim());
    reload();
  }

  return (
    <div>
      <div className="topbar"><h1>Ajustes</h1></div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Cuentas</h3>
        {accounts.length === 0 && <span className="muted">Aún no hay cuentas importadas.</span>}
        {accounts.map((a) => (
          <div className="result-line" key={a.id}>
            <span><b>{a.name}</b> <span className="muted">· ····{a.last4}</span></span>
            <span className="spacer" />
            <span>{formatEUR(a.balance)}</span>
          </div>
        ))}
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

      <div className="card">
        <h3>Análisis</h3>
        <ExcludeInternalToggle />
      </div>
    </div>
  );
}
