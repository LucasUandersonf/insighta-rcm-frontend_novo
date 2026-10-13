import type { UserRole } from "@/lib/types";

/**
 * Os passos do começo, em um lugar só (UX2-20): os cartões "Passo 1/2/3" da
 * Home e o tour usam esta mesma lista, então a numeração nunca diverge.
 * Passos de administração só aparecem para quem pode abri-los.
 */
export interface OnboardingStep {
  title: string;
  text: string;
  to: string;
  adminOnly?: boolean;
}

const ALL_STEPS: OnboardingStep[] = [
  { title: "Importe os dados", text: "Envie a planilha do seu sistema em Importar dados — ou baixe o modelo de cada área.", to: "/importar" },
  {
    title: "Defina os coordenadores",
    text: "Quem cuida de Agendamento, Faturamento, Estoque e Assistencial recebe os alertas do setor. Convide a pessoa em Usuários.",
    to: "/admin/usuarios",
    adminOnly: true,
  },
  {
    title: "Confira a saúde da conta",
    text: "Contratos, meta, grade dos profissionais e o que mais faltar — com o atalho para resolver.",
    to: "/admin/saude-da-conta",
    adminOnly: true,
  },
];

export function onboardingStepsFor(role: UserRole | undefined): OnboardingStep[] {
  const isAdmin = role === "owner" || role === "admin";
  return ALL_STEPS.filter((step) => !step.adminOnly || isAdmin);
}
