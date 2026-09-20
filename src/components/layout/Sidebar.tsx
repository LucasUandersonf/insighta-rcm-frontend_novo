import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  FileText,
  Gauge,
  Home,
  Hourglass,
  LayoutDashboard,
  Layers,
  ListChecks,
  Megaphone,
  Network,
  Plug,
  Receipt,
  ScrollText,
  Send,
  ShieldAlert,
  UploadCloud,
  UserRound,
  Users,
  Wallet,
  X,
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
// Exportados para o tour de boas-vindas guiado (ver
// OnboardingTourContext.tsx) reaproveitar a MESMA lista e o MESMO filtro
// de papel — assim um item escondido para um papel também não aparece
// no tour, sem duplicar a régua de RBAC visual num segundo lugar.
export const NAV_ITEMS: NavItem[] = [
  // Sala de Comando (Dashboards de Decisão) — dado estratégico/financeiro
  // agregado, mesmo critério de RBAC do backend em analytics.py: fora do
  // alcance de "atendimento" (recepção).
  // Home estilo Jarvis (Roadmap "Rumo à Nota 9", Fase 1) — nova primeira
  // tela, sem RBAC de propósito: mesma visibilidade que "/" sempre teve.
  { to: "/", label: "Início", icon: Home },
  { to: "/decisao", label: "Sala de Comando", icon: Gauge, roles: ["owner", "admin", "financeiro", "auditor"] },
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/appointments", label: "Consultas", icon: CalendarCheck },
  // Ficha do Paciente (Roadmap "Rumo à Nota 9", Fase 4) — mesmo RBAC de
  // GET /patients/search (todo papel, sem "atendimento" de fora — é o
  // papel que mais precisa disto no dia a dia da recepção).
  { to: "/pacientes", label: "Ficha do paciente", icon: UserRound },
  // Épico F3.2 do Plano Diretor ("Consolidação multi-unidade") — mesmo
  // RBAC de Sala de Comando acima (dado financeiro/estratégico
  // agregado). Sempre visível a esses papéis, mesmo pra clínica avulsa
  // (organization_id NULL) — a própria página mostra o estado honesto
  // "não faz parte de um grupo", nunca escondida como se fosse um erro.
  { to: "/consolidado", label: "Consolidado", icon: Network, roles: ["owner", "admin", "financeiro", "auditor"] },
  // Onda 5 do Plano de Ação, item 16 — mesmo RBAC amplo de /appointments
  // (rotina de recepção, leitura aberta a financeiro/auditor).
  { to: "/waitlist", label: "Lista de espera", icon: Hourglass },
  // Épico F1.3 do Plano Diretor: aberto a QUALQUER papel (sem `roles`
  // aqui, de propósito) — mesmo RBAC de GET /insight-outcomes/mine.
  { to: "/meus-insights", label: "Meus insights", icon: ClipboardList },
  // Configuração da grade semanal que alimenta Agenda & Capacidade — não
  // é o CRUD operacional de Profissionais removido no reposicionamento
  // de produto (ver App.tsx); mesmo RBAC de ação administrativa restrita
  // usado em /upload e /contracts.
  { to: "/professionals", label: "Profissionais & Agenda", icon: CalendarClock, roles: ["owner", "admin"] },
  // Ação de escrita — mesmo RBAC do backend em ingestion.py/_CAN_MANAGE
  // e contracts.py/_CAN_WRITE (owner/admin/financeiro); sem auditor.
  { to: "/upload", label: "Central de upload", icon: UploadCloud, roles: ["owner", "admin", "financeiro"] },
  // Destino do próprio toast de sucesso da Central de Upload quando um
  // arquivo tem linha rejeitada — mesmo RBAC de /upload.
  { to: "/setup", label: "Setup de importação", icon: ListChecks, roles: ["owner", "admin", "financeiro"] },
  // Convênios/Contratos: dado financeiro sensível (tabela de repasse) —
  // mesmo RBAC do backend em contracts.py, fora do alcance de "atendimento".
  { to: "/contracts", label: "Convênios e contratos", icon: FileText, roles: ["owner", "admin", "financeiro", "auditor"] },
  // Mesmo RBAC dos outros itens financeiros — recurso de glosa é dado
  // financeiro/jurídico sensível, fora do alcance de "atendimento".
  { to: "/denial-appeals", label: "Recurso de glosa", icon: ShieldAlert, roles: ["owner", "admin", "financeiro", "auditor"] },
  // Registrar pagamento recebido + Guias TISS — mesmo RBAC de /upload
  // (ação de escrita financeira, sem auditor).
  { to: "/faturamento", label: "Faturamento & guias", icon: Wallet, roles: ["owner", "admin", "financeiro"] },
  // Gestão de Lotes (agrupa guias antes de virar fatura) — mesmo RBAC
  // do backend em lotes.py/_CAN_READ, igual a /denial-appeals acima.
  { to: "/lotes", label: "Lotes de faturamento", icon: Layers, roles: ["owner", "admin", "financeiro", "auditor"] },
  // Épico F3.1 do Plano Diretor ("Módulo de custos e margem real") —
  // mesmo RBAC de /lotes acima.
  { to: "/custos", label: "Custos", icon: Receipt, roles: ["owner", "admin", "financeiro", "auditor"] },
  // Achado do Dossiê Insighta RCM — Onda 2 do Plano de Ação: mesmo RBAC
  // de /custos acima.
  { to: "/marketing-spend", label: "Gasto de marketing", icon: Megaphone, roles: ["owner", "admin", "financeiro", "auditor"] },
];

