# CLAUDE.md — mapa del proyecto Financias

> Índice maestro para orientarse rápido (menos tokens) antes de tocar nada.
> Para detalle, ir al doc enlazado en cada punto. **Mantener este archivo al día**
> cuando se añadan vistas, tablas o comandos.

## Qué es

App de escritorio de **finanzas personales** que importa extractos PDF de banco
(Openbank cuenta nómina/ahorro + Unicaja), los categoriza y muestra dashboard,
presupuestos, metas y movimientos. Repo **público** → nunca subir PII/datos
bancarios reales (usar datos sintéticos). Objetivo: binario nativo Mac (M4) + Windows.

## Stack

Tauri v2 (Rust) · React 18 + TypeScript + Vite · SQLite (`@tauri-apps/plugin-sql`)
· pdf.js (parseo) · Nivo (@nivo/pie·bar·line·calendar·sunburst·bullet·radial-bar) +
gráficos SVG propios (`nivo-pro.tsx`) · react-grid-layout (widgets
reordenables/redimensionables) · Tailwind v4 + shadcn/ui (UI) ·
@phosphor-icons/react (iconos) · Geist (fuente editorial).

## Docs de referencia (leer según la tarea)

| Doc | Para qué |
|-----|----------|
| [ARQUITECTURA.md](ARQUITECTURA.md) | Arquitectura, módulos, **compilación** (dev/build, nota Smart App Control), CI |
| [HOJA_DE_RUTA.md](HOJA_DE_RUTA.md) | Roadmap / features pendientes y hechas |
| [COMPETENCIA.md](COMPETENCIA.md) | Análisis competitivo y nicho |
| [PUBLICAR_VERSION.md](PUBLICAR_VERSION.md) | **Sacar versión**: subir versión + tag + Release + auto-update |
| [README.md](README.md) | Presentación del repo |

## Comandos

```bash
npm run tauri dev     # desarrollo con hot-reload (lo más rápido para iterar)
npm run tauri build   # instalador nativo (.msi Win / .dmg Mac arm64)
npm test              # vitest (tests del parser/lógica pura)
npm run release       # subir versión + tag (scripts/release.mjs) → dispara CI/Release
```

> Build local en Windows puede fallar por **Smart App Control** (os error 4551) —
> es del SO, no del código; `tauri dev` funciona igual. Detalle en ARQUITECTURA.md §2.

## Mapa del código (`src/`)

- **`import/`** — pipeline de importación:
  - `loadPdf.ts` (pdf.js → tokens) · `openbankParser.ts` / `unicajaParser.ts` / `bbvaParser.ts`
    (tokens → movimientos; **validado: el saldo encadena**) ·
    `categorize.ts` (categoría/subtipo/comercio/interno) ·
    `importStatement.ts` (orquestador: parseo → dedupe → inserción)
- **`rules/`** — `categoryRules.ts`: taxonomía + reglas de autocategoría (solo marcas genéricas, **sin PII**)
- **`db/`** — `schema.ts` (DDL, `CREATE TABLE IF NOT EXISTS`) · `database.ts` (conexión + init idempotente) · `seed.ts`
- **`data/`** — capa de consultas SQL por dominio: `transactions` · `accounts` · `budgets` ·
  `categories` · `dashboard` · `stats` · `filters` · `goals` · `receipts` · `rules` ·
  `scheduled` · `settings` · `splits` · `tickets` · `review` · `forecast`
  - Filtro común `TxFilters` (`types.ts`) → `buildWhere` (`filters.ts`); `month` pisa a `from/to`.
  - **Métrica del dashboard → función** (`stats.ts` salvo nota): `kpis` (resumen periodo) ·
    `monthlyFlows` (gastos vs ingresos / tendencia) · `spendByCategoryId`+`lib/donut`
    (rosco y sunburst por jerarquía) · `cashByMonth` (cajero) · `accountBalanceSeries` /
    `netWorthSeries` (saldo / patrimonio) · `dailySpend` (calendario) · **forecast** en
    `data/forecast.ts`: `getLiquidityHeatmap`, `getCashFlowForecast`, `getRiskFlags`.
- **`lib/`** — utilidades puras (testeables): `format` · `csv` · `donut` · `goals` ·
  `schedule` · `text` · `receiptParse` · `ticketMatch` · `forecast`
