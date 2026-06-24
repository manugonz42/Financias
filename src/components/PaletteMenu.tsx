import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { PALETTES, paletteColors, type PaletteId } from "../lib/palettes";
import type { PaletteOverride } from "./charts/useChartPalette";

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

function Swatches({ id }: { id: PaletteId }) {
  const colors = paletteColors(id);
  if (!colors) {
    // "categoria" no tiene secuencia: muestra una mini-pastilla neutra.
    return (
      <span className="inline-flex items-center gap-px">
        {["#94a3b8", "#cbd5e1", "#e2e8f0"].map((c) => (
          <span key={c} style={{ background: c }} className="inline-block h-3 w-1.5 rounded-[1px]" />
        ))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-px">
      {colors.slice(0, 6).map((c) => (
        <span key={c} style={{ background: c }} className="inline-block h-3 w-1.5 rounded-[1px]" />
      ))}
    </span>
  );
}

/** Botón de paleta para la cabecera de un widget de gráfico.
 *  Abre un menú con "Usar global" + todas las paletas y avisa por `onChange`. */
export function PaletteMenu({
  value,
  onChange,
}: {
  value: PaletteOverride;
  onChange: (v: PaletteOverride) => void;
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

  function pick(v: PaletteOverride) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Paleta de colores"
        className={cn(
          "flex size-7 items-center justify-center rounded-md border-0 bg-transparent p-0 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground",
          open && "bg-accent text-foreground",
        )}
      >
        <PaletteIcon />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-52 rounded-lg border border-border bg-card p-2 shadow-xl">
          <button
            onClick={() => pick("inherit")}
            className={cn(
              "mb-1 flex w-full items-center justify-between gap-2 rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              value === "inherit" && "bg-accent text-foreground",
            )}
          >
            <span>Usar global</span>
          </button>
          <div className="my-1 h-px bg-border" />
          {PALETTES.map((p) => (
            <button
              key={p.id}
              onClick={() => pick(p.id)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                value === p.id && "bg-accent text-foreground",
              )}
            >
              <span>{p.label}</span>
              <Swatches id={p.id} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
