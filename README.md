# 💰 Financias

App de escritorio (nativa, multiplataforma) para controlar tus finanzas personales
a partir de los extractos de movimientos en PDF de **Openbank**. Construida con
**Tauri** (binarios nativos para macOS y Windows), React + TypeScript y SQLite local.

Todo funciona **en local y offline**: tus datos no salen de tu ordenador.

## 🔒 Privacidad (importante)

Este repositorio es **público**. Los extractos PDF y la base de datos contienen
datos personales (NIF, IBAN, historial), por eso el `.gitignore` evita subir:

- `*.pdf`, `*.csv` — extractos y exportaciones
- `*.sqlite`, `*.db`, `data/` — la base de datos local
- Ficheros `*.local.json`

El código no contiene datos personales: el nombre del titular y los números de
cuenta se leen del PDF al importar y se guardan **solo en tu base de datos local**.

## ✨ Funcionalidades

- **Importar PDFs de Openbank** (nómina y ahorro) con **deduplicado**: al reimportar
  un extracto, distingue los movimientos nuevos de los ya añadidos.
- **Dashboard modificable** con widgets **reordenables y ocultables** (se guarda el layout).
- **Selector de cuenta**: nómina, ahorro o ambas.
- **Gráficos**: gasto por categoría (donut), gastos vs ingresos por mes (barras),
  evolución de saldo / patrimonio neto (línea), efectivo en cajero.
- **Filtros y búsqueda**: por mes, categoría, tipo de movimiento, importe y texto libre.
- **Autocategorización** por reglas (editable) sembrada con tus comercios reales.
- **Presupuestos** mensuales por categoría ("gastos esperados") con progreso real.
- **Detección de suscripciones / pagos recurrentes**.
- **Tasa de ahorro real** y **detección de traspasos internos** entre tus cuentas
  (no cuentan como gasto/ingreso real; se pueden excluir del análisis).
- **Exportar a CSV** los movimientos filtrados.
- Hueco preparado para **Inversiones** (futuro).

## 🛠 Requisitos

- [Node.js](https://nodejs.org) LTS (18+)
- [Rust](https://rustup.rs) (toolchain estable)
- **macOS**: Command Line Tools de Xcode (`xcode-select --install`)
- **Windows**: "Desktop development with C++" (VS Build Tools) + WebView2 (ya viene en Win11)

## ▶️ Ejecutar en desarrollo

```bash
npm install
npm run tauri dev
```

## 📦 Compilar binario nativo

```bash
npm run tauri build
```

- En **macOS** genera `.app` / `.dmg` (en un Mac con Apple Silicon, binario arm64 nativo).
- En **Windows** genera `.exe` / `.msi`.

> Tauri **no** compila de Mac a Windows ni viceversa: genera cada binario en su
> propio sistema operativo (o mediante CI, p.ej. GitHub Actions).

## ✅ Tests

```bash
npm test
```

Incluye una validación del parser contra extractos reales que comprueba que el
saldo encadena correctamente (parseo exacto) — los PDFs no se versionan, así que
ese test se omite si no están presentes en local.

## 🧱 Estructura

```
src/
  import/   Parser de PDF (pdf.js), categorización, deduplicado, orquestador
  rules/    Taxonomía de categorías y reglas de autocategorización
  db/        Esquema SQLite, conexión y semilla
  data/      Consultas y agregaciones (movimientos, stats, presupuestos, ...)
  widgets/   Widgets del dashboard
  views/     Pantallas (Dashboard, Movimientos, Importar, Presupuestos, ...)
  components/ Controles y gráficos (ECharts)
src-tauri/   Shell de Rust (plugins sql/dialog, comandos de fichero)
```

## 📥 Cómo usar

1. Abre la app y ve a **Importar**.
2. Selecciona uno o varios PDF de movimientos de Openbank.
3. Revisa el resumen (nuevos / ya existentes) y explora el **Dashboard**.
