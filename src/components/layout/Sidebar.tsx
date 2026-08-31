import { NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { CurrentUser } from "@/lib/types";

interface NavItem {
  to: string;
  label: string;
  /** Papéis que podem ver este item — omitido = todo mundo autenticado vê. */
  roles?: CurrentUser["role"][];
}

// Espelha o RBAC real do backend (ver require_role() em cada endpoint) —
// um item só aparece pra quem o backend de fato deixaria usar. Esconder
// não é a camada de segurança (o backend já barra por conta própria);
// é só não oferecer um botão que vai dar 403.
const NAV_ITEMS: NavItem[] = [
  // Sala de Comando (Dashboards de Decisão) — dado estratégico/financeiro
  // agregado, mesmo critério de RBAC do backend em analytics.py: fora do
  // alcance de "atendimento" (recepção).
  { to: "/decisao", label: "Sala de Comando", roles: ["owner", "admin", "financeiro", "auditor"] },
  { to: "/", label: "Painel" },
  { to: "/appointments", label: "Consultas" },
  // Ação de escrita — mesmo RBAC do backend em ingestion.py/_CAN_MANAGE
  // e contracts.py/_CAN_WRITE (owner/admin/financeiro); sem auditor.
  { to: "/upload", label: "Central de Upload", roles: ["owner", "admin", "financeiro"] },
  // Convênios/Contratos: dado financeiro sensível (tabela de repasse) —
  // mesmo RBAC do backend em contracts.py, fora do alcance de "atendimento".
  { to: "/contracts", label: "Convênios & Contratos", roles: ["owner", "admin", "financeiro", "auditor"] },
  // Mesmo RBAC dos outros itens financeiros — recurso de glosa é dado
  // financeiro/jurídico sensível, fora do alcance de "atendimento".
  { to: "/denial-appeals", label: "Recurso de Glosa", roles: ["owner", "admin", "financeiro", "auditor"] },
];

// Administração da plataforma — só owner/admin (mesmo RBAC do backend
// para /users, /tenant e /integrations). Renderizada como grupo à parte
// na navegação para não misturar "operação da clínica" com
// "administração da conta SaaS".
const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: "/admin/users", label: "Usuários", roles: ["owner", "admin"] },
  { to: "/admin/integrations", label: "Integrações & Webhooks", roles: ["owner", "admin"] },
  { to: "/admin/tenant", label: "Minha Clínica", roles: ["owner", "admin"] },
  { to: "/admin/report-recipients", label: "Destinatários de Relatórios", roles: ["owner", "admin"] },
  // Auditor também precisa ver a trilha de auditoria — é o papel de
  // leitura/compliance do RBAC (mesmo critério de analytics.py).
  { to: "/admin/audit-log", label: "Logs de Auditoria", roles: ["owner", "admin", "auditor"] },
];

export function Sidebar() {
  const { user } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));
  const visibleAdminItems = ADMIN_NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  function renderItem(item: NavItem) {
    return (
      <li key={item.to}>
        <NavLink
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            `relative block rounded-sm py-2 pl-3.5 pr-3 text-sm transition-colors ${
              isActive
                ? "bg-canvas-raised text-ink before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-accent-line before:content-['']"
                : "text-ink-muted hover:bg-canvas-raised/60 hover:text-ink"
            }`
          }
        >
          {item.label}
        </NavLink>
      </li>
    );
  }

  return (
    <nav className="w-56 shrink-0 border-r border-border-hairline bg-canvas-surface/80 px-3 py-5 shadow-elevated backdrop-blur-sm">
      <ul className="space-y-0.5">{visibleItems.map(renderItem)}</ul>

      {visibleAdminItems.length > 0 && (
        <>
          <p className="mb-1.5 mt-6 px-3.5 text-2xs font-medium uppercase tracking-premium text-ink-faint">Administração</p>
          <ul className="space-y-0.5">{visibleAdminItems.map(renderItem)}</ul>
        </>
      )}
    </nav>
  );
}
