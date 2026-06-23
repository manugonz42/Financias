import { query, exec } from "../db/database";

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export async function listTags(): Promise<Tag[]> {
  return query<Tag>("SELECT * FROM tags ORDER BY name");
}

export async function createTag(name: string, color = "#6366f1"): Promise<number> {
  const res = await exec(
    "INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)",
    [name.trim(), color],
  );
  if (res.lastInsertId) return Number(res.lastInsertId);
  const row = (await query<{ id: number }>("SELECT id FROM tags WHERE name = ?", [name.trim()]))[0];
  return row?.id ?? 0;
}

export async function deleteTag(id: number): Promise<void> {
  await exec("DELETE FROM tags WHERE id = ?", [id]);
}

export async function addTagToTx(txId: number, tagId: number): Promise<void> {
  await exec(
    "INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)",
    [txId, tagId],
  );
}

export async function removeTagFromTx(txId: number, tagId: number): Promise<void> {
  await exec("DELETE FROM transaction_tags WHERE transaction_id = ? AND tag_id = ?", [txId, tagId]);
}

/** Mapa txId -> etiquetas, para pintar los chips de una lista de movimientos. */
export async function tagsByTransaction(): Promise<Map<number, Tag[]>> {
  const rows = await query<{ transaction_id: number; id: number; name: string; color: string }>(
    `SELECT tt.transaction_id, t.id, t.name, t.color
       FROM transaction_tags tt JOIN tags t ON t.id = tt.tag_id
      ORDER BY t.name`,
  );
  const map = new Map<number, Tag[]>();
  for (const r of rows) {
    const arr = map.get(r.transaction_id) ?? [];
    arr.push({ id: r.id, name: r.name, color: r.color });
    map.set(r.transaction_id, arr);
  }
  return map;
}
