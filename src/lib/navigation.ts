import {
  Building2,
  HeartPulse,
  Clock,
  CalendarCheck,
  Gauge,
  Home,
  Inbox,
  ListOrdered,
  Plug,
  ScrollText,
  Send,
  ShieldAlert,
  UserRound,
  Users,
  UsersRound,
  Receipt,
  Layers,
  FileWarning,
  Handshake,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import type { CurrentUser } from "@/lib/types";
import type { TeamSector } from "@/lib/team";

/**
 * DECISÃO — Redesign 2026 ("sem sidebar"): a navegação deixou de ser uma
 * barra lateral e virou uma barra superior em duas linhas (ver canvas de
 * design "Insighta RCM — Redesign 2026"). Esta é a fonte ÚNICA dos itens:
 *
 *   - `placement: "primary"` -> link direto na segunda linha da TopBar;
 *   - `placement: "modules"` -> agrupado no dropdown "Módulos" (antiga
 *     sidebar), em `MODULE_GROUPS` abaixo;
 *   - `ADMIN_NAV_ITEMS` -> exclusivamente no menu do avatar do usuário.
 *
 * O RBAC continua espelhando o backend (ver require_role() em cada
 * endpoint) — um item só aparece pra quem o backend de fato deixaria
 * usar. Esconder não é a camada de segurança; é só não oferecer um botão
 * que vai dar 403. O tour de boas-vindas (OnboardingTourContext.tsx)
 * reaproveita estas MESMAS listas e o MESMO filtro de papel.
 */
export type UserRole = CurrentUser["role"];

export type ModuleGroupId = "faturamento" | "operacao" | "custos" | "dados";

export interface NavItem {
  to: string;
  label: string;
  /** Só os itens da linha principal e do menu do avatar têm ícone. */
  icon?: LucideIcon;
  /** Linha de apoio mostrada sob o rótulo dentro do dropdown "Módulos". */
  description?: string;
  /** Papéis que podem ver este item — omitido = todo mundo autenticado vê. */
  roles?: UserRole[];
  placement: "primary" | "modules";
  group?: ModuleGroupId;
  /** Outras rotas que contam como "dentro" deste item (ex.: /setup em Importar dados). */
  matches?: string[];
  /** Só faz sentido para grupo com mais de uma unidade. */
  requiresNetwork?: boolean;
}

const LEADERSHIP: UserRole[] = ["owner", "admin", "financeiro", "auditor"];
const FINANCE_WRITE: UserRole[] = ["owner", "admin", "financeiro"];
const ADMINS: UserRole[] = ["owner", "admin"];

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Início", icon: Home, placement: "primary" },
  { to: "/decisao", label: "Sala de Comando", icon: Gauge, roles: LEADERSHIP, placement: "primary" },
  // Equipe (Redesign 2026): o gestor acompanha o que atribuiu aos
  // coordenadores. "Meus insights" saiu da barra — virou "Minhas
  // demandas", a Home do coordenador (ver COORDINATOR_NAV abaixo).
  { to: "/equipe", label: "Equipe", icon: UsersRound, roles: ["owner", "admin", "auditor"], placement: "primary" },
  // Painel saiu (virou a Fila de correção, em Módulos → Faturamento) e
  // Pacientes saiu da barra do gestor — é ferramenta de quem atende
  // (coordenação de Agendamento/Assistencial, ver SECTOR_NAV).
  { to: "/appointments", label: "Consultas", icon: CalendarCheck, placement: "primary" },

  // Faturamento
  // "Faturamento & guias" (lançamento manual) ficou só na barra do
  // coordenador de Faturamento, como exceção à importação.
  { to: "/fila-correcao", label: "Fila de correção", description: "Guias com risco de glosa, antes do envio", roles: FINANCE_WRITE, placement: "modules", group: "faturamento" },
  { to: "/lotes", label: "Lotes de faturamento", description: "Agrupar guias antes de virar fatura", roles: LEADERSHIP, placement: "modules", group: "faturamento" },
  { to: "/denial-appeals", label: "Recurso de glosa", description: "Contestar recusas dentro do prazo", roles: LEADERSHIP, placement: "modules", group: "faturamento" },
  { to: "/contracts", label: "Convênios e contratos", description: "Tabelas de repasse e vigências", roles: LEADERSHIP, placement: "modules", group: "faturamento" },

  // Agenda & operação
  { to: "/waitlist", label: "Lista de espera", description: "Encaixar pacientes nos horários vagos", placement: "modules", group: "operacao" },
  // Só aparece para grupo com mais de uma unidade (ver TopBar).
  { to: "/consolidado", label: "Consolidado da rede", description: "Visão multiunidade do grupo", roles: LEADERSHIP, placement: "modules", group: "operacao", requiresNetwork: true },

  // Custos & crescimento
  { to: "/custos", label: "Custos", description: "Margem real por procedimento", roles: LEADERSHIP, placement: "modules", group: "custos" },
  { to: "/marketing-spend", label: "Gasto de marketing", description: "Quanto cada canal traz de volta", roles: LEADERSHIP, placement: "modules", group: "custos" },

  // Dados
  // Upload + Setup eram dois módulos para uma tarefa só.
  { to: "/upload", label: "Importar dados", description: "Enviar arquivos, mapear e corrigir linhas rejeitadas", roles: FINANCE_WRITE, placement: "modules", group: "dados", matches: ["/setup"] },
];