// Administração da plataforma — só owner/admin (mesmo RBAC do backend
// para /users, /tenant e /integrations). Renderizada como grupo à parte
// na navegação para não misturar "operação da clínica" com
// "administração da conta SaaS".
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: "/admin/users", label: "Usuários", icon: Users, roles: ["owner", "admin"] },
  { to: "/admin/integrations", label: "Integrações e webhooks", icon: Plug, roles: ["owner", "admin"] },
  { to: "/admin/tenant", label: "Minha clínica", icon: Building2, roles: ["owner", "admin"] },
  { to: "/admin/report-recipients", label: "Destinatários de relatórios", icon: Send, roles: ["owner", "admin"] },
  // Auditor também precisa ver a trilha de auditoria — é o papel de
  // leitura/compliance do RBAC (mesmo critério de analytics.py).
  { to: "/admin/audit-log", label: "Logs de auditoria", icon: ScrollText, roles: ["owner", "admin", "auditor"] },
];

interface SidebarProps {
  /** Achado da Auditoria de Prontidão v1: a sidebar era fixa (w-60, sem
   * breakpoint nenhum) — quebrava em tablet, o dispositivo mais comum na
   * recepção de clínica. Abaixo de `xl` (1280px — cobre tablet em
   * retrato E paisagem, não só celular) ela vira um drawer fora do fluxo
   * normal, escondido por padrão e controlado pelo hambúrguer no TopBar
   * (ver AppShell.tsx, dono do estado). Em `xl` pra cima, sempre visível
   * — comportamento idêntico ao de sempre, essas duas props são no-op
   * (por isso ambas são opcionais: standalone, como em Sidebar.test.tsx,
   * continua renderizando igual). */
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ isOpenOnMobile = false, onCloseMobile }: SidebarProps) {
  const { user } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));
  const visibleAdminItems = ADMIN_NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  function renderItem(item: NavItem, layoutGroup: string) {
    const Icon = item.icon;
    return (
      <li key={item.to}>
        <NavLink
          to={item.to}
          // Âncora do tour de boas-vindas guiado (ver OnboardingTour.tsx) —
          // reaproveita o próprio `to` como chave, não precisa de um id
          // separado por item.
          data-tour-id={item.to}
          // No drawer mobile/tablet, navegar fecha o menu sozinho — sem
          // isso o usuário teria que tocar no X toda vez, um passo extra
          // que ninguém espera num menu de navegação. Em xl+ (sidebar
          // estática) onCloseMobile é undefined, então isto é um no-op.
          onClick={onCloseMobile}
          className={({ isActive }) =>
            cn(
              "relative flex items-center gap-2.5 rounded-sm py-2 pl-3 pr-3 text-sm transition-colors",
              isActive ? "text-ink" : "text-ink-muted hover:bg-canvas-raised/60 hover:text-ink"
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId={`sidebar-active-${layoutGroup}`}
                  className="absolute inset-0 rounded-sm border border-accent/25 bg-canvas-raised before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent-line before:content-['']"
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
    <>
      {/* Backdrop do drawer mobile/tablet — só existe abaixo de `xl` e só
          quando aberto; fecha ao tocar fora, mesmo padrão de Modal.tsx. */}
      {isOpenOnMobile && (
        <div
          data-testid="mobile-nav-backdrop"
          className="fixed inset-0 z-40 bg-canvas/70 backdrop-blur-sm xl:hidden"
          aria-hidden="true"
          onClick={onCloseMobile}
        />
      )}
      <nav
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 shrink-0 overflow-y-auto border-r border-border-hairline bg-glass px-3 py-5 backdrop-blur-xl transition-transform duration-200 ease-out",
          "xl:relative xl:inset-y-auto xl:z-auto xl:w-60 xl:translate-x-0 xl:transition-none",
          isOpenOnMobile ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-2 flex items-center justify-between px-1 xl:hidden">
          <span className="font-serif text-sm font-semibold tracking-premium text-ink">Insighta RCM</span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar menu"
            title="Fechar menu"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border-subtle text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
          >
            <X aria-hidden size={16} strokeWidth={2} />
          </button>
        </div>

        <ul className="space-y-0.5">{visibleItems.map((item) => renderItem(item, "main"))}</ul>

        {visibleAdminItems.length > 0 && (
          <>
            <p className="mb-1.5 mt-6 px-3 text-2xs font-medium uppercase tracking-[0.06em] text-ink-faint">Administração</p>
            <ul className="space-y-0.5">{visibleAdminItems.map((item) => renderItem(item, "admin"))}</ul>
          </>
        )}
      </nav>
    </>
  );
}
