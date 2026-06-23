import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

// Al iniciar, comprueba si hay una versión nueva en la Release de GitHub. Si la
// hay, muestra un aviso; al pulsar "Actualizar" descarga, instala y reinicia.
// En desarrollo (sin instalar / sin release) check() falla y no se muestra nada.
export function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await check();
        if (!cancelled && u) setUpdate(u);
      } catch {
        /* sin conexión, sin releases o modo dev: silencioso */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!update || dismissed) return null;

  async function doUpdate() {
    if (!update) return;
    setState("working");
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch {
      setState("error");
    }
  }

  return (
    <div className="update-banner">
      <span>🚀 Versión <b>{update.version}</b> disponible.</span>
      <span className="spacer" />
      {state === "error" && <span className="amount neg" style={{ fontSize: 12 }}>Error al actualizar</span>}
      <button className="primary" onClick={() => void doUpdate()} disabled={state === "working"}>
        {state === "working" ? "Actualizando…" : "Actualizar"}
      </button>
      <button className="link-btn" onClick={() => setDismissed(true)}>Ahora no</button>
    </div>
  );
}
