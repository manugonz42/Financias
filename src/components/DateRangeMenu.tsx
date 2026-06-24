import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Icono calendario (líneas, color del tema vía currentColor). */
function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h.01" />
      <path d="M12 18h.01" />
    </svg>
  );
}

/** Resta `months` meses a una fecha ISO ('YYYY-MM-DD') y devuelve ISO. */
function shift(anchor: string, months: number): string {
  const d = new Date(anchor || new Date().toISOString().slice(0, 10));
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

/**
 * Selector de rango de fechas por widget: un iconito de calendario (fondo
 * transparente, plano) que abre un menú con presets (3M/6M/1A/Todo) y dos
 * campos de fecha. `anchor` es el límite superior para los presets.
 */
export function DateRangeMenu({
  from,
  to,
  anchor,
  onChange,
}: {
  from: string;
  to: string;
  anchor: string;
  onChange: (from: string, to: string) => void;
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

  const presets: [string, () => void][] = [
    ["3M", () => onChange(shift(anchor, 3), anchor)],
    ["6M", () => onChange(shift(anchor, 6), anchor)],
    ["1A", () => onChange(shift(anchor, 12), anchor)],
    ["Todo", () => onChange("1900-01-01", anchor)],
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Rango de fechas"
        className={cn(
          "flex size-7 items-center justify-center rounded-md border-0 bg-transparent p-0 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground",
          open && "bg-accent text-foreground",
        )}
      >
        <CalendarIcon />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-56 rounded-lg border border-border bg-card p-3 shadow-xl">
          <div className="mb-2 flex gap-1">
            {presets.map(([label, fn]) => (
              <button
                key={label}
                onClick={() => {
                  fn();
                  setOpen(false);
                }}
                className="flex-1 rounded-md border border-border bg-transparent px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                {label}
              </button>
            ))}
          </div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Desde</label>
          <input
            type="date"
            value={from?.slice(0, 10) ?? ""}
            max={to?.slice(0, 10)}
            onChange={(e) => onChange(e.target.value, to)}
            className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          />
          <label className="mb-1 block text-[11px] text-muted-foreground">Hasta</label>
          <input
            type="date"
            value={to?.slice(0, 10) ?? ""}
            min={from?.slice(0, 10)}
            onChange={(e) => onChange(from, e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          />
        </div>
      )}
    </div>
  );
}
