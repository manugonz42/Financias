import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import { PALETTES, type PaletteId } from "../lib/palettes";
import type { IconStyle } from "../lib/icons";
import { ExcludeInternalToggle } from "../components/Controls";
import { CategoryManager } from "../components/CategoryManager";
import { ManualAccounts } from "../components/ManualAccounts";
import { getOwnerName, setSetting, type Theme } from "../data/settings";
import { listAccounts, currentBalance, accountTypeLabel, addBalanceSnapshot } from "../data/accounts";
import { resetData } from "../db/database";
import { formatEUR } from "../lib/format";
import type { Account } from "../types";

const THEMES: { id: Theme; label: string; desc: string }[] = [
  { id: "dark", label: "Oscuro", desc: "Near-black estilo Linear" },
  { id: "light", label: "Claro", desc: "Gris frio neutro" },
  { id: "minimalist", label: "Minimalista", desc: "Monocromatico warm, editorial" },
];

const MINIMALIST_MODES: { id: "minimalist" | "minimalist-dark"; label: string }[] = [
  { id: "minimalist", label: "Claro" },
  { id: "minimalist-dark", label: "Oscuro" },
];

export function Ajustes() {
  const { reload, theme, setTheme, palette, setPalette, iconStyle, setIconStyle, toast } = useApp();
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
    try {
      await resetData();
      setConfirming(false);
      setOwner("");
      loadAccounts();
      reload();
    } catch (e) {
      const msg =
        e instanceof Error && e.message
          ? e.message
          : typeof e === "string"
            ? e
            : JSON.stringify(e);
      toast(`Error al borrar: ${msg}`);
      console.error("resetData failed:", e);
    } finally {
      setWiping(false);
    }
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
        <h3>Analisis</h3>
        <ExcludeInternalToggle />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Estilo visual</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Selecciona el tema visual de la aplicacion. Cada tema cambia colores,
          fuentes y estilo de los graficos.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 12 }}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              style={{
                padding: "14px 12px",
                borderRadius: 8,
                border: (theme === t.id || (t.id === "minimalist" && (theme === "minimalist" || theme === "minimalist-dark")))
                  ? "2px solid var(--accent)"
                  : "1px solid var(--border)",
                background: (theme === t.id || (t.id === "minimalist" && (theme === "minimalist" || theme === "minimalist-dark")))
                  ? "var(--bg-elev)"
                  : "var(--bg-card)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{t.label}</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{t.desc}</div>
            </button>
          ))}
        </div>
        {/* Sub-toggle para variante claro/oscuro del minimalista */}
        {(theme === "minimalist" || theme === "minimalist-dark") && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {MINIMALIST_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setTheme(m.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: theme === m.id ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: theme === m.id ? "var(--bg-elev)" : "var(--bg-card)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: theme === m.id ? 600 : 400,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Paleta de graficos</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Paleta por defecto de los gráficos del dashboard. Cada widget puede
          sobreescribirla con su botón 🎨.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <select
            value={palette}
            onChange={(e) => setPalette(e.target.value as PaletteId)}
          >
            {PALETTES.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Estilo de iconos</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          "Color" usa los iconos actuales (barra lateral en color y emojis de
          categoria). "Lineal" los sustituye por iconos de linea monocromos de Lucide.
          "Phosphor" usa la libreria Phosphor Icons (bold), ideal con el estilo minimalista.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <select
            value={iconStyle}
            onChange={(e) => setIconStyle(e.target.value as IconStyle)}
          >
            <option value="color">Color</option>
            <option value="linear">Lineal (Lucide)</option>
            <option value="phosphor">Phosphor</option>
          </select>
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
