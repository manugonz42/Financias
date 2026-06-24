import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import App from "./App";
import { AppProvider } from "./state/AppContext";
import "./index.css";

// Nota: sin React.StrictMode a propósito. En dev, el doble montaje de StrictMode
// rompe el arrastre/redimensionado de react-grid-layout (referencia interna que
// queda huérfana). En la build de producción StrictMode no duplica, pero lo
// quitamos para que `tauri dev` se comporte igual que la app final.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <AppProvider>
    <HashRouter>
      <App />
    </HashRouter>
  </AppProvider>,
);
