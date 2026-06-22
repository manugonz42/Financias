import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { Transaction } from "../types";

function cell(v: string): string {
  if (/[;"\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function num(n: number | null): string {
  return n == null ? "" : n.toFixed(2).replace(".", ",");
}

/** Genera el CSV (delimitador ';', estilo Excel español). */
export function transactionsToCSV(txs: Transaction[]): string {
  const header = [
    "Fecha",
    "Fecha valor",
    "Cuenta",
    "Concepto",
    "Comercio",
    "Categoría",
    "Tipo",
    "Importe",
    "Saldo",
    "Interno",
  ];
  const lines = txs.map((t) =>
    [
      t.fecha_operacion,
      t.fecha_valor,
      t.account_name,
      t.concepto,
      t.merchant ?? "",
      t.category_name ?? "",
      t.subtype ?? "",
      num(t.importe),
      num(t.saldo),
      t.is_internal ? "Sí" : "No",
    ]
      .map(cell)
      .join(";"),
  );
  return [header.join(";"), ...lines].join("\r\n");
}

/** Abre el diálogo de guardado y escribe el CSV. Devuelve true si se guardó. */
export async function exportTransactionsCSV(
  txs: Transaction[],
  defaultName = "movimientos.csv",
): Promise<boolean> {
  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (!path) return false;
  // BOM (﻿) para que Excel reconozca UTF-8.
  await invoke("write_text_file", {
    path,
    contents: "﻿" + transactionsToCSV(txs),
  });
  return true;
}
