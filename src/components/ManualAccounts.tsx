import { useCallback, useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import {
  listAccounts,
  currentBalance,
  createManualAccount,
  updateManualAccount,
  deleteManualAccount,
  listBalanceSnapshots,
  addBalanceSnapshot,
  deleteBalanceSnapshot,
  accountTypeLabel,
  classOfType,
  MANUAL_ACCOUNT_TYPES,
} from "../data/accounts";
import { formatEUR, formatDate } from "../lib/format";
import type { Account, AccountBalance, AccountType } from "../types";

const ASSETS = MANUAL_ACCOUNT_TYPES.filter((t) => t.class === "activo");
const LIABILITIES = MANUAL_ACCOUNT_TYPES.filter((t) => t.class === "pasivo");
const today = () => new Date().toISOString().slice(0, 10);

export function ManualAccounts() {
  const { reload } = useApp();
  const [rows, setRows] = useState<Array<Account & { balance: number }>>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const all = (await listAccounts()).filter((a) => a.manual);
    const withBal = await Promise.all(
      all.map(async (a) => ({ ...a, balance: await currentBalance(a.id) })),
    );
    setRows(withBal);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function refresh() {
    await load();
    reload(); // que el resto de la app (selector, patrimonio) se entere
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Cuentas que no vienen de un extracto (efectivo, inversiones, hipoteca…).
          Su saldo se registra con apuntes fechados y suma al patrimonio neto
          (los pasivos restan).
        </p>
        <span className="spacer" />
        <button onClick={() => { setAdding(true); setEditing(null); }} disabled={busy}>
          + Cuenta manual
        </button>
      </div>

      {adding && (
        <AccountForm
          busy={busy}
          onCancel={() => setAdding(false)}
          onSave={async (name, type, initial) => {
            setBusy(true);
            const id = await createManualAccount({ name, type });
            if (initial) await addBalanceSnapshot(id, initial.date, initial.balance);
            setAdding(false);
            setBusy(false);
            await refresh();
          }}
        />
      )}

      {rows.length === 0 && !adding && (
        <span className="muted">Aún no hay cuentas manuales.</span>
      )}

      {rows.map((a) => {
        const signed = a.class === "pasivo" ? -a.balance : a.balance;
        return (
          <div key={a.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 10 }}>
            {editing === a.id ? (
              <AccountForm
                initialName={a.name}
                initialType={a.type}
                busy={busy}
                onCancel={() => setEditing(null)}
                onSave={async (name, type) => {
                  setBusy(true);
                  await updateManualAccount(a.id, { name, type });
                  setEditing(null);
                  setBusy(false);
                  await refresh();
                }}
              />
            ) : (
              <div className="result-line" style={{ border: "none", padding: 0 }}>
                <span>
                  <b>{a.name}</b>{" "}
                  <span className="muted">· {accountTypeLabel(a.type)}</span>{" "}
                  <span className={a.class === "pasivo" ? "amount neg" : "muted"} style={{ fontSize: 12 }}>
                    {a.class === "pasivo" ? "pasivo" : "activo"}
                  </span>
                </span>
                <span className="spacer" />
                <span className={signed < 0 ? "amount neg" : "amount pos"}>{formatEUR(signed)}</span>
                <button className="link-btn" onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
                  {expanded === a.id ? "Ocultar saldos" : "Saldos"}
                </button>
                <button className="link-btn" onClick={() => { setEditing(a.id); setAdding(false); }}>Editar</button>
                <button
                  className="link-btn"
                  style={{ color: "var(--bad)" }}
                  onClick={async () => {
                    if (!confirm(`¿Borrar la cuenta "${a.name}" y todos sus saldos?`)) return;
                    setBusy(true);
                    await deleteManualAccount(a.id);
                    setBusy(false);
                    await refresh();
                  }}
                >
                  Borrar
                </button>
              </div>
            )}

            {expanded === a.id && <Snapshots accountId={a.id} onChange={refresh} />}
          </div>
        );
      })}
    </div>
  );
}

function AccountForm(props: {
  initialName?: string;
  initialType?: AccountType;
  busy: boolean;
  onCancel: () => void;
  onSave: (name: string, type: AccountType, initial?: { date: string; balance: number }) => void | Promise<void>;
}) {
  const isEdit = props.initialName != null;
  const [name, setName] = useState(props.initialName ?? "");
  const [type, setType] = useState<AccountType>(props.initialType ?? "efectivo");
  const [balance, setBalance] = useState("");
  const [date, setDate] = useState(today());

  const canSave = name.trim().length > 0 && !props.busy;

  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap", padding: "8px 0" }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre (p. ej. Hucha, Hipoteca piso)"
        style={{ minWidth: 200 }}
        autoFocus
      />
      <select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
        <optgroup label="Activos">
          {ASSETS.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
        </optgroup>
        <optgroup label="Pasivos">
          {LIABILITIES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
        </optgroup>
      </select>
      {!isEdit && (
        <>
          <input
            type="number"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder={classOfType(type) === "pasivo" ? "Importe que debes" : "Saldo inicial"}
            style={{ width: 150 }}
          />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </>
      )}
      <span className="spacer" />
      <button onClick={props.onCancel} disabled={props.busy}>Cancelar</button>
      <button
        className="primary"
        disabled={!canSave}
        onClick={() => {
          const b = parseFloat(balance);
          const initial = !isEdit && !Number.isNaN(b) ? { date, balance: Math.abs(b) } : undefined;
          void props.onSave(name, type, initial);
        }}
      >
        Guardar
      </button>
    </div>
  );
}

function Snapshots({ accountId, onChange }: { accountId: number; onChange: () => Promise<void> }) {
  const [snaps, setSnaps] = useState<AccountBalance[]>([]);
  const [date, setDate] = useState(today());
  const [balance, setBalance] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setSnaps(await listBalanceSnapshots(accountId));
  }, [accountId]);
  useEffect(() => { void load(); }, [load]);

  async function add() {
    const b = parseFloat(balance);
    if (Number.isNaN(b)) return;
    setBusy(true);
    await addBalanceSnapshot(accountId, date, Math.abs(b));
    setBalance("");
    await load();
    await onChange();
    setBusy(false);
  }

  return (
    <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: "2px solid var(--border)" }}>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input
          type="number"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder="Saldo en esa fecha"
          style={{ width: 160 }}
        />
        <button className="primary" onClick={() => void add()} disabled={busy || balance === ""}>+ Apunte</button>
      </div>
      {snaps.length === 0 ? (
        <span className="muted" style={{ fontSize: 13 }}>Sin apuntes de saldo todavía.</span>
      ) : (
        snaps.map((s) => (
          <div className="result-line" key={s.id} style={{ padding: "4px 0", fontSize: 13 }}>
            <span className="muted">{formatDate(s.date)}</span>
            <span className="spacer" />
            <span>{formatEUR(s.balance)}</span>
            <button
              className="link-btn"
              style={{ color: "var(--bad)" }}
              onClick={async () => { await deleteBalanceSnapshot(s.id); await load(); await onChange(); }}
            >
              ✕
            </button>
          </div>
        ))
      )}
    </div>
  );
}
