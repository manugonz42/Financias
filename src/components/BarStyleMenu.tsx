import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { BAR_STYLES, type BarStyle } from "../lib/barStyles";

/** Icono de barras para el botón (líneas, color del tema vía currentColor). */
function BarsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <rect x="7" y="11" width="3" height="6" rx="1" />
      <rect x="13" y="7" width="3" height="10" rx="1" />
    </svg>
  );
}

/** Relleno CSS de una barra del preview según el estilo y los colores resueltos. */
function fillFor(style: BarStyle, color: string): string {
  return style.fill === "gradient"
    ? `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 55%, transparent))`
    : color;
}

/** Mini-preview de 2 barras (pasado/este) para una celda del selector. */
function Preview({ style, intrinsic }: { style: BarStyle; intrinsic: { past: string; now: string } }) {
  const past = style.past ?? intrinsic.past;
  const now = style.now ?? intrinsic.now;
  return (
    <span className="flex h-7 items-end justify-center gap-1">
      <span className="w-2 rounded-t-[2px]" style={{ height: "60%", background: fillFor(style, past) }} />
      <span className="w-2 rounded-t-[2px]" style={{ height: "100%", background: fillFor(style, now) }} />
    </span>
  );
}

/**
 * Botón "Estilo de barras" para la cabecera de un widget de gráfico de barras.
 * Abre una rejilla 3×3 con los 9 presets, cada uno con un preview de 2 barras.
 */
export function BarStyleMenu({
  value,
  onChange,
  intrinsic,
}: {
  value: string;
  onChange: (id: string) => void;
  /** Colores reales del gráfico para pintar el preset "Por defecto". */
  intrinsic: { past: string; now: string };
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

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Estilo de barras"
        className={cn(
          "flex size-7 items-center justify-center rounded-md border-0 bg-transparent p-0 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground",
          open && "bg-accent text-foreground",
        )}
      >
        <BarsIcon />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-max rounded-lg border border-border bg-card p-2 shadow-xl">
          {/* Columnas de ancho fijo (= tamaño de celda); usar `1fr` con un popover
              de ancho automático las colapsa y solapa las celdas. */}
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(3, 2.75rem)" }}>
            {BAR_STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => pick(s.id)}
                title={s.label}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-md border border-transparent bg-transparent transition-colors hover:bg-accent",
                  value === s.id && "border-primary bg-accent",
                )}
              >
                <Preview style={s} intrinsic={intrinsic} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
