import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCompleteOnboarding, useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import { ACCOUNT_TOUR_ID, ASK_TOUR_ID, NAV_ITEMS, tourTargetFor } from "@/lib/navigation";
import { OnboardingTour, type TourStep } from "@/components/onboarding/OnboardingTour";
import type { UserRole } from "@/lib/types";

/**
 * Auditoria de UX (UX-12): o tour era de 10 passos sobre telas ainda
 * vazias. Para quem não importa dados, ele aponta só para o que a pessoa
 * usa no dia a dia (itens visíveis na barra).
 */
const TOUR_STEPS_WITHOUT_IMPORT: { to: string; title: string; description: string }[] = [
  {
    to: "/",
    title: "Início",
    description: "O resumo do dia da clínica, com o que merece atenção primeiro.",
  },
  {
    to: "/consultas",
    title: "Consultas",
    description: "Busque o paciente pelo nome ou CPF e veja as consultas dele, com o risco de falta de cada uma.",
  },
];

function isVisibleFor(role: UserRole | undefined, roles: UserRole[] | undefined): boolean {
  return !roles || (!!role && roles.includes(role));
}

/** Monta os passos a partir da MESMA navegação que o usuário vê — um item
 * escondido pelo papel dele nunca vira passo.
 *
 * UX3-20: quem importa dados vê onde ficam Importar, Pergunte e o menu da
 * foto (os passos já estão nos cartões do Início). Quem não importa
 * (recepção, auditoria) faz um tour curto pelo que usa. */
function useTourSteps(): TourStep[] {
  const { user } = useAuth();

  return useMemo(() => {
    const visible = NAV_ITEMS.filter((item) => item.placement === "primary" && isVisibleFor(user?.role, item.roles));
    const importItem = visible.find((item) => item.to === "/importar");
    if (importItem) {
      // UX3-20: o tour repetia os cartões do Início. Agora ele mostra ONDE
      // ficam as coisas (os passos já estão na Home): importar, perguntar e
      // o menu da foto.
      const canAsk = !!user?.role && ["owner", "admin", "financeiro", "auditor"].includes(user.role);
      const tips: TourStep[] = [
        {
          targetSelector: `[data-tour-id="${tourTargetFor(importItem)}"]`,
          title: "Importar dados",
          description: "Bem-vindo ao Insighta! É aqui que entram as planilhas do seu sistema (faturamento, agenda). Os primeiros passos estão no Início.",
        },
      ];
      if (canAsk) {
        tips.push({
          targetSelector: `[data-tour-id="${ASK_TOUR_ID}"]`,
          title: "Pergunte ao Insighta",
          description: "Pergunte em português, como numa conversa: “qual convênio mais glosa?”, “quanto faturei em setembro?”.",
        });
      }
      tips.push({
        targetSelector: `[data-tour-id="${ACCOUNT_TOUR_ID}"]`,
        title: "Menu da sua foto",
        description: "Minha clínica, usuários, convênios e a Central de Ajuda (onde dá para rever este tour).",
      });
      return tips;
    }

    const steps: TourStep[] = [];
    for (const task of TOUR_STEPS_WITHOUT_IMPORT) {
      const item = visible.find((i) => i.to === task.to);
      if (!item) continue;
      steps.push({ targetSelector: `[data-tour-id="${tourTargetFor(item)}"]`, title: task.title, description: task.description });
    }
    steps.push({
      title: "Pronto!",
      description:
        "Os outros módulos ficam em “Módulos”, na barra de cima. Para rever este tour, abra a Central de Ajuda no menu da sua foto.",
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
