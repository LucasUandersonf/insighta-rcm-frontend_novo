import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";
import { FEATURE_PITCH, usePlan, type PlanFeature } from "@/lib/plan";

/**
 * Funcionalidade do Pro vista por uma clínica no Basic: em vez de um erro
 * ou de uma tela vazia, uma prévia com o que ela faz e o convite para o
 * Pro. A tela de verdade nem monta (as consultas dela não são feitas).
 */
export function PlanLockCard({ feature, compact = false }: { feature: PlanFeature; compact?: boolean }) {
  const pitch = FEATURE_PITCH[feature];
  return (
    <section
      aria-label={`${pitch.title}: disponível no plano Pro`}
      className={
        "flex flex-col gap-3 rounded-xl border border-dashed border-accent/40 bg-accent-bg text-left " +
        (compact ? "p-4" : "p-6")
      }
    >
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wide text-white">
        <Lock aria-hidden size={11} /> Plano Pro
      </span>
      <div>
        <h3 className="text-sm font-semibold text-ink">{pitch.title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{pitch.text}</p>
      </div>
      <Link
        to="/assinatura"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-accent underline-offset-2 hover:underline"
      >
        <Sparkles aria-hidden size={14} /> Ver o plano Pro
      </Link>
    </section>
  );
}

export function PlanGate({ feature, compact, children }: { feature: PlanFeature; compact?: boolean; children: ReactNode }) {
  const { has } = usePlan();
  if (!has(feature)) return <PlanLockCard feature={feature} compact={compact} />;
  return <>{children}</>;
}

/** Envolve um painel inteiro: no Basic ele vira a prévia do Pro. */
export function withPlanGate<P extends object>(Component: ComponentType<P>, feature: PlanFeature, compact = true) {
  function Gated(props: P) {
    return (
      <PlanGate feature={feature} compact={compact}>
        <Component {...props} />
      </PlanGate>
    );
  }
  Gated.displayName = `withPlanGate(${Component.displayName ?? Component.name ?? "Component"})`;
  return Gated;
}

/** Página inteira do Pro (Lista de espera, Custos, Integrações...). */
export function PlanGatePage({ feature, children }: { feature: PlanFeature; children: ReactNode }) {
  const { has } = usePlan();
  if (has(feature)) return <>{children}</>;
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <PlanLockCard feature={feature} />
    </div>
  );
}
