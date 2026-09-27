import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, CreditCard } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { SupportContactLinks } from "@/components/layout/SupportContactLinks";
import { Button } from "@/components/ui/Button";
import { DataExportPanel } from "@/pages/admin/TenantPage";
import type { CheckoutSession, SubscriptionOffer, SubscriptionStatus } from "@/lib/types";

function brl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function dateBr(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso));
}

function graceEnds(status: SubscriptionStatus): string | null {
  if (!status.overdue_since) return null;
  const end = new Date(status.overdue_since);
  end.setUTCDate(end.getUTCDate() + status.grace_days);
  return dateBr(end.toISOString());
}

const INCLUDED = [
  "Sala de Comando com os números da clínica todo dia",
  "Faturamento, glosas, agenda e estoque num lugar só",
  "Importação das planilhas do seu sistema atual",
  "Usuários ilimitados da equipe",
];

/**
 * Assinatura da clínica (autoatendimento). A clínica paga pelo Asaas (Pix,
 * boleto ou cartão) na página da própria fatura; a liberação acontece
 * quando o Asaas avisa o backend que o pagamento compensou (webhook), não
 * quando o navegador volta para cá. Enquanto espera, a tela consulta a
 * situação sozinha a cada 15 s.
 */
export function SubscriptionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const { showError } = useToast();
  const isOwner = user?.role === "owner";

  const statusQuery = useQuery({
    queryKey: ["subscription", "status"],
    queryFn: () => apiClient.get<SubscriptionStatus>("/api/v1/subscription"),
    refetchInterval: (query) => (query.state.data && !query.state.data.access_allowed ? 15000 : false),
  });
  const offerQuery = useQuery({
    queryKey: ["subscription", "offer"],
    queryFn: () => apiClient.get<SubscriptionOffer>("/api/v1/subscription/offer"),
  });

  const checkout = useMutation({
    mutationFn: (planTier: string) => apiClient.post<CheckoutSession>("/api/v1/subscription/checkout", { plan_tier: planTier }),
    onSuccess: (session) => {
      if (/^https?:\/\//.test(session.checkout_url)) {
        window.location.assign(session.checkout_url);
      } else {
        navigate(new URL(session.checkout_url, window.location.origin).pathname);
      }
    },
    onError: (err) => {
      showError(getApiErrorMessage(err));
      queryClient.invalidateQueries({ queryKey: ["subscription", "offer"] });
    },
  });

  const status = statusQuery.data;
  const offer = offerQuery.data;

  if (statusQuery.isLoading || !status) {
    return (
      <AuthLayout headline="Assinatura" subheadline="Carregando a situação da clínica.">
        <div className="w-full max-w-md rounded-xl border border-border-hairline bg-glass p-6 text-center text-sm text-ink-muted shadow-elevated">
          Carregando...
        </div>
      </AuthLayout>
    );
  }

  const active = status.access_allowed && status.billing_status === "active";
  const pastDueInGrace = status.billing_status === "past_due" && status.access_allowed;
  const headline = active
    ? "Assinatura ativa"
    : status.billing_status === "past_due"
      ? "Há uma cobrança em aberto"
      : status.billing_status === "canceled"
        ? "Assinatura cancelada"
        : "Falta pouco para liberar a clínica";
  const subheadline = active
    ? "Tudo certo com o pagamento."
    : pastDueInGrace
      ? `O acesso continua até ${graceEnds(status)}. Pague a fatura para não ser bloqueado.`
      : "Conclua o pagamento para usar o sistema. Pix e cartão liberam em minutos.";

  return (
    <AuthLayout headline={headline} subheadline={subheadline}>
      <div className="flex w-full max-w-md flex-col gap-4">
        <section className="rounded-xl border border-border-hairline bg-glass p-6 shadow-elevated backdrop-blur-xl">
          {active ? (
            <div className="flex flex-col gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-revenue">
                <CheckCircle2 aria-hidden size={16} /> Assinatura ativa
              </span>
              {status.current_price_cents !== null && (
                <p className="text-2xl font-semibold text-ink">
                  {brl(status.current_price_cents)}
                  <span className="text-sm font-normal text-ink-muted">/mês</span>
                </p>
              )}
              {status.founders_member && status.price_locked_until && (
                <p className="text-sm text-ink-muted">
                  Clínica Founders: preço garantido até <strong className="text-ink">{dateBr(status.price_locked_until)}</strong>.
                </p>
              )}
              <Button onClick={() => navigate("/")}>Ir para o sistema</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {status.billing_status === "past_due" ? (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-denied">
                  <AlertTriangle aria-hidden size={16} /> Cobrança vencida
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted">
                  <Clock aria-hidden size={16} /> Aguardando pagamento
                </span>
              )}

              {offer?.available && offer.price_cents !== null ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-ink">{offer.founders ? "Plano Founders" : "Assinatura mensal"}</p>
                  <p className="text-3xl font-semibold text-ink">
                    {brl(status.current_price_cents ?? offer.price_cents)}
                    <span className="text-sm font-normal text-ink-muted">/mês</span>
                  </p>
                  {offer.founders && (
                    <p className="text-sm text-ink-muted">
                      Preço garantido por {offer.founders_lock_months} meses. Restam{" "}
                      <strong className="text-ink">
                        {offer.founders_slots_remaining} de {offer.founders_slots_total}
                      </strong>{" "}
                      vagas.
                    </p>
                  )}
                  <ul className="mt-1 flex flex-col gap-1 text-sm text-ink-muted">
                    {INCLUDED.map((item) => (
                      <li key={item} className="flex gap-2">
                        <CheckCircle2 aria-hidden size={14} className="mt-0.5 shrink-0 text-revenue" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                offerQuery.isSuccess && (
                  <p className="text-sm text-ink-muted">As vagas Founders acabaram. Fale com o time pelo suporte para contratar.</p>
                )
              )}

              {isOwner ? (
                <Button
                  disabled={checkout.isPending || !(offer?.available || status.billing_status === "past_due")}
                  onClick={() => checkout.mutate(offer?.plan_tier ?? "founders")}
                  className="flex items-center justify-center gap-2"
                >
                  <CreditCard aria-hidden size={16} />
                  {checkout.isPending ? "Abrindo a fatura..." : "Pagar com Pix, boleto ou cartão"}
                </Button>
              ) : (
                <p className="text-sm text-ink-muted">Peça ao responsável pela clínica (perfil Diretoria) para concluir o pagamento.</p>
              )}
              <Button variant="secondary" onClick={() => statusQuery.refetch()} disabled={statusQuery.isFetching}>
                {statusQuery.isFetching ? "Conferindo..." : "Já paguei, conferir agora"}
              </Button>
              <p className="text-2xs text-ink-faint">
                O pagamento é feito na página segura do Asaas. Boleto compensa em até 3 dias úteis. A nota fiscal chega por e-mail.
              </p>
            </div>
          )}
        </section>

        {!active && isOwner && <DataExportPanel isOwner={isOwner} />}
        <SupportContactLinks variant="inline" />
        <button type="button" onClick={logout} className="text-center text-2xs text-ink-faint underline-offset-2 hover:underline">
          Sair
        </button>
      </div>
    </AuthLayout>
  );
}
