import { query, exec } from "../db/database";
import { isPaletteId, type PaletteId } from "../lib/palettes";
import { isIconStyle, type IconStyle } from "../lib/icons";

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

export async function getChartPalette(): Promise<PaletteId> {
  const v = await getSetting("chart_palette");
  return isPaletteId(v) ? v : "categoria";
}

export async function setChartPalette(v: PaletteId): Promise<void> {
  await setSetting("chart_palette", v);
}

export async function getIconStyle(): Promise<IconStyle> {
  const v = await getSetting("icon_style");
  return isIconStyle(v) ? v : "color";
}

export async function setIconStyle(v: IconStyle): Promise<void> {
  await setSetting("icon_style", v);
}
