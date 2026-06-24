import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SWATCHES = ["#6366f1", "#22c55e", "#0ea5e9", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#14b8a6"];

/** Icono paleta de pintor (líneas, color del tema vía currentColor). */
function PaletteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  );
}

/**
 * Selector del modo de color del rosco: un iconito de paleta (plano,
 * transparente) que abre un menú para usar los colores de cada categoría
 * (value = null) o un degradado monocromo de un color elegido (value = hex).
 */
export function ColorModeMenu({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (color: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Colores del rosco"
        className={cn(
          "flex size-7 items-center justify-center rounded-md border-0 bg-transparent p-0 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground",
          open && "bg-accent text-foreground",
        )}
      >
        <PaletteIcon />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-48 rounded-lg border border-border bg-card p-3 shadow-xl">
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={cn(
              "mb-2 w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground",
              value === null && "border-primary text-foreground",
            )}
          >
            Colores de categoría
          </button>
          <div className="mb-1 text-[11px] text-muted-foreground">Degradado de un color</div>
          <div className="grid grid-cols-4 gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                title={c}
                style={{ background: c }}
                className={cn(
                  "size-7 rounded-full border-0 p-0 transition-transform hover:scale-110",
                  value === c && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
