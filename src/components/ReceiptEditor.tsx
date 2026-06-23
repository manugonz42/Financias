import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "../state/AppContext";
import { setReceiptPath, listReceiptItems, setReceiptItems, suggestItemCategory } from "../data/receipts";
import { parseReceipt } from "../lib/receiptParse";
import { formatEUR } from "../lib/format";
import type { Transaction } from "../types";

interface Item {
  description: string;
  amount: string;
  category_id: number | "";
}

const isImage = (p: string) => /\.(jpe?g|png|webp|gif|bmp)$/i.test(p);
const fileName = (p: string) => p.split(/[\\/]/).pop() ?? p;

export function ReceiptEditor({
  tx,
  onClose,
  onSaved,
}: {
  tx: Transaction;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { categories, toast } = useApp();
  const target = +Math.abs(tx.importe).toFixed(2);
  const [path, setPath] = useState<string | null>(tx.receipt_path);
  const [preview, setPreview] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    void listReceiptItems(tx.id).then((rows) =>
      setItems(rows.map((r) => ({ description: r.description, amount: String(r.amount), category_id: r.category_id ?? "" }))),
    );
  }, [tx.id]);

  // Vista previa de imagen leyendo los bytes con el comando Rust existente.
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      if (path && isImage(path)) {
        try {
          const bytes = await invoke<number[]>("read_file_bytes", { path });
          if (cancelled) return;
          url = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
          setPreview(url);
        } catch {
          setPreview(null);
        }
      } else {
        setPreview(null);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  const sum = useMemo(() => items.reduce((a, it) => a + (parseFloat(it.amount) || 0), 0), [items]);
  const remaining = +(target - sum).toFixed(2);

  async function attach() {
    const sel = await open({
      multiple: false,
      filters: [{ name: "Recibo", extensions: ["jpg", "jpeg", "png", "webp", "gif", "bmp", "pdf"] }],
    });
    if (!sel || Array.isArray(sel)) return;
    await setReceiptPath(tx.id, sel);
    setPath(sel);
    toast("Recibo adjuntado");
  }
  async function removeReceipt() {
    await setReceiptPath(tx.id, null);
    setPath(null);
  }

  // OCR nativo del SO → parseo a líneas → categoría aprendida por producto.
  async function scan() {
    if (!path) return;
    setScanning(true);
    try {
      const lines = await invoke<string[]>("ocr_image", { path });
      const parsed = parseReceipt(lines);
      const withCats: Item[] = await Promise.all(
        parsed.items.map(async (it) => ({
          description: it.description,
          amount: it.amount.toFixed(2),
          category_id: ((await suggestItemCategory(it.description)) ?? "") as number | "",
        })),
      );
      if (withCats.length) {
        setItems(withCats);
        toast(`OCR: ${withCats.length} línea(s) detectada(s)${parsed.date ? ` · ticket ${parsed.date}` : ""}`);
      } else {
        toast("OCR: no se detectaron líneas con importe");
      }
    } catch (e) {
      toast(typeof e === "string" ? e : "No se pudo escanear el recibo");
    } finally {
      setScanning(false);
    }
  }

  function update(i: number, patch: Partial<Item>) {
    setItems((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  // Al salir del campo de producto, si no hay categoría, autoasigna la aprendida.
  async function suggestFor(i: number) {
    const it = items[i];
    if (!it || it.category_id !== "" || !it.description.trim()) return;
    const cat = await suggestItemCategory(it.description);
    if (cat != null) update(i, { category_id: cat });
  }
  function addItem() {
    setItems((ps) => [...ps, { description: "", amount: Math.max(remaining, 0).toFixed(2), category_id: "" }]);
  }
  function removeItem(i: number) {
    setItems((ps) => ps.filter((_, idx) => idx !== i));
  }

  async function save() {
    setBusy(true);
    await setReceiptItems(
      tx.id,
      items
        .filter((it) => it.description.trim() && (parseFloat(it.amount) || 0) > 0)
        .map((it) => ({ description: it.description, amount: parseFloat(it.amount) || 0, category_id: it.category_id === "" ? null : Number(it.category_id) })),
    );
    setBusy(false);
    toast("Desglose guardado");
    onSaved();
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <h3>Recibo</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          {tx.merchant ?? tx.concepto} · <b style={{ color: "var(--text)" }}>{formatEUR(target)}</b>
        </p>

        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <button onClick={() => void attach()}>{path ? "Cambiar archivo" : "📎 Adjuntar archivo"}</button>
          {path && isImage(path) && (
            <button className="primary" onClick={() => void scan()} disabled={scanning} title="Leer el ticket con el OCR del sistema">
              {scanning ? "Escaneando…" : "🔍 Escanear"}
            </button>
          )}
          {path && <span className="muted" style={{ fontSize: 12 }}>{fileName(path)}</span>}
          {path && <button className="link-btn" style={{ color: "var(--bad)" }} onClick={() => void removeReceipt()}>Quitar</button>}
        </div>

        {preview && (
          <img src={preview} alt="recibo" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, marginBottom: 10, display: "block" }} />
        )}
        {path && !isImage(path) && (
          <p className="muted" style={{ fontSize: 12 }}>Archivo adjunto (sin vista previa).</p>
        )}

        <h3 style={{ fontSize: 13, marginTop: 6 }}>Desglose por líneas</h3>
        {items.map((it, i) => (
          <div className="row" key={i} style={{ gap: 6, marginBottom: 6 }}>
            <input value={it.description} onChange={(e) => update(i, { description: e.target.value })} onBlur={() => void suggestFor(i)} placeholder="Producto" style={{ flex: 1, minWidth: 120 }} />
            <input type="number" step="0.01" value={it.amount} onChange={(e) => update(i, { amount: e.target.value })} style={{ width: 90 }} />
            <select value={String(it.category_id)} onChange={(e) => update(i, { category_id: e.target.value ? Number(e.target.value) : "" })} style={{ maxWidth: 140 }}>
              <option value="">— categoría</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            <button className="link-btn" style={{ color: "var(--bad)" }} onClick={() => removeItem(i)} title="Quitar línea">✕</button>
          </div>
        ))}

        <div className="row" style={{ gap: 8, marginTop: 4 }}>
          <button onClick={addItem}>+ Añadir línea</button>
          <span className="spacer" />
          <span className={Math.abs(remaining) < 0.01 ? "muted" : ""} style={{ fontSize: 13 }}>
            Desglosado {formatEUR(sum)} · resto {formatEUR(remaining)}
          </span>
        </div>

        <div className="row" style={{ gap: 8, marginTop: 16 }}>
          <span className="spacer" />
          <button onClick={onClose} disabled={busy}>Cerrar</button>
          <button className="primary" onClick={() => void save()} disabled={busy}>Guardar desglose</button>
        </div>
      </div>
    </div>
  );
}
