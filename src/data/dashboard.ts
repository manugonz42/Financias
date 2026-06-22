import { query, exec } from "../db/database";

export interface LayoutRow {
  widget_key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: number;
}

export async function loadLayout(): Promise<LayoutRow[]> {
  return query<LayoutRow>("SELECT * FROM dashboard_layout");
}

export async function saveLayoutItem(
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  visible: number,
): Promise<void> {
  await exec(
    `INSERT INTO dashboard_layout (widget_key, x, y, w, h, visible)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(widget_key) DO UPDATE SET
       x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h, visible = excluded.visible`,
    [key, x, y, w, h, visible],
  );
}

export async function setWidgetVisible(key: string, visible: number): Promise<void> {
  await exec(
    `INSERT INTO dashboard_layout (widget_key, visible) VALUES (?, ?)
     ON CONFLICT(widget_key) DO UPDATE SET visible = excluded.visible`,
    [key, visible],
  );
}
