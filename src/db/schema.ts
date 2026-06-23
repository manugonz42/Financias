// Esquema de la base de datos local (SQLite). Se ejecuta de forma idempotente
// al iniciar la app (CREATE TABLE IF NOT EXISTS).

export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS accounts (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     type TEXT NOT NULL,                 -- importadas: 'checking'|'savings'; manuales: 'efectivo','inversion','inmueble','otro_activo','tarjeta_credito','prestamo','hipoteca','otro_pasivo'
     number TEXT UNIQUE,
     last4 TEXT,
     holder TEXT,
     currency TEXT NOT NULL DEFAULT 'EUR',
     manual INTEGER NOT NULL DEFAULT 0,  -- 1 = cuenta creada a mano (sin extracto)
     class TEXT NOT NULL DEFAULT 'activo' -- 'activo' | 'pasivo' (para el patrimonio neto)
   )`,

  // Saldos manuales con fecha (snapshots): permiten que las cuentas sin
  // movimientos importados aporten su saldo y su evolución al patrimonio neto.
  `CREATE TABLE IF NOT EXISTS account_balances (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     account_id INTEGER NOT NULL REFERENCES accounts(id),
     date TEXT NOT NULL,                 -- ISO 'YYYY-MM-DD'
     balance REAL NOT NULL               -- magnitud (positiva); el signo lo da la clase
   )`,

  `CREATE INDEX IF NOT EXISTS idx_balsnap_account ON account_balances(account_id, date)`,

  `CREATE TABLE IF NOT EXISTS categories (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL UNIQUE,
     kind TEXT NOT NULL,                 -- 'gasto' | 'ingreso' | 'interno'
     color TEXT NOT NULL DEFAULT '#9ca3af',
     icon TEXT NOT NULL DEFAULT '•',
     parent_id INTEGER REFERENCES categories(id)   -- NULL = categoría raíz
   )`,

  `CREATE TABLE IF NOT EXISTS category_rules (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     pattern TEXT NOT NULL,
     category_id INTEGER NOT NULL REFERENCES categories(id),
     subtype TEXT,
     priority INTEGER NOT NULL DEFAULT 100,
     enabled INTEGER NOT NULL DEFAULT 1
   )`,

  `CREATE TABLE IF NOT EXISTS transactions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     account_id INTEGER NOT NULL REFERENCES accounts(id),
     fecha_operacion TEXT NOT NULL,      -- ISO 'YYYY-MM-DD'
     fecha_valor TEXT NOT NULL,
     concepto TEXT NOT NULL,
     importe REAL NOT NULL,
     saldo REAL,
     category_id INTEGER REFERENCES categories(id),
     subtype TEXT,
     merchant TEXT,
     card_last4 TEXT,
     is_internal INTEGER NOT NULL DEFAULT 0,
     source_file TEXT,
     import_batch_id INTEGER,
     dedupe_key TEXT NOT NULL UNIQUE,
     notes TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,

  `CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_fecha ON transactions(fecha_operacion)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_internal ON transactions(is_internal)`,

  `CREATE TABLE IF NOT EXISTS budgets (
     category_id INTEGER PRIMARY KEY REFERENCES categories(id),
     amount REAL NOT NULL                -- presupuesto mensual recurrente
   )`,

  // División de un movimiento en varias categorías. Si un movimiento tiene
  // partes, su categoría propia se ignora en las agregaciones por categoría y
  // se usan estas partes (cuyos importes, magnitudes, suman el total).
  `CREATE TABLE IF NOT EXISTS transaction_splits (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     transaction_id INTEGER NOT NULL REFERENCES transactions(id),
     category_id INTEGER NOT NULL REFERENCES categories(id),
     amount REAL NOT NULL,               -- magnitud (positiva)
     note TEXT
   )`,

  `CREATE INDEX IF NOT EXISTS idx_splits_tx ON transaction_splits(transaction_id)`,

  // Desglose por líneas de un recibo (productos del ticket dentro de un gasto).
  `CREATE TABLE IF NOT EXISTS receipt_items (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     transaction_id INTEGER NOT NULL REFERENCES transactions(id),
     description TEXT NOT NULL,
     amount REAL NOT NULL,               -- magnitud (positiva)
     category_id INTEGER REFERENCES categories(id)
   )`,

  `CREATE INDEX IF NOT EXISTS idx_ritems_tx ON receipt_items(transaction_id)`,

  // Aprendizaje: categoría recordada por producto (descripción normalizada).
  // Igual idea que category_rules pero para las líneas de recibo.
  `CREATE TABLE IF NOT EXISTS item_rules (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     pattern TEXT NOT NULL UNIQUE,        -- descripción normalizada del producto
     category_id INTEGER NOT NULL REFERENCES categories(id)
   )`,

  // Tickets importados que aún no se han emparejado con un movimiento
  // (p. ej. porque no se han importado todavía). Cola "en espera".
  `CREATE TABLE IF NOT EXISTS pending_receipts (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     path TEXT NOT NULL,
     ticket_date TEXT,                    -- 'YYYY-MM-DD' detectada
     total REAL,                          -- total detectado
     text TEXT,                           -- texto OCR (para palabras clave)
     items_json TEXT,                     -- desglose detectado (JSON)
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,

  `CREATE TABLE IF NOT EXISTS settings (
     key TEXT PRIMARY KEY,
     value TEXT
   )`,

  // Pagos programados / recurrentes previstos (calendario de próximos pagos).
  `CREATE TABLE IF NOT EXISTS scheduled_payments (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     amount REAL NOT NULL,               -- magnitud (positiva)
     category_id INTEGER REFERENCES categories(id),
     frequency TEXT NOT NULL,            -- 'mensual' | 'semanal' | 'anual'
     next_date TEXT NOT NULL,            -- 'YYYY-MM-DD'
     active INTEGER NOT NULL DEFAULT 1
   )`,

  // Metas de ahorro: objetivo y progreso (aportaciones manuales).
  `CREATE TABLE IF NOT EXISTS goals (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     target_amount REAL NOT NULL,
     current_amount REAL NOT NULL DEFAULT 0,
     target_date TEXT,                   -- 'YYYY-MM-DD' (opcional)
     color TEXT NOT NULL DEFAULT '#6366f1',
     icon TEXT NOT NULL DEFAULT '🎯',
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,

  `CREATE TABLE IF NOT EXISTS dashboard_layout (
     widget_key TEXT PRIMARY KEY,
     x INTEGER NOT NULL DEFAULT 0,
     y INTEGER NOT NULL DEFAULT 0,
     w INTEGER NOT NULL DEFAULT 4,
     h INTEGER NOT NULL DEFAULT 6,
     visible INTEGER NOT NULL DEFAULT 1
   )`,

  `CREATE TABLE IF NOT EXISTS import_batches (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     filename TEXT NOT NULL,
     account_id INTEGER REFERENCES accounts(id),
     imported_at TEXT NOT NULL DEFAULT (datetime('now')),
     total INTEGER NOT NULL DEFAULT 0,
     nuevos INTEGER NOT NULL DEFAULT 0,
     duplicados INTEGER NOT NULL DEFAULT 0
   )`,

  // Etiquetas libres (con color) asignables a varios movimientos.
  `CREATE TABLE IF NOT EXISTS tags (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL UNIQUE,
     color TEXT NOT NULL DEFAULT '#6366f1'
   )`,

  `CREATE TABLE IF NOT EXISTS transaction_tags (
     transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
     tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
     PRIMARY KEY (transaction_id, tag_id)
   )`,

  // Inversiones: un activo (acción/fondo/cripto) con su valor actual por unidad,
  // y los lotes de compra/venta (aportaciones). El P/L se calcula con ambos.
  `CREATE TABLE IF NOT EXISTS investments (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     kind TEXT NOT NULL DEFAULT 'accion',   -- 'accion' | 'fondo' | 'cripto' | 'otro'
     ticker TEXT,
     currency TEXT NOT NULL DEFAULT 'EUR',
     current_price REAL NOT NULL DEFAULT 0,
     updated_at TEXT
   )`,

  `CREATE TABLE IF NOT EXISTS investment_lots (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
     fecha TEXT NOT NULL,
     units REAL NOT NULL,                   -- positivo = compra, negativo = venta
     price REAL NOT NULL,                   -- precio por unidad de la operación
     fees REAL NOT NULL DEFAULT 0,
     notes TEXT
   )`,

  `CREATE INDEX IF NOT EXISTS idx_lots_inv ON investment_lots(investment_id)`,
];
