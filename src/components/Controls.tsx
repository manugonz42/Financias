import { useApp } from "../state/AppContext";
import { monthLabel } from "../lib/format";

export function AccountSelector() {
  const { accounts, accountId, setAccountId } = useApp();
  return (
    <select
      value={String(accountId)}
      onChange={(e) => setAccountId(e.target.value === "all" ? "all" : Number(e.target.value))}
      title="Cuenta"
    >
      <option value="all">Todas las cuentas</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}

export function MonthSelect({
  months,
  value,
  onChange,
  allowAll,
}: {
  months: string[];
  value: string;
  onChange: (m: string) => void;
  allowAll?: boolean;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} title="Mes">
      {allowAll && <option value="">Todos los meses</option>}
      {months.map((m) => (
        <option key={m} value={m}>
          {monthLabel(m)}
        </option>
      ))}
    </select>
  );
}

export function DateRange({
  from,
  to,
  onFrom,
  onTo,
  min,
  max,
}: {
  from: string;
  to: string;
  onFrom: (d: string) => void;
  onTo: (d: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <div className="row" style={{ gap: 6, alignItems: "center" }}>
      <span className="muted" style={{ fontSize: 13 }}>Desde</span>
      <input
        type="date"
        value={from}
        min={min}
        max={max}
        onChange={(e) => onFrom(e.target.value)}
        title="Fecha inicial"
      />
      <span className="muted" style={{ fontSize: 13 }}>hasta</span>
      <input
        type="date"
        value={to}
        min={min}
        max={max}
        onChange={(e) => onTo(e.target.value)}
        title="Fecha final"
      />
    </div>
  );
}

export function ExcludeInternalToggle() {
  const { excludeInternal, setExcludeInternal } = useApp();
  return (
    <label className="row" style={{ gap: 6, cursor: "pointer", fontSize: 13 }} title="Los traspasos entre tus propias cuentas no cuentan como gasto/ingreso real">
      <input
        type="checkbox"
        checked={excludeInternal}
        onChange={(e) => setExcludeInternal(e.target.checked)}
        style={{ width: 16, height: 16 }}
      />
      Excluir traspasos internos
    </label>
  );
}