export const MODULE_GROUPS: { id: ModuleGroupId; label: string }[] = [
  { id: "faturamento", label: "Faturamento" },
  { id: "operacao", label: "Agenda & operação" },
  { id: "custos", label: "Custos & crescimento" },
  { id: "dados", label: "Dados" },
];

/** Administração da conta SaaS — só no menu do avatar, nunca na barra. */
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: "/admin/tenant", label: "Minha clínica", icon: Building2, roles: ADMINS, placement: "modules" },
  { to: "/admin/saude-da-conta", label: "Saúde da conta", icon: HeartPulse, roles: ADMINS, placement: "modules" },
  { to: "/admin/users", label: "Usuários e permissões", icon: Users, roles: ADMINS, placement: "modules" },
  // Profissionais chegam pela importação; o que falta é só a grade
  // semanal (nenhum arquivo traz), que alimenta ocupação e horários vagos.
  { to: "/professionals", label: "Horários de atendimento", icon: Clock, roles: ADMINS, placement: "modules" },
  { to: "/admin/integrations", label: "Integrações e webhooks", icon: Plug, roles: ADMINS, placement: "modules" },
  { to: "/admin/report-recipients", label: "Destinatários de relatórios", icon: Send, roles: ADMINS, placement: "modules" },
  // Auditor também precisa ver a trilha de auditoria — papel de
  // leitura/compliance (mesmo critério de analytics.py).
  { to: "/admin/audit-log", label: "Logs de auditoria", icon: ScrollText, roles: ["owner", "admin", "auditor"], placement: "modules" },
];

/**
 * Equipe (Redesign 2026 — canvas "Coordenador"): o coordenador não vê a
 * visão geral do gestor. A barra dele é "Minhas demandas" + as telas do
 * PRÓPRIO setor, sem Sala de Comando, Painel nem o dropdown "Módulos".
 * O RBAC por papel continua valendo por cima (roles de cada item).
 */
const MY_DEMANDS: NavItem = { to: "/", label: "Minhas demandas", icon: Inbox, placement: "primary" };

const SECTOR_NAV: Record<TeamSector, NavItem[]> = {
  agendamento: [
    { to: "/appointments", label: "Consultas", icon: CalendarCheck, placement: "primary" },
    { to: "/pacientes", label: "Pacientes", icon: UserRound, placement: "primary" },
    { to: "/waitlist", label: "Lista de espera", icon: ListOrdered, placement: "primary" },
  ],
  faturamento: [
    { to: "/faturamento", label: "Faturamento", icon: Receipt, roles: FINANCE_WRITE, placement: "primary" },
    { to: "/fila-correcao", label: "Fila de correção", icon: ShieldAlert, roles: FINANCE_WRITE, placement: "primary" },
    { to: "/lotes", label: "Lotes", icon: Layers, roles: LEADERSHIP, placement: "primary" },
    { to: "/denial-appeals", label: "Recursos de glosa", icon: FileWarning, roles: LEADERSHIP, placement: "primary" },
    { to: "/contracts", label: "Convênios", icon: Handshake, roles: LEADERSHIP, placement: "primary" },
    { to: "/upload", label: "Importar dados", icon: UploadCloud, roles: FINANCE_WRITE, placement: "primary", matches: ["/setup"] },
  ],
  estoque: [{ to: "/upload", label: "Importar dados", icon: UploadCloud, roles: FINANCE_WRITE, placement: "primary", matches: ["/setup"] }],
  assistencial: [{ to: "/pacientes", label: "Pacientes", icon: UserRound, placement: "primary" }],
  gestao: [],
};

export function coordinatorNavItems(sectors: TeamSector[], role: UserRole | undefined): NavItem[] {
  const seen = new Set<string>();
  const items = [MY_DEMANDS, ...sectors.flatMap((s) => SECTOR_NAV[s])].filter((item) => {
    if (seen.has(item.to)) return false;
    seen.add(item.to);
    return true;
  });
  return visibleItems(items, role);
}

export function isVisibleFor(role: UserRole | undefined, roles: UserRole[] | undefined): boolean {
  return !roles || (!!role && roles.includes(role));
}

export function visibleItems(items: NavItem[], role: UserRole | undefined): NavItem[] {
  return items.filter((item) => isVisibleFor(role, item.roles));
}

/** Âncora do tour para um item: itens da linha principal têm o próprio
 * link visível; os que moram num dropdown apontam pro botão que o abre. */
export const MODULES_TOUR_ID = "nav-modules";
export const ACCOUNT_TOUR_ID = "nav-account";

export function tourTargetFor(item: NavItem): string {
  return item.placement === "primary" ? item.to : MODULES_TOUR_ID;
}
