import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { AuthLayout, AuthFormHeader } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import type { CheckoutDetail } from "@/lib/types";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/**
 * Achado CRÍTICO da Auditoria de Prontidão v1 ("produto não se cobra
 * sozinho") — checkout de UPGRADE SELF-SERVICE. Esta tela é o "provedor
 * de pagamento" enquanto MockPaymentProvider (backend) está ativo: os
 * campos de cartão abaixo NUNCA são enviados a lugar nenhum (não há
 * nenhum gateway de verdade ainda) — só existem para o fluxo completo
 * (iniciar checkout -> "pagar" -> confirmar -> plano ativado) já
 * funcionar de ponta a ponta em demonstração e ficar pronto para trocar
 * por um Checkout real (Stripe) sem mudar a tela que chama isto (ver
 * DECISÃO em app/services/payment_provider.py, backend).
 */
export function MockCheckoutPage() {
  const { checkoutId } = useParams<{ checkoutId: string }>();
  const navigate = useNavigate();
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: checkout, isLoading } = useQuery({
    queryKey: ["subscription-checkout", checkoutId],
    queryFn: () => apiClient.get<CheckoutDetail>(`/api/v1/subscription/checkout/${checkoutId}`),
    enabled: !!checkoutId,
    retry: false,
  });

  const confirmMutation = useMutation({
    mutationFn: () => apiClient.post<{ plan_tier: string }>(`/api/v1/subscription/checkout/${checkoutId}/confirm`, {}),
    onError: (err) => setSubmitError(getApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!cardName.trim() || cardNumber.trim().length < 12 || !cardExpiry.trim() || cardCvv.trim().length < 3) {
      setSubmitError("Preencha todos os campos do cartão (simulado — nenhum dado é enviado a um gateway real).");
      return;
    }
    confirmMutation.mutate();
  }

  if (isLoading) {
    return (
      <AuthLayout headline="Confirmar assinatura" subheadline="Ative seu novo plano em segundos.">
        <div className="w-full max-w-sm rounded-xl border border-border-hairline bg-glass p-6 text-center shadow-elevated backdrop-blur-xl">
          <p className="text-sm text-ink-muted">Carregando...</p>
        </div>
      </AuthLayout>
    );
  }

  if (!checkout) {
    return (
      <AuthLayout headline="Confirmar assinatura" subheadline="Ative seu novo plano em segundos.">
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
    <AuthLayout
      headline="Confirmar assinatura"
      subheadline="Simulação de checkout — nenhum dado de cartão é enviado a um gateway real neste MVP."
      highlights={[{ icon: ShieldCheck, text: "Ambiente de simulação: use qualquer número de cartão para testar o fluxo." }]}
    >
      <div className="w-full max-w-sm rounded-xl border border-border-hairline bg-glass p-6 shadow-elevated backdrop-blur-xl">
        <AuthFormHeader title="Finalizar upgrade" subtitle={`Plano ${PLAN_LABELS[checkout.plan_tier] ?? checkout.plan_tier}`} />

        <div className="mb-5 flex items-center justify-between rounded-lg border border-border-hairline bg-canvas-raised/60 px-4 py-3">
          <span className="text-sm text-ink-muted">Cobrança mensal</span>
          <span className="text-lg font-semibold text-ink">{formatCurrency(checkout.amount_cents)}</span>
        </div>

        <form onSubmit={handleSubmit}>
          <TextField label="Nome no cartão" required value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Como está impresso no cartão" />
          <TextField
            label="Número do cartão"
            required
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            placeholder="0000 0000 0000 0000"
            inputMode="numeric"
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Validade" required value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="MM/AA" />
            <TextField label="CVV" required value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} placeholder="123" inputMode="numeric" />
          </div>

          {submitError && <p className="mb-3 text-xs text-denied">{submitError}</p>}

          <Button type="submit" className="mt-2 w-full" disabled={confirmMutation.isPending}>
            <CreditCard aria-hidden size={14} className="mr-1.5" />
            {confirmMutation.isPending ? "Confirmando..." : `Pagar ${formatCurrency(checkout.amount_cents)}`}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
