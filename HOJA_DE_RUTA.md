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

---

## Fase 6 — Paridad con la competencia ⏳

Huecos detectados frente a las apps top de escritorio/local (Firefly III, Actual Budget,
GnuCash; ref. YNAB/Monarch). Orden recomendado por impacto: las primeras se apoyan entre sí
y desbloquean el patrimonio neto, el mayor diferenciador.

- ✅ **Categorías jerárquicas editables** — árbol de profundidad libre (`parent_id`), CRUD
  desde Ajustes (crear/editar/mover/borrar). Asignación de movimientos a cualquier nivel.
  `subtype` se mantiene como dimensión independiente "tipo de movimiento".
  *Pendiente de seguimiento:* roll-up de subcategorías en presupuestos (el donut ya hace
  drill-down con `subtreeIds`).

1. ✅ **Cuentas manuales** — crear cuentas que no vienen de un PDF (efectivo, inversión,
   inmueble, tarjeta, préstamo, hipoteca…) con saldos por snapshots fechados. Gestión en
   Ajustes; aparecen en el selector de cuentas.
2. ✅ **Patrimonio neto (net worth) en el tiempo** — `netWorthSeries` = activos − pasivos,
   combinando saldos de movimientos (importadas) y snapshots (manuales), con forward-fill.
   Ya se refleja en el widget "Evolución de saldo / patrimonio".
3. ✅ **Tipos de cuenta activo/pasivo** — `accounts.manual` + `accounts.class`; tarjetas,
   préstamos e hipotecas como pasivos que restan en el patrimonio neto.
4. ✅ **Split de transacciones** — dividir un movimiento en varias categorías
   (ej. ticket de súper = comida + droguería + ocio). Tabla `transaction_splits` +
   subconsulta de "filas efectivas" que solo afecta a las agregaciones por categoría
   (donut y presupuestos); KPIs/saldo/flujos no cambian. Editor ✂ en Movimientos.
5. ✅ **Metas de ahorro (goals)** — objetivo + ahorrado + fecha; barra de progreso, ritmo
   mensual necesario y aportaciones manuales. Pestaña «Metas» + widget en el dashboard.
6. ✅ **Reconciliación (marcar como revisado)** — flag `reconciled` por movimiento, checkbox y
   filtro (conciliados/pendientes) en Movimientos, recuento y conciliar/desmarcar en bloque.
   (El cuadre de saldo ya lo garantiza el parser al importar.)
7. ⏳ **Transacciones programadas / próximos pagos** — calendario de pagos futuros y recurrentes
   previstos (proyectar a futuro las suscripciones que ya se detectan).
8. ⏳ **Adjuntar recibos** a un movimiento.
9. ⏳ **Rollover de presupuesto** (estilo envelope: lo no gastado pasa al mes siguiente).

## Fase 7 — UI / UX ⏳

- ⏳ **Sistema de diseño coherente + modo oscuro** — tokens de color/espaciado y tipografía
  consistentes.
- ⏳ **Estados vacíos con acción** — en vez de tablas/gráficos vacíos, un CTA
  ("Importa tu primer extracto").
- ⏳ **Drill-down de categoría** — clic en una porción del donut → desglose de esa categoría.
- ⏳ **Densidad y jerarquía en la tabla de movimientos** — iconos de categoría, color por signo,
  agrupar por fecha.

> Descartados de momento (2026-06-23): onboarding guiado y paleta de comandos (Cmd/Ctrl+K).

## Ideas / backlog 💡

- 💡 Previsión de gastos del mes en curso según ritmo de gasto.
- 💡 Alertas al superar un presupuesto de categoría.
- 💡 Comparativa mes a mes / año a año por categoría.
- 💡 Etiquetas libres además de categorías.
- 💡 Reglas de categorización editables desde la propia app (UI).
- 💡 Copia de seguridad / exportar-importar la base de datos.
- 💡 Multi-divisa (Firefly la tiene; útil si se amplía el alcance).
- 💡 **Donut "lupa" (fisheye) en el hover** — aumentar las porciones pequeñas al acercar el
  ratón para poder apuntarlas. *Intentado y revertido (jun 2026): con `setOption` imperativo +
  `universalTransition` las porciones se ponían en negro y se mezclaban al salir/entrar el ratón.
  Reintentar con otra técnica (p. ej. `minAngle` para un suelo angular, o `graphic`/custom series
  en vez de recalcular valores en cada `mousemove`).*

---

## Privacidad (recordatorio permanente)

El repo es **público**: nunca se versionan PDFs, la base de datos ni PII. Los datos reales
(nombre, IBAN, importes) se leen del PDF al importar y viven solo en la BD local
(`%APPDATA%` / directorio de datos de la app). En código y tests, solo datos sintéticos.
