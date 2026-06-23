// Cálculos puros para pagos programados.

import type { Frequency } from "../types";

/** Avanza una fecha ISO ('YYYY-MM-DD') según la frecuencia. Usa fechas locales
 *  (no UTC) para no desplazar el día por la zona horaria. */
export function advanceDate(iso: string, freq: Frequency): string {
  const [y, m, day] = iso.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  if (freq === "semanal") d.setDate(d.getDate() + 7);
  else if (freq === "anual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1); // mensual
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Días desde hoy hasta la fecha (negativo si ya pasó). */
export function daysUntil(iso: string, today: Date = new Date()): number {
  const d = new Date(iso + "T00:00:00");
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d.getTime() - t0.getTime()) / (1000 * 60 * 60 * 24));
}

export const FREQ_LABEL: Record<Frequency, string> = {
  mensual: "Mensual",
  semanal: "Semanal",
  anual: "Anual",
};
