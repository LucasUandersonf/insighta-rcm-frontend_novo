import type { UserRole } from "@/lib/types";

/** Auditoria de UX: um nome só para cada papel em todo o app (antes o topo
 * dizia “Proprietário(a)” e a tela de usuários “Diretoria (owner)”). */
export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Proprietário(a)",
  admin: "Administrador(a)",
  financeiro: "Financeiro",
  atendimento: "Atendimento",
  auditor: "Auditor(a)",
};

/** UX-26: o que cada papel vê, para escolher sem adivinhar. */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: "Tudo, inclusive assinatura e exclusão de dados.",
  admin: "Tudo, menos assinatura: usuários, importação, convênios e relatórios.",
  financeiro: "Faturamento, glosas, lotes, faturas, convênios e importação. Não gerencia usuários.",
  atendimento: "Consultas, pacientes e lista de espera. Não vê faturamento nem relatórios.",
  auditor: "Vê relatórios, faturamento e a trilha de auditoria, sem alterar nada.",
};
