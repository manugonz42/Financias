# Instalar Financias en macOS

Financias es una app de escritorio (Tauri). El paquete de macOS (`.app` / `.dmg`)
**debe compilarse en un Mac** — no se puede generar desde Windows.

> Importante: este repositorio debe contener el código que quieres instalar. Si has
> añadido funcionalidades en local, asegúrate de haberlas subido (commit + push) y de
> clonar/actualizar el repo en el Mac antes de compilar.

---

## 1. Prerrequisitos (solo la primera vez)

```bash
# Herramientas de compilación de Apple
xcode-select --install

# Rust (toolchain de compilación de Tauri)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# tras instalar, reinicia la terminal o: source "$HOME/.cargo/env"

# Node.js 18+ (con Homebrew, o desde https://nodejs.org)
brew install node
```

## 2. Obtener el código

```bash
git clone https://github.com/manugonz42/Financias.git
cd Financias
# o, si ya lo tienes clonado:  git pull
```

## 3. Compilar la app

```bash
npm install
npm run tauri build
```

> **Nota sobre el auto-updater:** si `src-tauri/tauri.conf.json` tiene
> `"createUpdaterArtifacts": true`, el build pedirá la clave privada de firma
> (`TAURI_SIGNING_PRIVATE_KEY`) y fallará si no la tienes. Para una instalación
> personal/local, ponlo en `false`:
>
> ```json
> "bundle": { "createUpdaterArtifacts": false, ... }
> ```
>
> (El auto-update solo hace falta si publicas releases firmadas en GitHub.)

## 4. Resultado

Los artefactos quedan en:

```
src-tauri/target/release/bundle/dmg/Financias_<version>_<arch>.dmg
src-tauri/target/release/bundle/macos/Financias.app
```

`<arch>` será `aarch64` en Macs con Apple Silicon (M1/M2/M3…) o `x64` en Intel.

## 5. Instalar

1. Abre el `.dmg` y arrastra **Financias** a la carpeta *Aplicaciones*.
2. La app no está firmada con una cuenta de Apple Developer, así que Gatekeeper
   la bloqueará la primera vez. Para abrirla:
   - **Clic derecho sobre la app → Abrir → Abrir**, o
   - en terminal:
     ```bash
     xattr -dr com.apple.quarantine /Applications/Financias.app
     ```
3. A partir de ahí funciona como cualquier app (Launchpad, Spotlight, etc.).

Los datos se guardan localmente en SQLite, en el directorio de datos de la app
del usuario. Para respaldarlos usa **Ajustes → Copia de seguridad**.

---

## Alternativa: compilar en la nube (GitHub Actions)

El repo incluye `.github/workflows/build.yml`, que genera el `.dmg` (y el `.msi`
de Windows) al hacer push de un tag de versión. Descargas el `.dmg` desde el
Release de GitHub y lo instalas como en el paso 5. Requiere tener configurados
los secretos de firma del updater en el repositorio.

## Desarrollo (sin instalar)

Para ejecutarla en modo desarrollo sin generar el paquete:

```bash
npm install
npm run tauri dev
```
