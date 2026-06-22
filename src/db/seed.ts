// Siembra idempotente: categorías, reglas de autocategorización y ajustes.

import type Database from "@tauri-apps/plugin-sql";
import { CATEGORIES, RULES } from "../rules/categoryRules";

export async function seed(db: Database): Promise<void> {
  // Categorías (INSERT OR IGNORE por nombre único).
  for (const c of CATEGORIES) {
    await db.execute(
      "INSERT OR IGNORE INTO categories (name, kind, color, icon) VALUES (?, ?, ?, ?)",
      [c.name, c.kind, c.color, c.icon],
    );
  }

  // Reglas: añade cada regla semilla que aún no exista (por patrón). Así las
  // reglas nuevas de versiones posteriores se incorporan a BD ya creadas, sin
  // duplicar ni pisar las que el usuario haya editado o añadido.
  for (const r of RULES) {
    const exists = (await db.select(
      "SELECT 1 AS x FROM category_rules WHERE pattern = ? LIMIT 1",
      [r.pattern],
    )) as Array<{ x: number }>;
    if (exists.length) continue;
    const cat = (await db.select("SELECT id FROM categories WHERE name = ?", [
      r.category,
    ])) as Array<{ id: number }>;
    if (cat[0]) {
      await db.execute(
        "INSERT INTO category_rules (pattern, category_id, subtype, priority) VALUES (?, ?, ?, ?)",
        [r.pattern, cat[0].id, r.subtype ?? null, r.priority],
      );
    }
  }

  // Ajustes por defecto.
  await db.execute(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('exclude_internal', '1')",
  );
}
