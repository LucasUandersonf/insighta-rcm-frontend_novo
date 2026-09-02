import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2,
  CalendarCheck,
  FileText,
  Gauge,
  LayoutDashboard,
  Plug,
  ScrollText,
  Send,
  ShieldAlert,
  UploadCloud,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { CurrentUser } from "@/lib/types";
import { cn } from "@/lib/cn";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
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
  { to: "/decisao", label: "Sala de Comando", icon: Gauge, roles: ["owner", "admin", "financeiro", "auditor"] },
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/appointments", label: "Consultas", icon: CalendarCheck },
  // Ação de escrita — mesmo RBAC do backend em ingestion.py/_CAN_MANAGE
  // e contracts.py/_CAN_WRITE (owner/admin/financeiro); sem auditor.
  { to: "/upload", label: "Central de Upload", icon: UploadCloud, roles: ["owner", "admin", "financeiro"] },
  // Convênios/Contratos: dado financeiro sensível (tabela de repasse) —
  // mesmo RBAC do backend em contracts.py, fora do alcance de "atendimento".
  { to: "/contracts", label: "Convênios & Contratos", icon: FileText, roles: ["owner", "admin", "financeiro", "auditor"] },
  // Mesmo RBAC dos outros itens financeiros — recurso de glosa é dado
  // financeiro/jurídico sensível, fora do alcance de "atendimento".
  { to: "/denial-appeals", label: "Recurso de Glosa", icon: ShieldAlert, roles: ["owner", "admin", "financeiro", "auditor"] },
];

// Administração da plataforma — só owner/admin (mesmo RBAC do backend
// para /users, /tenant e /integrations). Renderizada como grupo à parte
// na navegação para não misturar "operação da clínica" com
// "administração da conta SaaS".
const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: "/admin/users", label: "Usuários", icon: Users, roles: ["owner", "admin"] },
  { to: "/admin/integrations", label: "Integrações & Webhooks", icon: Plug, roles: ["owner", "admin"] },
  { to: "/admin/tenant", label: "Minha Clínica", icon: Building2, roles: ["owner", "admin"] },
  { to: "/admin/report-recipients", label: "Destinatários de Relatórios", icon: Send, roles: ["owner", "admin"] },
  // Auditor também precisa ver a trilha de auditoria — é o papel de
  // leitura/compliance do RBAC (mesmo critério de analytics.py).
  { to: "/admin/audit-log", label: "Logs de Auditoria", icon: ScrollText, roles: ["owner", "admin", "auditor"] },
];

export function Sidebar() {
  const { user } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));
  const visibleAdminItems = ADMIN_NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  function renderItem(item: NavItem, layoutGroup: string) {
    const Icon = item.icon;
    return (
      <li key={item.to}>
        <NavLink
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            cn(
              "relative flex items-center gap-2.5 rounded-md py-2 pl-3 pr-3 text-sm transition-colors",
              isActive ? "text-ink" : "text-ink-muted hover:bg-canvas-raised/60 hover:text-ink"
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId={`sidebar-active-${layoutGroup}`}
                  className="absolute inset-0 rounded-md border border-accent/25 bg-canvas-raised before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent-line before:content-['']"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <Icon aria-hidden size={15} strokeWidth={2} className="relative shrink-0" />
              <span className="relative">{item.label}</span>
            </>
          )}
        </NavLink>
      </li>
    );
  }

  return (
    <nav className="w-60 shrink-0 border-r border-border-hairline bg-canvas-surface/70 px-3 py-5 backdrop-blur-sm">
      <ul className="space-y-0.5">{visibleItems.map((item) => renderItem(item, "main"))}</ul>

      {visibleAdminItems.length > 0 && (
        <>
          <p className="mb-1.5 mt-6 px-3 text-2xs font-medium uppercase tracking-premium text-ink-faint">Administração</p>
          <ul className="space-y-0.5">{visibleAdminItems.map((item) => renderItem(item, "admin"))}</ul>
        </>
      )}
    </nav>
  );
}
