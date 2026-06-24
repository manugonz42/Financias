// Orquestador de importación: bytes de PDF -> parseo -> categorización ->
// deduplicado -> inserción en SQLite, devolviendo el recuento nuevos/duplicados.

import { extractPages } from "./loadPdf";
import { parseOpenbankStatement } from "./openbankParser";
import { parseUnicajaStatement, isUnicajaStatement } from "./unicajaParser";
import { parseBbvaStatement, isBbvaStatement } from "./bbvaParser";
import { categorize, compileRules } from "./categorize";
import { loadRules } from "../data/rules";
import { upsertAccount } from "../data/accounts";
import { categoryIdMap } from "../data/categories";
import { getOwnerName } from "../data/settings";
import { setSetting } from "../data/settings";
import { dedupeKey } from "../lib/text";
import { getDB, exec } from "../db/database";
import type { AccountType, ImportResult } from "../types";

const ACCOUNT_LABEL: Partial<Record<AccountType, string>> = {
  checking: "Cuenta Nómina",
  savings: "Cuenta de Ahorro",
};

export async function importStatementFromBytes(
  bytes: Uint8Array,
  filename: string,
): Promise<ImportResult> {
  const pages = await extractPages(bytes);

  // Detección de banco: BBVA, Unicaja u Openbank (por defecto).
  const fullText = pages.map((p) => p.map((t) => t.str).join(" ")).join(" ");
  const { account, transactions, warnings } = isBbvaStatement(fullText)
    ? parseBbvaStatement(pages)
    : isUnicajaStatement(fullText)
      ? parseUnicajaStatement(pages)
      : parseOpenbankStatement(pages);

  if (!account.number) {
    throw new Error(
      "No se reconoció la cabecera de la cuenta. ¿Es un extracto de movimientos de Openbank, Unicaja o BBVA?",
    );
  }

  const accountName = account.name ?? ACCOUNT_LABEL[account.type] ?? "Cuenta";
  const accountId = await upsertAccount({
    name: accountName,
    type: account.type,
    number: account.number,
    last4: account.last4,
    holder: account.holder,
  });

  // Nombre del titular (para detectar traspasos internos). Se fija la primera vez.
  let owner = await getOwnerName();
  if (!owner && account.holder) {
    owner = account.holder;
    await setSetting("owner_name", owner);
  }

  // Reglas desde la BD (sembradas + las creadas por el usuario al revisar).
  const dbRules = await loadRules();
  const rules = compileRules(dbRules.length ? dbRules : undefined);
  const catMap = await categoryIdMap();

  const batchRes = await exec(
    "INSERT INTO import_batches (filename, account_id, total) VALUES (?, ?, ?)",
    [filename, accountId, transactions.length],
  );
  const batchId = Number(batchRes.lastInsertId);

  const db = await getDB();
  let nuevos = 0;
  let duplicados = 0;

  for (const tx of transactions) {
    const f = categorize(tx, rules, owner);
    const categoryId = catMap.get(f.category) ?? null;
    const key = dedupeKey(accountId, tx.fechaOperacion, tx.importe, tx.concepto);
    const res = await db.execute(
      `INSERT INTO transactions
         (account_id, fecha_operacion, fecha_valor, concepto, importe, saldo,
          category_id, subtype, merchant, card_last4, is_internal, source_file,
          import_batch_id, dedupe_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(dedupe_key) DO NOTHING`,
      [
        accountId,
        tx.fechaOperacion,
        tx.fechaValor,
        tx.concepto,
        tx.importe,
        tx.saldo,
        categoryId,
        f.subtype,
        f.merchant,
        f.cardLast4,
        f.isInternal ? 1 : 0,
        filename,
        batchId,
        key,
      ],
    );
    if (res.rowsAffected && res.rowsAffected > 0) nuevos++;
    else duplicados++;
  }

  await exec("UPDATE import_batches SET nuevos = ?, duplicados = ? WHERE id = ?", [
    nuevos,
    duplicados,
    batchId,
  ]);

  return {
    filename,
    accountName,
    accountType: account.type,
    total: transactions.length,
    nuevos,
    duplicados,
    warnings,
  };
}
