import { useEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext";

/**
 * Filtro de categorías con checkbox multi-selección.
 * Muestra un cuadrado con icono de filtro que abre un dropdown con checkboxes.
 * Debajo muestra las categorías seleccionadas como badges.
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

  function clear() {
    onChange([]);
    setOpen(false);
  }

  function selectAll() {
    onChange(filtered.map((c) => c.id));
    setOpen(false);
  }

  const hasSelection = selectedIds.length > 0;

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
          background: hasSelection ? "var(--accent)" : "transparent",
          color: hasSelection ? "#fff" : "var(--text-dim)",
          cursor: "pointer",
          padding: 0,
          transition: "all 0.15s",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      </button>

      {/* Badge con contador si hay selección */}
      {hasSelection && (
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
          {selectedIds.length}
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
              onClick={selectAll}
              style={{ flex: 1, fontSize: 10, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "2px 0" }}
            >
              Todas
            </button>
            <button
              onClick={clear}
              style={{ flex: 1, fontSize: 10, color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", textAlign: "right", padding: "2px 0" }}
            >
              Ninguna
            </button>
          </div>

          {/* Lista de categorías con checkbox */}
          {filtered.map((cat) => {
            const checked = selectedIds.includes(cat.id);
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
                  background: checked ? "var(--bg-soft)" : "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = "var(--bg-elev)"; }}
                onMouseLeave={(e) => { if (!checked) e.currentTarget.style.background = "transparent"; }}
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

/**
 * Muestra las categorías seleccionadas como badges inline.
 */
export function SelectedCategoriesBadge({
  selectedIds,
  onRemove,
}: {
  selectedIds: number[];
  onRemove: (id: number) => void;
}) {
  const { categories } = useApp();
  if (selectedIds.length === 0) return null;

  const selected = categories.filter((c) => selectedIds.includes(c.id));

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
      {selected.map((cat) => (
        <span
          key={cat.id}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 6px",
            borderRadius: 4,
            background: "var(--bg-elev)",
            border: "1px solid var(--border)",
            fontSize: 10,
            color: "var(--text)",
          }}
        >
          <span>{cat.icon}</span>
          <span>{cat.name}</span>
          <button
            onClick={() => onRemove(cat.id)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 12,
              height: 12,
              borderRadius: 2,
              border: "none",
              background: "transparent",
              color: "var(--text-dim)",
              cursor: "pointer",
              padding: 0,
              fontSize: 10,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
