import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Clock, CreditCard, Eye, ShieldCheck, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { BrandMark } from "@/components/ui/BrandMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SupportContactLinks } from "@/components/layout/SupportContactLinks";
import { Button } from "@/components/ui/Button";
import { CancelSubscriptionPanel } from "@/components/billing/CancelSubscriptionPanel";
import { DataExportPanel } from "@/pages/admin/TenantPage";
import { PLAN_QUERY_KEY, daysUntil } from "@/lib/plan";
import { PlanUsagePanel } from "@/components/billing/PlanUsagePanel";
import { UsageBandMeter } from "@/components/billing/UsageBandMeter";
import type {
  BillingCycle,
  ChangePlanResponse,
  CheckoutSession,
  PlanCatalogEntry,
  PlanKey,
  SubscriptionOffer,
  SubscriptionStatus,
} from "@/lib/types";

function brl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
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

// O que cada plano entrega, na língua do gestor (espelha app/services/plans.py).
const PLAN_COPY: Record<"basic" | "pro", { who: string; items: string[] }> = {
  basic: {
    who: "Clínica pequena, até 1.500 atendimentos por mês.",
    items: [
      "Sala de Comando com até 5 prioridades por dia",
      "20 análises essenciais de agenda, faturamento e glosa",
      "6 conferências antes do envio e pagamento conferido contra o contrato",
      "Extrato de Resultado e Health Score todo mês",
      "Relatório semanal por e-mail",
      "Integração noturna com o ERP: os dados chegam sozinhos",
      "3 usuários, 3 convênios com contrato, 12 meses de histórico",
    ],
  },
  pro: {
    who: "Clínica média, até 8.000 atendimentos por mês.",
    items: [
      "Tudo do Basic, com as 47 análises",
      "Risco de falta por paciente, alerta a cada 2h e lista de espera",
      "Equipe de IA: Jornal da manhã, perguntas livres, leitura de contrato e minuta de recurso",
      "Modelo preditivo de glosa e comparativo entre clínicas",
      "Margem, custos, estoque, pacientes e marketing",
      "Relatório no WhatsApp, webhooks e usuários ilimitados",
    ],
  },
};

/**
 * Plano e assinatura (autoatendimento). Basic, Pro e o Founders Club (Pro
 * com preço travado, 7 vagas). Quem ainda não assina escolhe o plano e o
 * ciclo e paga pelo Asaas (Pix, boleto ou cartão); quem já assina troca de
 * plano aqui. A liberação acontece quando o Asaas avisa o backend que o
 * pagamento compensou (webhook), nunca quando o navegador volta.
 */
