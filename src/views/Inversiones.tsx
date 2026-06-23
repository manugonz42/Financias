import { EmptyState } from "../components/EmptyState";

export function Inversiones() {
  return (
    <div>
      <div className="topbar"><h1>Inversiones</h1></div>
      <EmptyState
        icon="📈"
        title="Próximamente"
        hint="Aquí irá el seguimiento manual de inversiones (acciones, fondos, cripto) con valor actual y rentabilidad, integrado en el patrimonio neto. El hueco ya está preparado."
      />
    </div>
  );
}
