import { query, exec } from "../db/database";

export async function getSetting(key: string): Promise<string | null> {
  const row = (await query<{ value: string }>("SELECT value FROM settings WHERE key = ?", [
    key,
  ]))[0];
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await exec(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}

export async function getExcludeInternal(): Promise<boolean> {
  return (await getSetting("exclude_internal")) !== "0";
}

export async function setExcludeInternal(v: boolean): Promise<void> {
  await setSetting("exclude_internal", v ? "1" : "0");
}

export async function getOwnerName(): Promise<string> {
  return (await getSetting("owner_name")) ?? "";
}

// --- Configuración de la conciliación de traspasos por importe ----------------

export interface ReconcileConfig {
  /** Margen de días entre la salida y el ingreso del mismo traspaso. */
  windowDays: number;
  /** Tolerancia de importe en euros (p. ej. comisiones de transferencia). */
  amountTolerance: number;
  /** Ids de categoría excluidas del emparejamiento (no se casan nunca). */
  excludedCategoryIds: number[];
}

const RECONCILE_DEFAULTS: ReconcileConfig = {
  windowDays: 7,
  amountTolerance: 0,
  excludedCategoryIds: [],
};

export async function getReconcileConfig(): Promise<ReconcileConfig> {
  const [w, t, ex] = await Promise.all([
    getSetting("reconcile_window_days"),
    getSetting("reconcile_tolerance"),
    getSetting("reconcile_excluded_categories"),
  ]);
  return {
    windowDays: w != null ? Number(w) : RECONCILE_DEFAULTS.windowDays,
    amountTolerance: t != null ? Number(t) : RECONCILE_DEFAULTS.amountTolerance,
    excludedCategoryIds: ex
      ? ex.split(",").map(Number).filter((n) => Number.isFinite(n))
      : [],
  };
}

export async function setReconcileConfig(c: ReconcileConfig): Promise<void> {
  await setSetting("reconcile_window_days", String(c.windowDays));
  await setSetting("reconcile_tolerance", String(c.amountTolerance));
  await setSetting("reconcile_excluded_categories", c.excludedCategoryIds.join(","));
}

export async function getBudgetRollover(): Promise<boolean> {
  return (await getSetting("budget_rollover")) === "1";
}

export async function setBudgetRollover(v: boolean): Promise<void> {
  await setSetting("budget_rollover", v ? "1" : "0");
}

export type Theme = "dark" | "light";

export async function getTheme(): Promise<Theme> {
  return (await getSetting("theme")) === "light" ? "light" : "dark";
}

export async function setThemeSetting(v: Theme): Promise<void> {
  await setSetting("theme", v);
}