export function SubscriptionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const { showError, showSuccess } = useToast();
  const isOwner = user?.role === "owner";
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  const statusQuery = useQuery({
    queryKey: ["subscription", "status"],
    queryFn: () => apiClient.get<SubscriptionStatus>("/api/v1/subscription"),
    refetchInterval: (query) => (query.state.data && !query.state.data.access_allowed ? 15000 : false),
  });
  const offerQuery = useQuery({
    queryKey: ["subscription", "offer"],
    queryFn: () => apiClient.get<SubscriptionOffer>("/api/v1/subscription/offer"),
  });
  const plansQuery = useQuery({
    queryKey: ["subscription", "plans"],
    queryFn: () => apiClient.get<PlanCatalogEntry[]>("/api/v1/subscription/plans"),
  });

  const checkout = useMutation({
    mutationFn: ({ plan, billingCycle }: { plan: string; billingCycle: BillingCycle }) =>
      apiClient.post<CheckoutSession>("/api/v1/subscription/checkout", { plan_tier: plan, billing_cycle: billingCycle }),
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

  const changePlan = useMutation({
    mutationFn: (plan: PlanKey) => apiClient.post<ChangePlanResponse>("/api/v1/subscription/change-plan", { plan_tier: plan }),
    onSuccess: (result) => {
      showSuccess(result.message);
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEY });
      if (result.proration_invoice_url) window.open(result.proration_invoice_url, "_blank", "noopener");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const status = statusQuery.data;
  const offer = offerQuery.data;
  const catalog = plansQuery.data ?? [];

  if (statusQuery.isLoading || !status) {
    return (
      <Shell>
        <div className="rounded-xl border border-border-hairline bg-glass p-6 text-center text-sm text-ink-muted shadow-elevated">Carregando...</div>
      </Shell>
    );
  }

  const canceling = status.billing_status === "canceling";
  const subscribed = status.billing_status === "active" || status.billing_status === "past_due" || canceling;
  const hasPaidSubscription = subscribed && status.provider !== "mock" && status.current_price_cents !== null;
  const currentPlan: PlanKey = status.contracted_plan ?? "basic";
  const effectivePlan: PlanKey = status.plan ?? currentPlan;
  const trialDays = status.in_trial ? daysUntil(status.trial_ends_at) : null;
  const pastDueInGrace = status.billing_status === "past_due" && status.access_allowed;
  const foundersOpen = !!offer?.founders && offer.founders_slots_remaining > 0;
  const priceOf = (key: PlanKey) => catalog.find((p) => p.tier === key);

  const headline = status.read_only
    ? "Sistema em modo leitura"
    : canceling
      ? "Cancelamento agendado"
      : status.billing_status === "past_due"
        ? "Há uma cobrança em aberto"
        : status.billing_status === "canceled"
          ? "Assinatura cancelada"
          : trialDays !== null
            ? `Teste do Pro: ${trialDays === 1 ? "falta 1 dia" : `faltam ${trialDays} dias`}`
            : hasPaidSubscription
              ? `Plano ${effectivePlan === "pro" ? "Pro" : effectivePlan === "redes" ? "Redes" : "Basic"}`
              : "Escolha o plano da clínica";

  const subheadline = status.read_only
    ? "O teste terminou ou a assinatura não está paga. Você continua vendo tudo; para importar e editar, escolha um plano."
    : canceling
      ? `Nenhuma cobrança nova será feita. O acesso continua até ${status.access_until ? dateBr(status.access_until) : "o fim do período pago"}.`
      : pastDueInGrace
        ? `O acesso continua até ${graceEnds(status)}. Pague a fatura para não perder a edição.`
        : trialDays !== null
          ? "Tudo do Pro está liberado no teste. Escolha o plano antes do fim para não ficar em modo leitura."
          : hasPaidSubscription
            ? "Troque de plano quando quiser. Subir vale assim que a diferença for paga; descer vale no próximo pagamento."
            : "Teste, compare e escolha. Pix, boleto ou cartão, com nota fiscal todo mês.";

  function selectPlan(plan: "basic" | "pro" | "founders") {
    if (hasPaidSubscription && plan !== "founders") {
      changePlan.mutate(plan);
    } else {
      checkout.mutate({ plan, billingCycle: plan === "founders" ? "monthly" : cycle });
    }
  }

  const busy = checkout.isPending || changePlan.isPending;

  return (
    <Shell>
      <header className="flex flex-col gap-2 text-center">
        <h1 className="font-serif text-3xl font-medium tracking-tightest text-ink">{headline}</h1>
        <p className="mx-auto max-w-2xl text-sm text-ink-muted">{subheadline}</p>
        <StatusPill status={status} />
        {status.pending_plan === "basic" && (
          <p className="text-sm text-ink-muted">
            Troca agendada para o plano <strong className="text-ink">Basic</strong> no próximo pagamento.
          </p>
        )}
        {status.scheduled_price_cents && status.scheduled_price_on ? (
          <p className="text-sm text-ink-muted">
            Reajuste anual pelo IPCA: a partir de <strong className="text-ink">{dateBr(status.scheduled_price_on)}</strong>, a
            assinatura passa a <strong className="text-ink">{brl(status.scheduled_price_cents)}</strong>.
          </p>
        ) : null}
      </header>

      {status.pending_plan === "pro" && (
        <div
          role="status"
          className="flex flex-col items-center gap-3 rounded-xl border border-accent/40 bg-accent-bg p-4 text-center"
        >
          <p className="text-sm text-ink">
            <strong>Troca para o Pro pedida.</strong> O Pro é liberado assim que o pagamento da diferença for confirmado. Pix e
            cartão liberam em minutos; boleto compensa em até 3 dias úteis. Se a diferença não for paga, o Pro passa a valer no
            próximo pagamento da assinatura.
          </p>
          {isOwner && (
            <div className="flex flex-wrap justify-center gap-2">
              {status.pending_upgrade_invoice_url && (
                <Button onClick={() => window.open(status.pending_upgrade_invoice_url ?? "", "_blank", "noopener")}>
                  <CreditCard aria-hidden size={16} /> Pagar a diferença
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={statusQuery.isFetching}
                onClick={() => {
                  statusQuery.refetch();
                  queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEY });
                }}
              >
                {statusQuery.isFetching ? "Conferindo..." : "Já paguei, conferir agora"}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => changePlan.mutate(currentPlan)}>
                Desistir da troca
              </Button>
            </div>
          )}
        </div>
      )}

      {subscribed ? <UsageBandMeter /> : null}
      {subscribed || trialDays !== null ? <PlanUsagePanel /> : null}

      {status.billing_status === "past_due" && isOwner && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-denied/30 bg-denied-bg p-4 text-center">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-denied">
            <AlertTriangle aria-hidden size={16} /> Cobrança vencida
          </span>
          <Button onClick={() => checkout.mutate({ plan: currentPlan, billingCycle: status.billing_cycle ?? "monthly" })} disabled={busy}>
            <CreditCard aria-hidden size={16} /> Pagar a fatura em aberto
          </Button>
        </div>
      )}

      {!hasPaidSubscription && (
        <div role="radiogroup" aria-label="Ciclo de cobrança" className="mx-auto flex w-fit gap-1 rounded-full border border-border-hairline bg-glass p-1">
          {(["monthly", "yearly"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={cycle === value}
              onClick={() => setCycle(value)}
              className={
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
                (cycle === value ? "bg-accent text-white" : "text-ink-muted hover:text-ink")
              }
            >
              {value === "monthly" ? "Mensal" : "Anual · 2 meses grátis"}
            </button>
          ))}
        </div>
      )}

      <div className={"grid gap-4 " + (foundersOpen && !status.founders_member ? "lg:grid-cols-3" : "md:grid-cols-2")}>
        {(["basic", "pro"] as const).map((key) => {
          const entry = priceOf(key);
          const monthly = entry?.monthly_price_cents ?? 0;
          const yearly = entry?.yearly_price_cents ?? null;
          const isCurrent = hasPaidSubscription && currentPlan === key && !(status.founders_member && key === "pro");
          const showYearly = !hasPaidSubscription ? cycle === "yearly" : status.billing_cycle === "yearly";
          return (
            <article
              key={key}
              className={
                "flex flex-col gap-4 rounded-xl border bg-glass p-6 shadow-elevated backdrop-blur-xl " +
                (key === "pro" ? "border-accent/50" : "border-border-hairline")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-ink">{key === "pro" ? "Pro" : "Basic"}</h2>
                {isCurrent && <span className="rounded-full bg-revenue/15 px-2 py-0.5 text-2xs font-medium text-revenue">Seu plano</span>}
                {!isCurrent && key === "pro" && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-2xs font-semibold text-white">Mais completo</span>
                )}
              </div>
              <p className="text-sm text-ink-muted">{PLAN_COPY[key].who}</p>
              <p className="text-3xl font-semibold text-ink">
                {showYearly && yearly ? brl(Math.round(yearly / 12)) : brl(monthly)}
                <span className="text-sm font-normal text-ink-muted">/mês</span>
              </p>
              {showYearly && yearly && <p className="-mt-3 text-xs text-ink-muted">{brl(yearly)} por ano, cobrados de uma vez</p>}
              <ul className="flex flex-1 flex-col gap-1.5 text-sm text-ink-muted">
                {PLAN_COPY[key].items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check aria-hidden size={14} className="mt-0.5 shrink-0 text-revenue" />
                    {item}
                  </li>
                ))}
              </ul>
              {isOwner ? (
                <Button
                  variant={key === "pro" ? "primary" : "secondary"}
                  disabled={
                    busy ||
                    isCurrent ||
                    canceling ||
                    (status.billing_status === "canceled" && hasPaidSubscription) ||
                    (key === "pro" && status.pending_plan === "pro")
                  }
                  onClick={() => selectPlan(key)}
                >
                  {isCurrent
                    ? "Plano atual"
                    : hasPaidSubscription
                      ? key === "pro"
                        ? status.pending_plan === "pro"
                          ? "Aguardando o pagamento"
                          : "Mudar para o Pro"
                        : "Mudar para o Basic"
                      : `Assinar o ${key === "pro" ? "Pro" : "Basic"}`}
                </Button>
              ) : null}
            </article>
          );
        })}

        {foundersOpen && !status.founders_member && offer && (
          <article className="flex flex-col gap-4 rounded-xl border-2 border-accent bg-accent-bg p-6 shadow-elevated">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">Pro Founders</h2>
              <span className="rounded-full bg-accent px-2 py-0.5 text-2xs font-semibold text-white">
                Restam {offer.founders_slots_remaining} de {offer.founders_slots_total}
              </span>
            </div>
            <p className="text-sm text-ink-muted">O Pro completo para as {offer.founders_slots_total} clínicas fundadoras.</p>
            <p className="text-3xl font-semibold text-ink">
              {brl(offer.price_cents ?? 80000)}
              <span className="text-sm font-normal text-ink-muted">/mês</span>
            </p>
            {offer.pro_price_cents ? (
              <p className="-mt-3 text-xs text-ink-muted">
                <s>{brl(offer.pro_price_cents)}</s> · preço travado enquanto for cliente, só com reajuste anual pelo IPCA
              </p>
            ) : null}
            <ul className="flex flex-1 flex-col gap-1.5 text-sm text-ink-muted">
              <li className="flex gap-2">
                <ShieldCheck aria-hidden size={14} className="mt-0.5 shrink-0 text-accent" />
                Garantia de 90 dias: se o Extrato não mostrar 3 mensalidades em valor medido, você sai e recebe o último mês de volta
              </li>
              <li className="flex gap-2">
                <Sparkles aria-hidden size={14} className="mt-0.5 shrink-0 text-accent" />
                Suporte por e-mail com prioridade e novidades do produto por e-mail
              </li>
              <li className="flex gap-2">
                <Check aria-hidden size={14} className="mt-0.5 shrink-0 text-accent" />
                Sem contrapartida: nada de reuniões nem estudo de caso, é só usar o sistema
              </li>
            </ul>
            {isOwner && (
              <Button disabled={busy} onClick={() => selectPlan("founders")}>
                Garantir minha vaga Founders
              </Button>
            )}
          </article>
        )}
      </div>

      {status.founders_member && (
        <p className="text-center text-sm text-ink-muted">
          <CheckCircle2 aria-hidden size={14} className="mr-1 inline text-revenue" />
          Clínica Founders: preço travado
          {status.locked_price_cents ? <> em <strong className="text-ink">{brl(status.locked_price_cents)}</strong></> : null}
          {status.price_locked_until ? (
            <>
              {" "}
              até <strong className="text-ink">{dateBr(status.price_locked_until)}</strong>
            </>
          ) : (
            " enquanto for cliente, só com reajuste anual pelo IPCA"
          )}
          .
        </p>
      )}

      {!isOwner && (
        <p className="text-center text-sm text-ink-muted">Peça ao responsável pela clínica (perfil Diretoria) para escolher o plano.</p>
      )}

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm text-ink-muted">
          Mais de uma unidade? O plano <strong className="text-ink">Redes</strong> é sob consulta, com o consolidado de todas as unidades.
        </p>
        {!status.access_allowed && (
          <Button variant="secondary" onClick={() => statusQuery.refetch()} disabled={statusQuery.isFetching}>
            {statusQuery.isFetching ? "Conferindo..." : "Já paguei, conferir agora"}
          </Button>
        )}
        <p className="text-2xs text-ink-faint">
          O pagamento é feito na página segura do Asaas. Boleto compensa em até 3 dias úteis. A nota fiscal chega por e-mail.
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        {(status.read_only || !status.access_allowed) && isOwner && <DataExportPanel isOwner={isOwner} />}
        {isOwner && hasPaidSubscription && !canceling && <CancelSubscriptionPanel />}
        {status.access_allowed && (
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft aria-hidden size={14} /> Voltar para o sistema
          </Button>
        )}
        <SupportContactLinks variant="inline" />
        <button
          type="button"
          onClick={logout}
          className="text-center text-2xs text-ink-faint underline-offset-2 hover:underline"
        >
          Sair
        </button>
      </div>
    </Shell>
  );
}

function StatusPill({ status }: { status: SubscriptionStatus }) {
  if (status.read_only)
    return (
      <span className="mx-auto inline-flex items-center gap-2 text-sm font-medium text-pending">
        <Eye aria-hidden size={16} /> Modo leitura
      </span>
    );
  if (status.billing_status === "canceling")
    return (
      <span className="mx-auto inline-flex items-center gap-2 text-sm font-medium text-ink-muted">
        <Clock aria-hidden size={16} /> Cancelada — acesso até {status.access_until ? dateBr(status.access_until) : "o fim do período pago"}
      </span>
    );
  if (status.billing_status === "active" && status.billing_required && status.current_price_cents !== null)
    return (
      <span className="mx-auto inline-flex items-center gap-2 text-sm font-medium text-revenue">
        <CheckCircle2 aria-hidden size={16} /> Assinatura ativa · {brl(status.current_price_cents)}
        {status.billing_cycle === "yearly" ? "/ano" : "/mês"}
      </span>
    );
  return null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas bg-premium-canvas bg-no-repeat">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <BrandMark size="md" />
        <ThemeToggle />
      </div>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-16">{children}</main>
    </div>
  );
}
