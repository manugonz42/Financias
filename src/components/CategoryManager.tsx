import { useMemo, useState } from "react";
import { useApp } from "../state/AppContext";
import { CategoryGlyph } from "../lib/icons";
import { IconPicker } from "./IconPicker";
import { ColorPicker, CATEGORY_COLORS, colorForName } from "./ColorPicker";
import {
  buildCategoryTree,
  flattenTree,
  subtreeIds,
  createCategory,
  updateCategory,
  moveCategory,
  deleteCategory,
} from "../data/categories";
import type { Category, CategoryNode } from "../types";

const KIND_LABEL: Record<Category["kind"], string> = {
  gasto: "Gasto",
  ingreso: "Ingreso",
  interno: "Interno",
};

export function CategoryManager() {
  const { categories, reload } = useApp();
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const flat = useMemo(() => flattenTree(tree), [tree]);

  // Formulario de alta: parentId = undefined (cerrado), null (raíz) o id (sub).
  const [adding, setAdding] = useState<number | null | undefined>(undefined);
  const [editing, setEditing] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Organiza tus categorías en árbol. Una categoría puede tener subcategorías
          a cualquier profundidad; los movimientos se asignan a cualquier nivel.
        </p>
        <span className="spacer" />
        <button onClick={() => { setAdding(null); setEditing(null); }} disabled={busy}>
          + Nueva categoría
        </button>
      </div>

      {error && (
        <p className="amount neg" style={{ fontSize: 13 }}>{error}</p>
      )}

      {adding === null && (
        <AddForm
          parentId={null}
          parentKind={null}
          busy={busy}
          onCancel={() => setAdding(undefined)}
          onSave={(c) => run(async () => { await createCategory(c); setAdding(undefined); })}
        />
      )}

      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table>
          <tbody>
            {flat.map((node) => (
              <CategoryRow
                key={node.id}
                node={node}
                allCats={categories}
                busy={busy}
                isEditing={editing === node.id}
                isAddingChild={adding === node.id}
                isConfirmingDelete={confirmDel === node.id}
                onAddChild={() => { setAdding(node.id); setEditing(null); }}
                onEdit={() => { setEditing(node.id); setAdding(undefined); }}
                onCancelEdit={() => setEditing(null)}
                onSaveEdit={(fields, parentId) =>
                  run(async () => {
                    await updateCategory(node.id, fields);
                    if (parentId !== node.parent_id) await moveCategory(node.id, parentId);
                    setEditing(null);
                  })
                }
                onCancelAddChild={() => setAdding(undefined)}
                onSaveChild={(c) =>
                  run(async () => { await createCategory(c); setAdding(undefined); })
                }
                onAskDelete={() => setConfirmDel(node.id)}
                onCancelDelete={() => setConfirmDel(null)}
                onConfirmDelete={() =>
                  run(async () => { await deleteCategory(node.id); setConfirmDel(null); })
                }
              />
            ))}
          </tbody>
        </table>
      </div>
      {flat.length === 0 && <p className="muted">No hay categorías.</p>}
    </div>
  );
}

