import { useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";

const SWATCHES = ["#6366f1", "#22c55e", "#0ea5e9", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#14b8a6"];

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
          "flex size-7 items-center justify-center rounded-md bg-transparent text-foreground/70 transition-colors hover:bg-accent hover:text-foreground",
          open && "bg-accent text-foreground",
        )}
      >
        <Palette className="size-4" />
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
                  "size-7 rounded-full transition-transform hover:scale-110",
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
