import { useState, useEffect, useRef } from "react";

/** Paleta de colores para categorías. Tonos saturados con buen contraste sobre
 *  el fondo claro y oscuro. El primer color NO es gris para evitar que las
 *  categorías nuevas nazcan apagadas. */
export const CATEGORY_COLORS: string[] = [
  "#22c55e", "#16a34a", "#84cc16", "#65a30d",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#0891b2", "#3b82f6", "#6366f1", "#7c3aed",
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
  "#e11d48", "#ef4444", "#f97316", "#f59e0b",
  "#eab308", "#facc15", "#64748b", "#94a3b8",
];

/**
 * Devuelve un color de la paleta a partir del nombre de la categoría
 * (hash determinista). Útil para auto-asignar un color "no gris" al crear.
 */
export function colorForName(name: string): string {
  if (!name) return CATEGORY_COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CATEGORY_COLORS[h % CATEGORY_COLORS.length];
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Color"
        title="Color"
        style={{
          width: 32,
          height: 32,
          padding: 0,
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: value,
          cursor: "pointer",
        }}
      />
      {open && (
        <div
          role="dialog"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 50,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,.15)",
            display: "grid",
            gridTemplateColumns: "repeat(6, 24px)",
            gap: 6,
          }}
        >
          {CATEGORY_COLORS.map((c) => {
            const selected = c.toLowerCase() === value.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(c); setOpen(false); }}
                title={c}
                style={{
                  width: 24,
                  height: 24,
                  padding: 0,
                  borderRadius: 4,
                  background: c,
                  border: selected ? "2px solid var(--text)" : "1px solid var(--border)",
                  cursor: "pointer",
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