function CategoryRow(props: {
  node: CategoryNode;
  allCats: Category[];
  busy: boolean;
  isEditing: boolean;
  isAddingChild: boolean;
  isConfirmingDelete: boolean;
  onAddChild: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (fields: { name: string; color: string; icon: string }, parentId: number | null) => void;
  onCancelAddChild: () => void;
  onSaveChild: (c: { name: string; kind: Category["kind"]; color: string; icon: string; parentId: number }) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const { node, allCats, busy } = props;
  const { iconStyle } = useApp();
  const indent = node.depth * 20;

  return (
    <>
      <tr>
        <td style={{ whiteSpace: "normal" }}>
          <div className="row" style={{ paddingLeft: indent, gap: 8 }}>
            <span className="dot" style={{ background: node.color }} />
            <span><CategoryGlyph icon={node.icon} mode={iconStyle} /> {node.name}</span>
            {node.depth === 0 && (
              <span className="muted" style={{ fontSize: 12 }}>· {KIND_LABEL[node.kind]}</span>
            )}
          </div>
        </td>
        <td className="right" style={{ width: 1 }}>
          {!props.isConfirmingDelete ? (
            <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
              <button className="cat-btn" onClick={props.onAddChild} disabled={busy} title="Añadir subcategoría">+ sub</button>
              <button className="cat-btn" onClick={props.onEdit} disabled={busy} title="Editar">✎</button>
              <button className="cat-btn" onClick={props.onAskDelete} disabled={busy} title="Borrar">🗑</button>
            </div>
          ) : (
            <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>¿Borrar? (hijas y movimientos suben al padre)</span>
              <button className="cat-btn" onClick={props.onCancelDelete} disabled={busy}>No</button>
              <button className="cat-btn" onClick={props.onConfirmDelete} disabled={busy} style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>Sí</button>
            </div>
          )}
        </td>
      </tr>

      {props.isEditing && (
        <tr>
          <td colSpan={2} style={{ background: "var(--bg-soft)" }}>
            <EditForm node={node} allCats={allCats} busy={busy} onCancel={props.onCancelEdit} onSave={props.onSaveEdit} />
          </td>
        </tr>
      )}

      {props.isAddingChild && (
        <tr>
          <td colSpan={2} style={{ background: "var(--bg-soft)" }}>
            <div style={{ paddingLeft: indent + 20 }}>
              <AddForm
                parentId={node.id}
                parentKind={node.kind}
                busy={busy}
                onCancel={props.onCancelAddChild}
                onSave={(c) => props.onSaveChild({ ...c, parentId: node.id })}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function AddForm(props: {
  parentId: number | null;
  parentKind: Category["kind"] | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (c: { name: string; kind: Category["kind"]; color: string; icon: string; parentId: number | null }) => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("•");
  const [color, setColor] = useState(CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)]);
  const [kind, setKind] = useState<Category["kind"]>(props.parentKind ?? "gasto");
  const [colorTouched, setColorTouched] = useState(false);

  const effectiveColor = colorTouched ? color : colorForName(name) || color;

  const canSave = name.trim().length > 0 && !props.busy;

  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap", padding: "10px 0" }}>
      <IconPicker value={icon} onChange={setIcon} />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={props.parentId == null ? "Nueva categoría" : "Nueva subcategoría"} style={{ minWidth: 200 }} autoFocus />
      <ColorPicker value={effectiveColor} onChange={(c) => { setColor(c); setColorTouched(true); }} />
      {props.parentKind == null ? (
        <select value={kind} onChange={(e) => setKind(e.target.value as Category["kind"])}>
          <option value="gasto">Gasto</option>
          <option value="ingreso">Ingreso</option>
          <option value="interno">Interno</option>
        </select>
      ) : (
        <span className="muted" style={{ fontSize: 12 }}>Hereda «{KIND_LABEL[props.parentKind]}» del padre</span>
      )}
      <span className="spacer" />
      <button onClick={props.onCancel} disabled={props.busy}>Cancelar</button>
      <button className="primary" disabled={!canSave} onClick={() => props.onSave({ name, kind, color: effectiveColor, icon, parentId: props.parentId })}>Guardar</button>
    </div>
  );
}

function EditForm(props: {
  node: CategoryNode;
  allCats: Category[];
  busy: boolean;
  onCancel: () => void;
  onSave: (fields: { name: string; color: string; icon: string }, parentId: number | null) => void;
}) {
  const { node } = props;
  const { iconStyle } = useApp();
  const [name, setName] = useState(node.name);
  const [icon, setIcon] = useState(node.icon);
  const [color, setColor] = useState(node.color);
  const [parentId, setParentId] = useState<number | null>(node.parent_id);

  // Posibles padres: cualquier categoría salvo el propio subárbol.
  const forbidden = useMemo(() => new Set(subtreeIds(props.allCats, node.id)), [props.allCats, node.id]);
  const parentOptions = props.allCats
    .filter((c) => !forbidden.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const canSave = name.trim().length > 0 && !props.busy;

  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap", padding: "10px 0", paddingLeft: node.depth * 20 }}>
      <IconPicker value={icon} onChange={setIcon} />
      <input value={name} onChange={(e) => setName(e.target.value)} style={{ minWidth: 200 }} autoFocus />
      <ColorPicker value={color} onChange={setColor} />
      <label className="row" style={{ gap: 6, fontSize: 13 }}>
        <span className="muted">Padre:</span>
        <select value={parentId ?? ""} onChange={(e) => setParentId(e.target.value === "" ? null : Number(e.target.value))}>
          <option value="">(raíz)</option>
          {parentOptions.map((c) => (
            <option key={c.id} value={c.id}>{iconStyle === "color" ? `${c.icon} ` : ""}{c.name}</option>
          ))}
        </select>
      </label>
      <span className="spacer" />
      <button onClick={props.onCancel} disabled={props.busy}>Cancelar</button>
      <button className="primary" disabled={!canSave} onClick={() => props.onSave({ name, color, icon }, parentId)}>Guardar</button>
    </div>
  );
}
