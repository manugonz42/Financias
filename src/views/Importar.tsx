import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "../state/AppContext";
import { importStatementFromBytes } from "../import/importStatement";
import { TicketImport } from "../components/TicketImport";
import type { ImportResult } from "../types";

export function Importar() {
  const { reload } = useApp();
  const [results, setResults] = useState<ImportResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickAndImport() {
    setError(null);
    const selected = await open({
      multiple: true,
      filters: [{ name: "PDF de movimientos", extensions: ["pdf"] }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    setBusy(true);
    const out: ImportResult[] = [];
    try {
      for (const path of paths) {
        const bytes = await invoke<number[]>("read_file_bytes", { path });
        const filename = path.split(/[\\/]/).pop() ?? path;
        const res = await importStatementFromBytes(new Uint8Array(bytes), filename);
        out.push(res);
      }
      setResults((prev) => [...out, ...prev]);
      reload();
    } catch (e) {
      setError((e as Error).message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="topbar"><h1>Importar movimientos</h1></div>

      <div className="import-box">
        <p className="muted">
          Selecciona uno o varios PDF de movimientos de Openbank (cuenta nómina y/o ahorro).
          Los movimientos ya importados se detectan automáticamente y no se duplican.
        </p>
        <button className="primary" onClick={pickAndImport} disabled={busy}>
          {busy ? "Importando…" : "📄 Seleccionar PDF(s)"}
        </button>
      </div>

      {error && (
        <div className="card" style={{ marginTop: 16, borderColor: "var(--bad)" }}>
          <b className="amount neg">Error:</b> {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Resultado de la importación</h3>
          {results.map((r, i) => (
            <div className="result-line" key={i}>
              <span style={{ minWidth: 220 }}><b>{r.accountName}</b><br /><span className="muted" style={{ fontSize: 12 }}>{r.filename}</span></span>
              <span className="spacer" />
              <span className="pill new">{r.nuevos} nuevos</span>
              <span className="pill dup">{r.duplicados} ya existentes</span>
              <span className="muted">de {r.total}</span>
            </div>
          ))}
          {results.some((r) => r.warnings.length > 0) && (
            <details style={{ marginTop: 10 }}>
              <summary className="muted" style={{ fontSize: 12, cursor: "pointer" }}>
                Avisos: {results.reduce((s, r) => s + r.warnings.length, 0)} líneas no estándar omitidas (ver detalle)
              </summary>
              <pre
                style={{
                  fontSize: 11,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 260,
                  overflowY: "auto",
                  marginTop: 8,
                  padding: 10,
                  background: "var(--bg-elev)",
                  borderRadius: 8,
                }}
              >
                {results.flatMap((r) => r.warnings).join("\n")}
              </pre>
            </details>
          )}
        </div>
      )}

      <div className="topbar" style={{ marginTop: 28 }}><h1>Importar tickets</h1></div>
      <TicketImport />
    </div>
  );
}
