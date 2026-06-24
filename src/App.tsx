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
import dashboardIcon from "./assets/icons/app/dashboard.png";
import transaccionesIcon from "./assets/icons/app/transacciones.png";
import gastosIcon from "./assets/icons/app/gastos.png";
import presupuestoIcon from "./assets/icons/app/presupuesto.png";
import metasIcon from "./assets/icons/app/metas.png";
import calendarioIcon from "./assets/icons/app/calendario.png";
import inversionesIcon from "./assets/icons/app/inversiones.png";
import cuentasIcon from "./assets/icons/app/cuentas.png";
import configuracionIcon from "./assets/icons/app/configuracion.png";

const NAV = [
  { to: "/", label: "Dashboard", icon: dashboardIcon, end: true },
  { to: "/movimientos", label: "Movimientos", icon: transaccionesIcon },
  { to: "/categorizar", label: "Categorizar", icon: gastosIcon },
  { to: "/presupuestos", label: "Presupuestos", icon: presupuestoIcon },
  { to: "/metas", label: "Metas", icon: metasIcon },
  { to: "/programados", label: "Programados", icon: calendarioIcon },
  { to: "/inversiones", label: "Inversiones", icon: inversionesIcon },
  { to: "/importar", label: "Importar", icon: cuentasIcon },
  { to: "/ajustes", label: "Ajustes", icon: configuracionIcon },
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
              <img className="navicon" src={n.icon} alt="" />
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