- **`views/`** — pantallas (1 por ruta): `Dashboard` · `Movimientos` · `Importar` ·
  `Categorizar` · `Presupuestos` · `Metas` · `Programados` · `Inversiones` (hueco, sin implementar) · `Ajustes`
- **`widgets/`** — widgets del dashboard (grid en `views/Dashboard.tsx`):
  - `widgets.tsx` → registro `WIDGETS` + tipos `WidgetProps`/`WidgetDef` + helper `scope(p)`→`TxFilters`.
  - `proWidgets.tsx` → registro `PRO_WIDGETS`: 8 gráficos rediseñados, cada uno con 3 estilos
    conmutables (minimal/colorful/aurora) vía `useWidgetLook.ts` (+ botón por widget y
    selector global en la barra; estilo en `lib/widgetLook.ts`).
  - **Añadir widget**: escribe un `FC<WidgetProps>` + entrada en `WIDGETS` o `PRO_WIDGETS`;
    el Dashboard combina ambos (`ALL_WIDGETS`) y `flowPack` lo coloca solo (sin migración de BD).
    Datos con `scope(p)` → `data/`; controles a la cabecera con `createPortal(…, p.headerSlot)`.
- **`components/`** — UI reutilizable: `CategoryManager` · `ColorPicker` · `Controls` · `EmptyState` ·
  `IconPicker` · `ManualAccounts` · `ReceiptEditor` · `SplitEditor` · `TicketImport` ·
  `UpdateBanner` · `ui/` (shadcn: button, card…) · **`charts/`**: `nivo.tsx` (principal) ·
  `nivo-alts.tsx` (variantes) · `nivo-pro.tsx` (SVG propios, 3 estilos) ; hooks de override
  por widget `useChartPalette` / `useBarStyle` / `useWidgetLook`
- **`state/AppContext.tsx`** — estado global · **`types.ts`** — tipos compartidos · **`App.tsx`** — router/layout

## Backend Rust (`src-tauri/src/lib.rs`)

- Comandos `invoke()`: `read_file_bytes`, `write_text_file`, `ocr_image`
  (OCR nativo: Windows `Windows.Media.Ocr` · macOS Apple Vision vía `objc2`).
- Plugins: `sql` (sqlite) · `dialog` · `opener` · `updater` · `process`.
- Config: `tauri.conf.json` · permisos: `capabilities/default.json`.

## Base de datos (tablas en `src/db/schema.ts`)

`accounts` · `account_balances` · `categories` · `category_rules` · `transactions`
· `budgets` · `transaction_splits` · `receipt_items` · `item_rules` ·
`pending_receipts` · `settings` · `scheduled_payments` · `goals` ·
`dashboard_layout` · `import_batches`.
Dedupe por `dedupe_key` única (cuenta + fecha + importe + concepto normalizado).
`settings` (clave/valor, `data/settings.ts`) guarda tema, paleta, iconos y estilo global
(`widget_look`) + overrides por widget: `palette:<key>`, `barstyle:<key>`, `look:<key>`.
`dashboard_layout` (1 fila por widget) guarda posición/tamaño/visibilidad; los widgets sin
fila se auto-colocan.

## Tests (`tests/`, vitest)

`parser.test.ts` · `goals.test.ts` · `receiptParse.test.ts` · `schedule.test.ts` ·
`ticketMatch.test.ts`. Cubren lógica pura de `lib/` e `import/` (sin Tauri).

## Reglas del proyecto

- **Privacidad**: PDFs y `.db` en `.gitignore`; el código nunca contiene datos reales.
- Para una **mejora típica**: tocar `views/` (UI) → `data/` (consulta) → si hace falta
  esquema, `db/schema.ts`. Lógica pura nueva → `lib/` + su test en `tests/`.
- Para un **widget nuevo**: `FC<WidgetProps>` + entrada en `WIDGETS`/`PRO_WIDGETS` (`widgets/`),
  datos reutilizando `data/stats.ts` o `data/forecast.ts` (ver mapa métrica→función arriba).
- Para **versionar/publicar**: seguir PUBLICAR_VERSION.md (no editar versiones a mano sueltas).
