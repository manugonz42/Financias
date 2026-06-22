# Hoja de ruta — Financias

App de escritorio de finanzas personales (Tauri v2 + React + SQLite) que importa los
extractos PDF de Openbank y los analiza en local. Este documento es el plan vivo del
proyecto: estado de cada fase y lo que queda por hacer. Se actualiza según avanza.

Leyenda: ✅ hecho · 🔄 en curso · ⏳ pendiente · 💡 idea/backlog

---

## Fase 0 — Andamiaje ✅

- ✅ Proyecto Tauri v2 + React 18 + TypeScript + Vite.
- ✅ Plugins `sql` (SQLite) y `dialog` (selector de archivos) configurados.
- ✅ Esquema SQLite e inicialización idempotente (`db/schema.ts`, `db/database.ts`).
- ✅ Seed de cuentas, categorías y reglas (`db/seed.ts`, `rules/`).

## Fase 1 — Importación ✅

- ✅ Parser de PDF con pdf.js (`import/loadPdf.ts`, `import/openbankParser.ts`).
- ✅ **Validado contra los PDFs reales**: el saldo encadena con 0 discrepancias.
- ✅ Autocategorización por reglas (categoría / subtipo / comercio / traspaso interno).
- ✅ **Deduplicado** por clave única (cuenta + fecha + importe + concepto normalizado):
  distingue movimientos nuevos de los ya añadidos.
- ✅ Pantalla "Importar" con recuento de nuevos / duplicados.

## Fase 2 — Movimientos ✅

- ✅ Tabla con filtros (mes, categoría, subtipo, cuenta) y búsqueda por texto.
- ✅ Edición manual de categoría.
- ✅ Exportar a CSV lo filtrado.

## Fase 3 — Dashboard ✅

- ✅ Grid de **widgets reordenables y ocultables** (react-grid-layout); el layout
  se guarda en SQLite.
- ✅ Gráficos (ECharts): donut por categoría, barras gasto/ingreso, línea de saldo, KPIs.
- ✅ Selector de cuenta: Nómina / Ahorro / Ambas.

## Fase 4 — Análisis ✅

- ✅ **Presupuestos** mensuales por categoría ("gastos esperados") con progreso real.
- ✅ Panel de **cajero/efectivo** (disposiciones y totales por mes).
- ✅ Detector de **suscripciones/recurrentes**.
- ✅ **Tasa de ahorro** real (ingresos − gastos) y toggle para excluir traspasos internos.

## Fase 5 — Empaquetado 🔄

- ✅ Build nativo **Windows**: `.msi`, instalador NSIS `-setup.exe` y `financias.exe`
  portable (generados en `src-tauri/target/release/`).
- ⏳ Build nativo **macOS** (Apple Silicon → `.dmg`/`.app`): pendiente de hacerlo en el Mac
  (Tauri no cross-compila Mac↔Windows).
- ⏳ Documentar en README la instalación del instalador para el usuario final.

---

## Próximos pasos / pendiente

- ⏳ **Módulo de Inversiones** (hueco preparado en `views/Inversiones.tsx`, sin implementar).
- ⏳ **CI con GitHub Actions** para compilar `.dmg` + `.msi` automáticamente al etiquetar
  una versión (workflow ya documentado en `ARQUITECTURA.md`, aún no activado).
- ⏳ Pruebas en macOS (M4) y ajuste de rendimiento/empaquetado.

## Ideas / backlog 💡

- 💡 Previsión de gastos del mes en curso según ritmo de gasto.
- 💡 Alertas al superar un presupuesto de categoría.
- 💡 Comparativa mes a mes / año a año por categoría.
- 💡 Etiquetas libres además de categorías.
- 💡 Reglas de categorización editables desde la propia app (UI).
- 💡 Copia de seguridad / exportar-importar la base de datos.

---

## Privacidad (recordatorio permanente)

El repo es **público**: nunca se versionan PDFs, la base de datos ni PII. Los datos reales
(nombre, IBAN, importes) se leen del PDF al importar y viven solo en la BD local
(`%APPDATA%` / directorio de datos de la app). En código y tests, solo datos sintéticos.
