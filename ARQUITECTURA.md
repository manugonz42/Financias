# Guía de arquitectura y compilación — Financias

Documento de referencia para el desarrollo y la compilación de la app.

## 1. Arquitectura

App de escritorio **Tauri v2**: un shell nativo en Rust + una interfaz web (React).

```
┌─────────────────────────────────────────────┐
│  Webview (React + TS)                         │
│  views/ · widgets/ · components/ · state/     │
│        │ (consultas SQL, comandos)            │
│  data/ ── @tauri-apps/plugin-sql ──► SQLite   │  ← base de datos local
│  import/ ── pdf.js ──► parser ──► categorize  │
│        │ invoke()                             │
├────────┼──────────────────────────────────────┤
│  Rust (src-tauri/)                            │
│  comandos: read_file_bytes, write_text_file   │
│  plugins: sql (sqlite), dialog                │
└─────────────────────────────────────────────┘
```

### Módulos del frontend (`src/`)

- **import/**: `loadPdf.ts` (pdf.js → tokens), `openbankParser.ts` (tokens → movimientos,
  validado: el saldo encadena), `categorize.ts` (categoría/subtipo/comercio/interno),
  `importStatement.ts` (orquestador: parseo → dedupe → inserción).
- **rules/**: taxonomía de categorías y reglas de autocategorización (solo marcas genéricas;
  sin datos personales — ver `feedback` de privacidad).
- **db/**: `schema.ts` (DDL), `database.ts` (conexión + init idempotente), `seed.ts`.
- **data/**: consultas y agregaciones (movimientos, stats, presupuestos, dashboard…).
- **widgets/** + **views/** + **components/**: UI (ECharts, react-grid-layout).

### Datos

- SQLite local (`@tauri-apps/plugin-sql`), fichero en el directorio de datos de la app.
- Deduplicado por `dedupe_key` única (cuenta + fecha + importe + concepto normalizado).
- Privacidad: PDFs y BD están en `.gitignore`; el código no contiene PII.

## 2. Compilación

### 2.1. Local — **flujo actual (Windows y Mac)**

Para desarrollar e iterar (lo más rápido):

```bash
npm install
npm run tauri dev      # compila (incremental) + abre la app con hot-reload
```

Para generar el instalador nativo en local:

```bash
npm run tauri build    # Windows → .msi/.exe   |   macOS → .dmg/.app (arm64)
npm test               # tests del parser
```

> **Nota Windows (este equipo):** `tauri build` (release) puede fallar con
> `os error 4551 — "Una directiva de Control de aplicaciones bloqueó este archivo"`.
> Es el **Smart App Control** de Windows bloqueando build-scripts nuevos sin firmar
> (no es un fallo del código; `tauri dev` funciona igualmente). Para generar el `.msi`
> en local habría que desactivar Smart App Control en *Seguridad de Windows → Control de
> aplicaciones y navegador* (es un interruptor de un solo sentido; decisión de seguridad
> del usuario). En **macOS no aplica**.

### 2.2. CI con GitHub Actions — **activado** (`.github/workflows/build.yml`)

> ✅ **Creado.** GitHub levanta un runner macOS (Apple Silicon → `.dmg` arm64) y otro
> Windows (→ `.msi`) en paralelo, compila y adjunta los instaladores a una Release.
> Gratis en repos públicos. Disparo por **tag** (`git tag v0.1.0 && git push origin v0.1.0`)
> o a mano (Actions → build → *Run workflow*). El workflow real es el de abajo; añade
> `permissions: contents: write` (para crear la Release) y caché de Rust.
>
> **Nota:** el build de macOS compila sin el OCR nativo (el comando `ocr_image` solo está
> implementado en Windows; en Mac devuelve un aviso). El OCR de macOS (Apple Vision) es un
> paso pendiente que conviene implementar y probar en el propio Mac.

```yaml
name: build
on:
  push:
    tags: ['v*']        # se dispara al etiquetar una versión: git tag v0.1.0 && git push --tags
  workflow_dispatch: {}  # o lanzarlo a mano desde la pestaña Actions

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest    # Apple Silicon → .dmg arm64
            args: '--target aarch64-apple-darwin'
          - platform: windows-latest  # → .msi / .exe
            args: ''
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: lts/* }
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin' || '' }}
      - run: npm ci
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Financias ${{ github.ref_name }}'
          releaseDraft: true
          args: ${{ matrix.args }}
```

> 📦 **Cómo sacar una versión (paso a paso): ver [`PUBLICAR_VERSION.md`](PUBLICAR_VERSION.md).**
> Cubre el auto-update: subir versión en los 3 archivos → tag `vX.Y.Z` → publicar Release.

- Disparo por **tag** (`git tag v0.1.0 && git push --tags`) → crea una *Release* en
  GitHub con el `.dmg` y el `.msi` adjuntos (permanentes).
- También se puede lanzar a mano (`workflow_dispatch`).
- Los binarios saldrían **sin firma de desarrollador** (firmar requiere cuenta de Apple
  Developer / certificado Windows). Para uso personal vale; en Mac, abrir la 1ª vez con
  clic derecho → Abrir.
