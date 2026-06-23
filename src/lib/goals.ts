// Cálculos puros de metas de ahorro.

/** % de progreso (0..100, acotado). */
export function goalPercent(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, (current / target) * 100));
}

/**
 * Aportación mensual necesaria para alcanzar la meta en la fecha objetivo.
 * Devuelve null si no hay fecha, ya está conseguida, o la fecha ya pasó.
 */
export function monthlyTarget(
  remaining: number,
  targetDateISO: string | null,
  today: Date = new Date(),
): number | null {
  if (!targetDateISO || remaining <= 0) return null;
  const target = new Date(targetDateISO + "T00:00:00");
  const ms = target.getTime() - today.getTime();
  if (ms <= 0) return null;
  const months = Math.max(1, ms / (1000 * 60 * 60 * 24 * 30.44));
  return remaining / months;
}
