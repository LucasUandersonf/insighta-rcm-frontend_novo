import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCompleteOnboarding, useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import { ACCOUNT_TOUR_ID, ADMIN_NAV_ITEMS, NAV_ITEMS, tourTargetFor } from "@/lib/navigation";
import { OnboardingTour, type TourStep } from "@/components/onboarding/OnboardingTour";
import type { UserRole } from "@/lib/types";

/**
 * Auditoria de UX (UX-12): o tour era de 10 passos sobre telas ainda
 * vazias, e os passos de itens dentro de "Módulos" destacavam o botão
 * fechado. Agora é curto e orientado à primeira tarefa — importar,
 * conferir, ver o primeiro resultado — e só aponta para itens visíveis na
 * barra (placement "primary"); os demais módulos são citados no fim.
 */
const TASK_STEPS: { to: string; title: string; description: string }[] = [
  {
    to: "/importar",
    title: "1. Importe sua primeira planilha",
    description:
      "Em Importar dados, envie a planilha de faturamento ou de agenda do jeito que sai do seu sistema. Convênios novos são cadastrados sozinhos; o que precisar de ajuste aparece em “Linhas para corrigir”.",
  },
  {
    to: "/",
    title: "2. Confira o resultado",
    description: "O Início mostra o resumo do dia e, enquanto faltar algo, a lista do que ainda precisa ser importado ou configurado.",
  },
  {
    to: "/decisao",
    title: "3. Veja o primeiro insight",
    description: "Na Sala de Comando ficam os alertas com valor em R$ e a ação sugerida — do que mais custa dinheiro para o que menos custa.",
  },
  {
    to: "/consultas",
    title: "Consultas",
    description: "Busque o paciente pelo nome ou CPF e veja as consultas dele, com o risco de falta de cada uma.",
  },
];

const ADMIN_STEP = {
  title: "O que falta configurar",
  description: "Saúde da conta, no menu da sua foto, lista o que falta para os números ficarem completos — convênios, tabelas de preço, equipe — com o atalho para resolver.",
};

function isVisibleFor(role: UserRole | undefined, roles: UserRole[] | undefined): boolean {
  return !roles || (!!role && roles.includes(role));
}

/** Monta os passos a partir da MESMA navegação que o usuário vê — um item
 * escondido pelo papel dele nunca vira passo. */
function useTourSteps(): TourStep[] {
  const { user } = useAuth();

  return useMemo(() => {
    const visible = NAV_ITEMS.filter((item) => item.placement === "primary" && isVisibleFor(user?.role, item.roles));
    const canImport = visible.some((item) => item.to === "/importar");
    const steps: TourStep[] = [
      {
        title: "Bem-vindo ao Insighta",
        description: canImport
          ? "Vamos importar sua primeira planilha e ver o primeiro resultado — leva 3 minutos. Dá para pular e rever depois pela Central de Ajuda."
          : "Um tour curto pelo que você vai usar no dia a dia. Dá para pular e rever depois pela Central de Ajuda.",
      },
    ];

    for (const task of TASK_STEPS) {
      // Consultas só entra no tour de quem não importa dados (recepção).
      if (task.to === "/consultas" && canImport) continue;
      const item = visible.find((i) => i.to === task.to);
      if (!item) continue;
      steps.push({ targetSelector: `[data-tour-id="${tourTargetFor(item)}"]`, title: task.title, description: task.description });
    }

    if (ADMIN_NAV_ITEMS.some((item) => item.to === "/admin/saude-da-conta" && isVisibleFor(user?.role, item.roles))) {
      steps.push({ targetSelector: `[data-tour-id="${ACCOUNT_TOUR_ID}"]`, ...ADMIN_STEP });
    }

    steps.push({
      title: "Pronto!",
      description:
        "Os outros módulos (Fila de correção, Recurso de glosa, Convênios e contratos e mais) ficam em “Módulos”, na barra de cima. Para rever este tour, abra a Central de Ajuda no menu da sua foto.",
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
