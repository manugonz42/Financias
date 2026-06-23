import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import {
  listAllRules,
  createRule,
  updateRule,
  deleteRule,
  setRuleEnabled,
  applyRulesToUncategorized,
  isValidRegex,
  type RuleRow,
} from "../data/rules";

const SUBTYPES = [
  "",
  "compra",
  "cajero",
  "recibo",
  "transferencia",
  "nomina",
  "interes",
  "comision",
  "abono",
  "otro",
];

export function Reglas() {
  const { categories, reload } = useApp();
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  // Formulario de alta.
  const [nPattern, setNPattern] = useState("");
  const [nCat, setNCat] = useState<number | "">("");
  const [nPriority, setNPriority] = useState(50);

  async function refresh() {
    setRules(await listAllRules());
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function add() {
    if (!nPattern.trim() || !nCat) return;
    if (!isValidRegex(nPattern)) {
      setMsg("El patrón no es una expresión regular válida.");
      return;
    }
    await createRule({ pattern: nPattern.trim(), categoryId: Number(nCat), priority: nPriority });
    setNPattern("");
    setNCat("");
    setNPriority(50);
    setMsg(null);
    await refresh();
    reload();
  }

  async function save(r: RuleRow) {
    if (!isValidRegex(r.pattern)) {
      setMsg(`Patrón inválido en la regla #${r.id}.`);
      return;
    }
    await updateRule(r.id, {
      pattern: r.pattern,
      categoryId: r.category_id,
      subtype: r.subtype || null,
      priority: r.priority,
      enabled: r.enabled,
    });
    setMsg("Regla guardada.");
    await refresh();
    reload();
  }

  async function remove(id: number) {
    await deleteRule(id);
    await refresh();
    reload();
  }

  async function toggle(r: RuleRow) {
    await setRuleEnabled(r.id, !r.enabled);
    await refresh();
    reload();
  }

  async function reapply() {
    const n = await applyRulesToUncategorized();
    setMsg(n === 0 ? "Nada que recategorizar en «Otros»." : `${n} movimiento(s) recategorizado(s).`);
    reload();
  }

  function patch(id: number, p: Partial<RuleRow>) {
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  const shown = filter
    ? rules.filter(
        (r) =>
          r.pattern.toLowerCase().includes(filter.toLowerCase()) ||
          r.category_name.toLowerCase().includes(filter.toLowerCase()),
      )
    : rules;

  return (
    <div>
      <div className="topbar">
        <h1>Reglas de categorización</h1>
        <div className="row" style={{ gap: 10 }}>
          {msg && <span className="muted">{msg}</span>}
          <button onClick={() => void reapply()}>↻ Aplicar a «Otros»</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Nueva regla</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          El patrón es una expresión regular que se prueba sobre el concepto en
          MAYÚSCULAS y sin acentos. Menor prioridad = se evalúa antes.
        </p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input
            className="grow"
            placeholder="Patrón (p. ej. MERCADONA|LIDL)"
            value={nPattern}
            onChange={(e) => setNPattern(e.target.value)}
            style={{ borderColor: nPattern && !isValidRegex(nPattern) ? "var(--bad)" : undefined }}
          />
          <select value={String(nCat)} onChange={(e) => setNCat(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Categoría…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
          <input
            type="number"
            value={nPriority}
            onChange={(e) => setNPriority(Number(e.target.value))}
            style={{ width: 90 }}
            title="Prioridad"
          />
          <button className="primary" onClick={() => void add()} disabled={!nPattern.trim() || !nCat}>
            Añadir
          </button>
        </div>
      </div>

      <div className="filters">
        <input
          className="grow"
          placeholder="Filtrar reglas…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="muted">{shown.length} de {rules.length} reglas</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 60 }}>Activa</th>
              <th>Patrón</th>
              <th>Categoría</th>
              <th>Subtipo</th>
              <th style={{ width: 90 }}>Prioridad</th>
              <th style={{ width: 140 }}></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} style={{ opacity: r.enabled ? 1 : 0.5 }}>
                <td>
                  <input type="checkbox" checked={!!r.enabled} onChange={() => void toggle(r)} style={{ width: 16, height: 16 }} />
                </td>
                <td className="concepto" style={{ maxWidth: 380 }}>
                  <input
                    className="grow"
                    value={r.pattern}
                    onChange={(e) => patch(r.id, { pattern: e.target.value })}
                    style={{ width: "100%", fontFamily: "monospace", fontSize: 12, borderColor: isValidRegex(r.pattern) ? undefined : "var(--bad)" }}
                  />
                </td>
                <td>
                  <select
                    value={r.category_id}
                    onChange={(e) => patch(r.id, { category_id: Number(e.target.value) })}
                    style={{ maxWidth: 180, fontSize: 12 }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select value={r.subtype ?? ""} onChange={(e) => patch(r.id, { subtype: e.target.value || null })} style={{ fontSize: 12 }}>
                    {SUBTYPES.map((s) => (
                      <option key={s} value={s}>{s || "—"}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    value={r.priority}
                    onChange={(e) => patch(r.id, { priority: Number(e.target.value) })}
                    style={{ width: 70 }}
                  />
                </td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <button onClick={() => void save(r)} style={{ padding: "4px 10px", fontSize: 12 }}>Guardar</button>
                    <button onClick={() => void remove(r.id)} className="danger" style={{ padding: "4px 10px", fontSize: 12 }}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
