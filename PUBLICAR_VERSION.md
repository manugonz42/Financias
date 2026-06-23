# Cómo publicar una nueva versión

Guía para sacar una versión nueva de Financias y que las apps ya instaladas la
**detecten y se actualicen solas**. Versionado semántico `MAJOR.MINOR.PATCH`
(p. ej. `0.2.0`). El **tag de git es la versión con prefijo `v`** (`v0.2.0`).

---

## Requisitos (una sola vez)

En el repo de GitHub → **Settings → Secrets and variables → Actions**:

- **`TAURI_SIGNING_PRIVATE_KEY`** = contenido completo del archivo de clave privada
  del updater: `C:\Users\Manu\.tauri\financias_updater.key`
  (verlo: `type "%USERPROFILE%\.tauri\financias_updater.key"`).
- **`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`** = no hace falta (la clave se generó sin
  contraseña). Si no creas el secreto, el CI usa contraseña vacía, que es lo correcto.

> ⚠️ **Haz copia de seguridad de la clave privada.** Si se pierde, no se podrán firmar
> futuras actualizaciones y el auto-update dejará de funcionar (habría que generar otra
> clave, cambiar la `pubkey` en `tauri.conf.json` y reinstalar a mano en cada equipo).

---

## Pasos para cada versión

1. **Sube el número en los 3 archivos** (deben coincidir exactamente):
   - `src-tauri/tauri.conf.json` → `"version": "X.Y.Z"`
   - `package.json` → `"version": "X.Y.Z"`
   - `src-tauri/Cargo.toml` → `version = "X.Y.Z"` (en la sección `[package]`)

2. **Commit:**
   ```bash
   git add -A && git commit -m "release: vX.Y.Z"
   ```

3. **Etiqueta y sube** (el tag dispara el build):
   ```bash
   git push
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

4. **GitHub Actions** (pestaña *Actions → build*) compila en paralelo Windows y macOS,
   **firma** los paquetes y crea una **Release en borrador** con `.msi`, `.dmg`, los
   artefactos de actualización y el `latest.json`.

5. **Publica la Release**: *Releases → edita el borrador → Publish release*.
   Es **imprescindible** que quede publicada (no en borrador) para que la URL
   `releases/latest/download/latest.json` resuelva y el updater la encuentre.

---

## Qué pasa en las apps ya instaladas

Al **abrir la app**, compara su versión con la del `latest.json`. Si hay una nueva,
muestra abajo: **«🚀 Versión X.Y.Z disponible · Actualizar»**. Al pulsar **Actualizar**
descarga, instala y reinicia con la versión nueva. **Los datos locales se conservan**
(la base de datos vive en `%APPDATA%\com.manugonz.financias`, no en el ejecutable).

---

## Notas

- El **tag debe coincidir** con la versión de los archivos (`v0.2.0` ↔ `0.2.0`).
- El auto-update **no funciona en `tauri dev`**: solo en builds instalados, y requiere
  al menos una Release **publicada** con la que comparar.
- La **primera** versión hay que instalarla a mano (descargar el instalador de la
  Release). A partir de ahí, las siguientes se autoactualizan.
- Los instaladores salen **sin firma de SO** (Apple/Windows): la primera apertura puede
  avisar (en Mac: clic derecho → Abrir). La firma del *updater* (la de esta guía) es
  aparte y sí está configurada.
