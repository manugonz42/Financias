import type { ReactNode } from "react";

/** Estado vacío reutilizable: icono + mensaje + acción opcional (CTA). */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <p className="empty-title">{title}</p>
      {hint && <p className="muted empty-hint">{hint}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
