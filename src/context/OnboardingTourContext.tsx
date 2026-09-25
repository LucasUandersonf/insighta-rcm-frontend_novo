import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCompleteOnboarding, useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import { ACCOUNT_TOUR_ID, ADMIN_NAV_ITEMS, NAV_ITEMS, tourTargetFor } from "@/lib/navigation";
import { OnboardingTour, type TourStep } from "@/components/onboarding/OnboardingTour";
import type { UserRole } from "@/lib/types";

/**
 * Conteúdo de cada passo, por rota — mantido À PARTE de NAV_ITEMS (que só
 * sabe rótulo curto + ícone de menu) porque a explicação do tour precisa
 * de mais contexto do que cabe num item de barra lateral. Uma rota sem
 * entrada aqui simplesmente não vira passo — é assim que /professionals
 * (RBAC restrito e menos central para o primeiro contato) fica de fora
 * do tour sem precisar de um flag "incluirNoTour" espalhado por NAV_ITEMS.
 */
const STEP_CONTENT: Partial<Record<string, { title: string; description: string }>> = {
  "/": {
    title: "Início",
    description: "Um resumo escrito por IA do que importa hoje, com até 3 prioridades — por onde começar, sem precisar ler o painel inteiro.",
  },
  "/equipe": {
    title: "Equipe",
    description: "Você atribui cada problema ao coordenador do setor e acompanha aqui até a resolução — com o placar de metas de cada um.",
  },
  "/decisao": {
    title: "Sala de Comando",
    description: "Hoje, Faturamento, Agenda, Estoque e Prontuário — o que está custando dinheiro em cada área e o que fazer primeiro.",
  },
  "/upload": {
    title: "Importar dados",
    description: "É por aqui que entram os dados do seu ERP/sistema de gestão: planilhas de agenda, faturamento e convênios.",
  },
  "/appointments": {
    title: "Consultas",
    description: "A agenda da clínica, já com o risco de falta calculado para cada paciente a partir do histórico dele.",
  },
  "/pacientes": {
    title: "Ficha do paciente",
    description: "Busque por nome ou CPF e veja o histórico completo: agendamentos, atendimentos e faturamentos, tudo numa tela.",
  },
  "/contracts": {
    title: "Convênios e contratos",
    description: "As tabelas de preço por convênio — é a régua que o motor de glosa usa para conferir cada faturamento importado.",
  },
  "/denial-appeals": {
    title: "Recurso de glosa",
    description: "Acompanhe e conteste faturamentos glosados pelo convênio, com prazo de resposta calculado automaticamente.",
  },
};

const ADMIN_STEP = {
  title: "Administração",
  description: "Usuários, integrações, dados da clínica e log de auditoria ficam no menu da sua foto de perfil — configuração da conta, não o uso do dia a dia.",
};

function isVisibleFor(role: UserRole | undefined, roles: UserRole[] | undefined): boolean {
  return !roles || (!!role && roles.includes(role));
}

/** Monta os passos do tour a partir da MESMA navegação real que o
 * usuário vê — um item escondido pelo RBAC do seu papel nunca vira um
 * passo apontando para algo que ele não pode acessar. */
function useTourSteps(): TourStep[] {
  const { user } = useAuth();

  return useMemo(() => {
    const steps: TourStep[] = [
      {
        title: "Bem-vindo ao Insighta",
        description:
          "Um tour rápido pelos módulos principais — menos de um minuto. Dá para pular a qualquer momento e reabrir depois pela Central de Ajuda.",
      },
    ];

    for (const item of NAV_ITEMS) {
      if (!isVisibleFor(user?.role, item.roles)) continue;
      const content = STEP_CONTENT[item.to];
      if (!content) continue;
      steps.push({ targetSelector: `[data-tour-id="${tourTargetFor(item)}"]`, ...content });
    }

    const visibleAdminItem = ADMIN_NAV_ITEMS.find((item) => isVisibleFor(user?.role, item.roles));
    if (visibleAdminItem) {
      steps.push({ targetSelector: `[data-tour-id="${ACCOUNT_TOUR_ID}"]`, ...ADMIN_STEP });
    }

    steps.push({
      title: "Pronto!",
      description: "Você pode rever este tour quando quiser pela Central de Ajuda, no menu da sua foto de perfil (canto superior direito).",
    });

    return steps;
  }, [user?.role]);
}

interface OnboardingTourContextValue {
  /** Reabre o tour manualmente (ver "Rever tour" na Central de Ajuda) —
   * independente de onboarding_completed_at já estar preenchido. */
  startTour: () => void;
}

const OnboardingTourContext = createContext<OnboardingTourContextValue | undefined>(undefined);

/**
 * Só existe DENTRO de rota autenticada (ver AppShell.tsx) — precisa de
 * `useAuth`/`useCurrentUserProfile` resolvidos, nada aqui faz sentido
 * antes do login.
 *
 * DECISÃO — abre sozinho UMA vez por usuário (onboarding_completed_at
 * null), nunca de novo depois
 * -------------------------------------------------------------------
 * `hasAutoOpened` (estado local, não persistido) existe só para não
 * reabrir o tour sozinho de novo DENTRO da mesma sessão se o perfil for
 * refetchado antes do POST de conclusão terminar — a persistência de
 * verdade ("já viu, nunca mais abra sozinho") é o próprio
 * onboarding_completed_at no banco, refletido aqui só depois que
 * useCompleteOnboarding invalida o cache de ["users","me"].
 */
export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const { data: profile } = useCurrentUserProfile();
  const completeOnboarding = useCompleteOnboarding();
  const steps = useTourSteps();
  const [isOpen, setIsOpen] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  useEffect(() => {
    if (hasAutoOpened || !profile) return;
    if (profile.onboarding_completed_at === null) {
      setIsOpen(true);
      setHasAutoOpened(true);
    }
  }, [profile, hasAutoOpened]);

  function handleFinish() {
    setIsOpen(false);
    // "Pular" e "concluir" gravam do mesmo jeito — a intenção do produto
    // é só "não mostrar de novo sozinho", não medir quem passou por
    // cada passo (ver DECISÃO em app/sql/031_user_onboarding.sql).
    completeOnboarding.mutate();
  }

  const value = useMemo<OnboardingTourContextValue>(() => ({ startTour: () => setIsOpen(true) }), []);

  return (
    <OnboardingTourContext.Provider value={value}>
      {children}
      <OnboardingTour isOpen={isOpen} steps={steps} onFinish={handleFinish} />
    </OnboardingTourContext.Provider>
  );
}

export function useOnboardingTour(): OnboardingTourContextValue {
  const ctx = useContext(OnboardingTourContext);
  if (!ctx) throw new Error("useOnboardingTour precisa estar dentro de OnboardingTourProvider");
  return ctx;
}
