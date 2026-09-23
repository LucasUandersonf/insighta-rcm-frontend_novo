import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import type { CheckoutDetail } from "@/lib/types";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

/**
 * Achado CRÍTICO da Auditoria de Prontidão v1 ("produto não se cobra
 * sozinho") — página de retorno do Checkout real do Stripe (ativa
 * quando STRIPE_SECRET_KEY está configurado no backend — ver DECISÃO
 * em app/services/stripe_payment_provider.py). Ao contrário de
 * MockCheckoutPage.tsx, esta tela NUNCA coleta dado de cartão — o
 * Stripe já cobrou o cliente na própria tela dele antes de redirecionar
 * pra cá. O único trabalho daqui é chamar POST .../confirm (mesmo
 * endpoint do fluxo mock — StripePaymentProvider.confirm_checkout
 * revalida com o próprio Stripe antes de ativar o plano, nunca confia
 * só no fato de o usuário ter voltado pra esta URL) e mostrar o
 * resultado.
 */
export function StripeCheckoutReturnPage() {
  const { checkoutId } = useParams<{ checkoutId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const wasCancelled = searchParams.get("cancelled") === "1";

  const { data: checkout, isLoading: isLoadingCheckout } = useQuery({
    queryKey: ["subscription-checkout", checkoutId],
    queryFn: () => apiClient.get<CheckoutDetail>(`/api/v1/subscription/checkout/${checkoutId}`),
    enabled: !!checkoutId,
    retry: false,
  });

  const confirmMutation = useMutation({
    mutationFn: () => apiClient.post<{ plan_tier: string }>(`/api/v1/subscription/checkout/${checkoutId}/confirm`, {}),
  });

  useEffect(() => {
    if (!wasCancelled && checkout?.status === "pending" && !confirmMutation.isPending && !confirmMutation.isSuccess && !confirmMutation.isError) {
      confirmMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wasCancelled, checkout?.status]);

  if (wasCancelled) {
    return (
      <AuthLayout headline="Checkout cancelado" subheadline="Nenhuma cobrança foi feita.">
        <div className="w-full max-w-sm rounded-xl border border-border-hairline bg-glass p-6 text-center shadow-elevated backdrop-blur-xl">
          <h1 className="text-lg font-semibold text-ink">Você saiu do checkout</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">Pode tentar de novo a qualquer momento em Minha Clínica.</p>
          <Button className="mt-4 w-full" onClick={() => navigate("/admin/tenant")}>
            Voltar para Minha Clínica
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (isLoadingCheckout || confirmMutation.isPending) {
    return (
      <AuthLayout headline="Confirmando pagamento" subheadline="Só um instante — estamos confirmando com o Stripe.">
        <div className="w-full max-w-sm rounded-xl border border-border-hairline bg-glass p-6 text-center shadow-elevated backdrop-blur-xl">
          <p className="text-sm text-ink-muted">Confirmando...</p>
        </div>
      </AuthLayout>
    );
  }

  if (!checkout) {
    return (
      <AuthLayout headline="Checkout não encontrado" subheadline="Este link não existe mais.">
        <div className="w-full max-w-sm rounded-xl border border-denied/25 bg-denied-bg p-6 text-center shadow-elevated backdrop-blur-xl">
          <h1 className="text-lg font-semibold text-ink">Checkout não encontrado</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Este link de checkout não existe mais, ou já foi usado. Volte para Minha Clínica e inicie o upgrade de novo.
          </p>
          <Button className="mt-4 w-full" onClick={() => navigate("/admin/tenant")}>
            Voltar para Minha Clínica
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (checkout.status === "completed" || confirmMutation.isSuccess) {
    return (
      <AuthLayout headline="Assinatura confirmada" subheadline="Seu novo plano já está ativo.">
        <div className="w-full max-w-sm rounded-xl border border-revenue/25 bg-revenue-bg p-6 text-center shadow-elevated backdrop-blur-xl">
          <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-canvas-surface/70 text-revenue">
            <CheckCircle2 aria-hidden size={20} strokeWidth={2} />
          </span>
          <h1 className="text-lg font-semibold text-ink">Plano {PLAN_LABELS[checkout.plan_tier] ?? checkout.plan_tier} ativado</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Sua assinatura foi confirmada com sucesso. O novo plano já está valendo para a sua clínica.
          </p>
          <Button className="mt-4 w-full" onClick={() => navigate("/admin/tenant")}>
            Voltar para Minha Clínica
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout headline="Não foi possível confirmar" subheadline="O pagamento pode ainda estar processando.">
      <div className="w-full max-w-sm rounded-xl border border-denied/25 bg-denied-bg p-6 text-center shadow-elevated backdrop-blur-xl">
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-canvas-surface/70 text-denied">
          <AlertTriangle aria-hidden size={20} strokeWidth={2} />
        </span>
        <h1 className="text-lg font-semibold text-ink">Ainda não conseguimos confirmar</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {confirmMutation.error ? getApiErrorMessage(confirmMutation.error) : "Alguns métodos de pagamento levam mais tempo para confirmar."}
        </p>
        <Button className="mt-4 w-full" onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
          Tentar confirmar de novo
        </Button>
      </div>
    </AuthLayout>
  );
}
