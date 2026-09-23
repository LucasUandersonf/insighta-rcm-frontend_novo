import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";

/**
 * "Importar dados" (Redesign 2026): Central de upload e Setup de
 * importação eram dois módulos para UMA tarefa — trazer o dado do ERP
 * para dentro. Viraram um módulo só, com duas vistas.
 */
const VIEWS = [
  { to: "/upload", label: "Enviar arquivos" },
  { to: "/setup", label: "Mapeamento e linhas rejeitadas" },
];

export function ImportDataNav() {
  return (
    <nav aria-label="Importar dados" className="flex gap-[22px] border-b border-border-hairline">
      {VIEWS.map((v) => (
        <NavLink
          key={v.to}
          to={v.to}
          className={({ isActive }) =>
            cn("-mb-px pb-3 text-[13px]", isActive ? "border-b-2 border-accent-muted font-medium text-ink" : "text-ink-faint hover:text-ink")
          }
        >
          {v.label}
        </NavLink>
      ))}
    </nav>
  );
}
