import { useEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext";

/**
 * Filtro de categorías con checkbox multi-selección.
 * Por defecto muestra TODAS las categorías seleccionadas.
 * Al hacer clic se van QUITANDO (exclusión).
 * Si selectedIds está vacío → se muestran todas (sin filtro).
 */
export function CategoryFilter({
  selectedIds,
  onChange,
  kind = "gasto",
}: {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  kind?: "gasto" | "ingreso" | "interno";
}) {
  const { categories } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = categories.filter((c) => c.kind === kind);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  function toggle(id: number) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function excludeAll() {
    onChange([]);
    setOpen(false);
  }

  function includeAll() {
    onChange(filtered.map((c) => c.id));
    setOpen(false);
  }

  // Si selectedIds está vacío, se considera "todas seleccionadas"
  const allSelected = selectedIds.length === 0 || selectedIds.length === filtered.length;
  const excludedCount = selectedIds.length === 0 ? 0 : filtered.length - selectedIds.length;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Botón cuadrado con icono */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Filtrar categorías"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: 4,
          border: "1px solid var(--border)",
          background: allSelected ? "transparent" : "var(--accent)",
          color: allSelected ? "var(--text-dim)" : "#fff",
          cursor: "pointer",
          padding: 0,
          transition: "all 0.15s",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      </button>

      {/* Badge con contador de excluidas */}
      {excludedCount > 0 && (
        <span style={{
          position: "absolute",
          top: -4,
          right: -4,
          minWidth: 14,
          height: 14,
          borderRadius: 7,
          background: "var(--accent)",
          color: "#fff",
          fontSize: 9,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 3px",
          pointerEvents: "none",
        }}>
          -{excludedCount}
        </span>
      )}

      {/* Dropdown con checkboxes */}
      {open && (
        <div style={{
          position: "absolute",
          right: 0,
          top: 34,
          zIndex: 50,
          width: 200,
          maxHeight: 280,
          overflowY: "auto",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--bg-card)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          padding: 4,
        }}>
          {/* Acciones rápidas */}
          <div style={{ display: "flex", gap: 4, padding: "4px 6px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
            <button
              onClick={includeAll}
              style={{ flex: 1, fontSize: 10, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "2px 0" }}
            >
              Todas
            </button>
            <button
              onClick={excludeAll}
              style={{ flex: 1, fontSize: 10, color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", textAlign: "right", padding: "2px 0" }}
            >
              Ninguna
            </button>
          </div>

          {/* Lista de categorías con checkbox */}
          {filtered.map((cat) => {
            // checked = true si está en selectedIds O si selectedIds está vacío (todas)
            const checked = selectedIds.length === 0 || selectedIds.includes(cat.id);
            return (
              <label
                key={cat.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 6px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--text)",
                  background: checked ? "transparent" : "var(--bg-soft)",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (checked) e.currentTarget.style.background = "var(--bg-elev)"; }}
                onMouseLeave={(e) => { if (checked) e.currentTarget.style.background = "transparent"; }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(cat.id)}
                  style={{ accentColor: "var(--accent)", width: 14, height: 14, margin: 0 }}
                />
                <span style={{ fontSize: 13 }}>{cat.icon}</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.name}</span>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
