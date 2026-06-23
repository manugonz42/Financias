import { NavLink, Routes, Route } from "react-router-dom";
import { useApp } from "./state/AppContext";
import { UpdateBanner } from "./components/UpdateBanner";
import { Dashboard } from "./views/Dashboard";
import { Movimientos } from "./views/Movimientos";
import { Categorizar } from "./views/Categorizar";
import { Importar } from "./views/Importar";
import { Presupuestos } from "./views/Presupuestos";
import { Metas } from "./views/Metas";
import { Programados } from "./views/Programados";
import { Inversiones } from "./views/Inversiones";
import { Ajustes } from "./views/Ajustes";

const NAV = [
  { to: "/", label: "Dashboard", icon: "📊", end: true },
  { to: "/movimientos", label: "Movimientos", icon: "📋" },
  { to: "/categorizar", label: "Categorizar", icon: "🏷️" },
  { to: "/presupuestos", label: "Presupuestos", icon: "🎯" },
  { to: "/metas", label: "Metas", icon: "🐷" },
  { to: "/programados", label: "Programados", icon: "📅" },
  { to: "/inversiones", label: "Inversiones", icon: "📈" },
  { to: "/importar", label: "Importar", icon: "📥" },
  { to: "/ajustes", label: "Ajustes", icon: "⚙️" },
];

export default function App() {
  const { theme, setTheme } = useApp();
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">💰 Financias</div>
        <nav>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => (isActive ? "navlink active" : "navlink")}
            >
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          className="navlink theme-toggle"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title="Cambiar tema"
        >
          <span>{theme === "dark" ? "☀️" : "🌙"}</span>
          <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
        </button>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/movimientos" element={<Movimientos />} />
          <Route path="/categorizar" element={<Categorizar />} />
          <Route path="/presupuestos" element={<Presupuestos />} />
          <Route path="/metas" element={<Metas />} />
          <Route path="/programados" element={<Programados />} />
          <Route path="/inversiones" element={<Inversiones />} />
          <Route path="/importar" element={<Importar />} />
          <Route path="/ajustes" element={<Ajustes />} />
        </Routes>
      </main>
      <UpdateBanner />
    </div>
  );
}
