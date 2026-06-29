import { NavLink, Routes, Route } from "react-router-dom";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_LUCIDE } from "./lib/icons";
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
import {
  ChartLineUp as PhDashboard,
  PaperPlaneRight as PhMovimientos,
  TagSimple as PhCategorizar,
  Wallet as PhPresupuestos,
  Target as PhMetas,
  CalendarBlank as PhProgramados,
  TrendUp as PhInversiones,
  DownloadSimple as PhImportar,
  GearSix as PhAjustes,
} from "@phosphor-icons/react";

const NAV = [
  { to: "/", label: "Dashboard", icon: dashboardIcon, emoji: "📊", end: true },
  { to: "/movimientos", label: "Movimientos", icon: transaccionesIcon, emoji: "💸" },
  { to: "/categorizar", label: "Categorizar", icon: gastosIcon, emoji: "🏷️" },
  { to: "/presupuestos", label: "Presupuestos", icon: presupuestoIcon, emoji: "💰" },
  { to: "/metas", label: "Metas", icon: metasIcon, emoji: "🎯" },
  { to: "/programados", label: "Programados", icon: calendarioIcon, emoji: "📅" },
  { to: "/inversiones", label: "Inversiones", icon: inversionesIcon, emoji: "📈" },
  { to: "/importar", label: "Importar", icon: cuentasIcon, emoji: "📥" },
  { to: "/ajustes", label: "Ajustes", icon: configuracionIcon, emoji: "⚙️" },
];

/** Iconos Phosphor únicos por ruta (sin repetidos). */
const NAV_PHOSPHOR: Record<string, typeof PhDashboard> = {
  "/": PhDashboard,
  "/movimientos": PhMovimientos,
  "/categorizar": PhCategorizar,
  "/presupuestos": PhPresupuestos,
  "/metas": PhMetas,
  "/programados": PhProgramados,
  "/inversiones": PhInversiones,
  "/importar": PhImportar,
  "/ajustes": PhAjustes,
};

export default function App() {
  const { iconStyle } = useApp();
  const linkBase =
    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors";
  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col gap-0.5 border-r border-border bg-card p-3">
        <div className="flex items-center gap-2 px-3 pb-4 pt-2 text-lg font-bold text-foreground">
          {iconStyle === "linear" ? (
            <Wallet className="size-5 shrink-0" />
          ) : iconStyle === "phosphor" ? (
            <PhDashboard className="size-5 shrink-0" weight="bold" />
          ) : (
            "💰"
          )} Financias
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const LinearIcon = NAV_LUCIDE[n.to];
            const PhIcon = NAV_PHOSPHOR[n.to];
            return (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  linkBase,
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              {iconStyle === "linear" && LinearIcon ? (
                <LinearIcon className="size-[22px] shrink-0" />
              ) : iconStyle === "phosphor" && PhIcon ? (
                <PhIcon className="size-[22px] shrink-0" weight="bold" />
              ) : (
                <img className="h-[22px] w-[22px] shrink-0 object-contain" src={n.icon} alt="" />
              )}
              <span>{n.label}</span>
            </NavLink>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto p-7">
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
