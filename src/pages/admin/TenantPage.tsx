import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Copy, Link2, Sparkles } from "lucide-react";
import { Panel, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import type {
  AnnualGoalSuggestion,
  CheckoutSession,
  DenialRiskThresholdSuggestion,
  HealthScoreCeilingSuggestion,
  NoShowThresholdSuggestion,
  OrganizationInviteResponse,
  OrganizationJoinResponse,
  PlanCatalogEntry,
  Tenant,
} from "@/lib/types";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/**
 * Achado CRÍTICO da Auditoria de Prontidão v1 ("produto não se cobra
 * sozinho") — antes desta tela, mudar de plano era só um texto "fale com
 * o time comercial", sem nenhum jeito de fato pagar. Cada tier
 * self_service=true ganha um botão que abre o checkout (mock hoje,
 * Stripe real depois — ver DECISÃO em app/services/payment_provider.py,
 * backend); enterprise continua "fale com vendas" de propósito (ver
 * DECISÃO no mesmo arquivo: plano de maior porte nunca é self-service).
 * Só owner inicia checkout (mesmo RBAC do backend, _CAN_CHECKOUT em
 * app/api/v1/endpoints/subscription.py).
 */
function SubscriptionPlanPanel({ tenant, isOwner }: { tenant: Tenant; isOwner: boolean }) {
  const navigate = useNavigate();
  const { showError } = useToast();

  const { data: planCatalog, isLoading } = useQuery({
    queryKey: ["subscription", "plans"],
    queryFn: () => apiClient.get<PlanCatalogEntry[]>("/api/v1/subscription/plans"),
  });

  const checkoutMutation = useMutation({
    mutationFn: (planTier: string) => apiClient.post<CheckoutSession>("/api/v1/subscription/checkout", { plan_tier: planTier }),
    onSuccess: (session) => navigate(`/checkout/mock/${session.checkout_id}`),
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  return (
    <Panel title="Plano e assinatura">
      <div className="p-4">
        {isLoading && <p className="text-sm text-ink-muted">Carregando planos...</p>}
        {!isLoading && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(planCatalog ?? []).map((plan) => {
              const isCurrent = plan.tier === tenant.plan_tier;
              return (
                <div
                  key={plan.tier}
                  className={`rounded-lg border p-4 ${isCurrent ? "border-accent/40 bg-accent-bg" : "border-border-hairline bg-canvas-raised/40"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink">{plan.label}</span>
                    {isCurrent && <Badge tone="accent">Plano atual</Badge>}
                  </div>
                  <p className="mt-2 text-lg font-semibold text-ink">
                    {plan.self_service ? `${formatCurrency(plan.monthly_price_cents / 100)}/mês` : "Sob consulta"}
                  </p>
                  {isOwner && !isCurrent && plan.self_service && (
                    <Button
                      variant="secondary"
                      className="mt-3 w-full"
                      disabled={checkoutMutation.isPending}
                      onClick={() => checkoutMutation.mutate(plan.tier)}
                    >
                      {checkoutMutation.isPending ? "Abrindo checkout..." : "Fazer upgrade"}
                    </Button>
                  )}
                  {!plan.self_service && !isCurrent && (
                    <p className="mt-3 text-2xs text-ink-faint">Fale com o time comercial para contratar este plano.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!isOwner && <p className="mt-3 text-2xs text-ink-faint">Só o papel "owner" pode mudar de plano.</p>}
      </div>
    </Panel>
  );
}

/**
 * Meta de faturamento anual — decidido explicitamente durante a
 * Auditoria Go-Live: campo MANUAL, nunca calculado automaticamente pelo
 * sistema (é uma decisão de negócio da clínica, não uma inferência a
 * partir do histórico). Alimenta o insight de desempenho anual na Sala
 * de Comando (ver smart_insights_engine.py — comparação com o
 * faturamento acumulado no ano e recomendação de CRM/recuperação de
 * pacientes inativos quando abaixo da meta).
 */
function AnnualGoalPanel({ tenant, isOwner }: { tenant: Tenant; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [goalInput, setGoalInput] = useState("");

  useEffect(() => {
    setGoalInput(tenant.annual_revenue_goal !== null ? String(tenant.annual_revenue_goal) : "");
  }, [tenant.annual_revenue_goal]);

  // Épico F3.3 do Plano Diretor ("Metas e cenários orientados a dados")
  // — "meta anual sugerida (crescimento histórico + percentil de
  // rede)". Buscada só quando o usuário pede (mesmo padrão de
  // NoShowThresholdsPanel), não em toda visita à página.
  const suggestionQuery = useQuery({
    queryKey: ["tenant", "annual-goal", "suggested"],
    queryFn: () => apiClient.get<AnnualGoalSuggestion>("/api/v1/tenant/annual-goal/suggested"),
    enabled: false,
  });

  const mutation = useMutation({
    mutationFn: (annual_revenue_goal: number) => apiClient.patch<Tenant>("/api/v1/tenant", { annual_revenue_goal }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
      showSuccess("Meta de faturamento anual atualizada.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = Number(goalInput.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showError("Informe um valor de meta maior que zero.");
      return;
    }
    mutation.mutate(parsed);
  }

  return (
    <Panel title="Meta de faturamento anual">
      <form onSubmit={handleSubmit} className="p-4">
        <p className="mb-3.5 max-w-xl text-xs leading-relaxed text-ink-faint">
          Meta manual, definida pela clínica — alimenta o insight de desempenho anual na Sala de Comando (comparação
          com o faturamento acumulado e recomendação de recuperação de pacientes inativos quando abaixo da meta).
        </p>
        {tenant.annual_revenue_goal === null && (
          <p className="-mt-1.5 mb-3.5 text-2xs text-ink-faint">
            Nenhuma meta configurada ainda — sem ela, a Sala de Comando não mostra o insight de desempenho anual.
          </p>
        )}
        <div className="flex max-w-md items-end gap-3">
          <TextField
            label="Meta de faturamento anual (R$)"
            type="number"
            min={0.01}
            step="0.01"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            disabled={!isOwner}
            placeholder="Ex: 1200000.00"
            className="mb-0 flex-1"
          />
          {isOwner && (
            <Button type="submit" disabled={mutation.isPending || !goalInput}>
              {mutation.isPending ? "Salvando..." : "Salvar meta"}
            </Button>
          )}
        </div>
        {tenant.annual_revenue_goal !== null && (
          <p className="mt-2 text-2xs text-ink-faint">
            Meta atual: <span className="font-mono text-ink-muted">{formatCurrency(tenant.annual_revenue_goal)}</span>
          </p>
        )}
        {!isOwner && <p className="mt-2 text-2xs text-ink-faint">Só o papel "owner" pode editar a meta de faturamento.</p>}

        {isOwner && (
          <div className="mt-3 rounded-md border border-border-hairline bg-canvas-raised/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xs text-ink-faint">
                Duas sugestões independentes: seu próprio crescimento e o ritmo de outras clínicas da base — nunca
                aplicadas sozinhas.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                className="flex shrink-0 items-center gap-1.5"
                onClick={() => suggestionQuery.refetch()}
                disabled={suggestionQuery.isFetching}
              >
                <Sparkles size={12} />
                {suggestionQuery.isFetching ? "Calculando..." : "Sugerir com base no histórico"}
              </Button>
            </div>
            {suggestionQuery.data && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-2xs">
                  <span className="text-ink-muted">
                    Pelo seu crescimento{suggestionQuery.data.own_growth_rate !== null && (
                      <> ({(suggestionQuery.data.own_growth_rate * 100).toFixed(0)}%)</>
                    )}
                    :
                  </span>
                  {suggestionQuery.data.own_trend_suggested_goal !== null ? (
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-ink">{formatCurrency(suggestionQuery.data.own_trend_suggested_goal)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setGoalInput(String(suggestionQuery.data!.own_trend_suggested_goal))}
                      >
                        Usar
                      </Button>
                    </span>
                  ) : (
                    <span className="text-pending">sem histórico do período anterior suficiente</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 text-2xs">
                  <span className="text-ink-muted">
                    Pelo ritmo da rede{suggestionQuery.data.network_growth_median !== null && (
                      <> ({(suggestionQuery.data.network_growth_median * 100).toFixed(0)}%, {suggestionQuery.data.network_cohort_size} clínicas)</>
                    )}
                    :
                  </span>
                  {suggestionQuery.data.network_pace_suggested_goal !== null ? (
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-ink">
                        {formatCurrency(suggestionQuery.data.network_pace_suggested_goal)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setGoalInput(String(suggestionQuery.data!.network_pace_suggested_goal))}
                      >
                        Usar
                      </Button>
                    </span>
                  ) : (
                    <span className="text-pending">sem clínicas suficientes na base ainda</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </Panel>
  );
}

/**
 * Limiares de risco de falta (no-show) — achado do usuário: os cortes
 * 10%/30% (baixo/médio/alto) do MVP eram um valor de partida razoável,
 * nunca uma calibração validada com dado real, e cada especialidade tem
 * um perfil de falta bem diferente (estética costuma faltar bem menos
 * que saúde mental, por exemplo). Mesmo padrão de AnnualGoalPanel: campo
 * MANUAL, null usa o default do motor (ver no_show_risk_engine.py).
 */
function NoShowThresholdsPanel({ tenant, isOwner }: { tenant: Tenant; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [lowInput, setLowInput] = useState("");
  const [mediumInput, setMediumInput] = useState("");

  useEffect(() => {
    setLowInput(tenant.no_show_low_threshold !== null ? String(tenant.no_show_low_threshold * 100) : "");
    setMediumInput(tenant.no_show_medium_threshold !== null ? String(tenant.no_show_medium_threshold * 100) : "");
  }, [tenant.no_show_low_threshold, tenant.no_show_medium_threshold]);

  // Sugestão calculada do HISTÓRICO REAL desta clínica (mediana/P85 da
  // taxa de falta por paciente) — buscada só quando o usuário pede
  // (`enabled: false` + refetch manual), não em toda visita à página.
  const suggestionQuery = useQuery({
    queryKey: ["tenant", "no-show-thresholds", "suggested"],
    queryFn: () => apiClient.get<NoShowThresholdSuggestion>("/api/v1/tenant/no-show-thresholds/suggested"),
    enabled: false,
  });

  function applySuggestion() {
    const suggestion = suggestionQuery.data;
    if (!suggestion || suggestion.low_threshold === null || suggestion.medium_threshold === null) return;
    setLowInput((suggestion.low_threshold * 100).toFixed(1));
    setMediumInput((suggestion.medium_threshold * 100).toFixed(1));
  }

  const mutation = useMutation({
    mutationFn: (payload: { no_show_low_threshold: number; no_show_medium_threshold: number }) =>
      apiClient.patch<Tenant>("/api/v1/tenant", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
      showSuccess("Limiares de risco de falta atualizados.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const low = Number(lowInput.replace(",", "."));
    const medium = Number(mediumInput.replace(",", "."));
    if (!Number.isFinite(low) || !Number.isFinite(medium) || low <= 0 || medium <= 0 || low >= 100 || medium >= 100) {
      showError("Informe valores entre 0 e 100.");
      return;
    }
    if (low >= medium) {
      showError("O limiar de risco baixo precisa ser menor que o de risco médio.");
      return;
    }
    mutation.mutate({ no_show_low_threshold: low / 100, no_show_medium_threshold: medium / 100 });
  }

  const usingDefaults = tenant.no_show_low_threshold === null && tenant.no_show_medium_threshold === null;

  return (
    <Panel title="Limiares de risco de falta (no-show)">
      <form onSubmit={handleSubmit} className="p-4">
        <p className="mb-3.5 max-w-xl text-xs leading-relaxed text-ink-faint">
          Define a partir de qual taxa de falta histórica um paciente é classificado como risco baixo/médio/alto —
          alimenta a lista vermelha, o alerta de próximos agendamentos em risco e a contagem do relatório semanal.
        </p>
        {usingDefaults && (
          <p className="-mt-1.5 mb-3.5 text-2xs text-ink-faint">
            Nenhum limiar configurado ainda — usando o padrão do sistema (abaixo de 10% = baixo, 10% a 30% = médio,
            acima de 30% = alto).
          </p>
        )}
        <div className="grid max-w-md grid-cols-2 gap-3">
          <TextField
            label="Risco baixo até (%)"
            type="number"
            min={0.01}
            max={99}
            step="0.1"
            value={lowInput}
            onChange={(e) => setLowInput(e.target.value)}
            disabled={!isOwner}
            placeholder="Ex: 10"
            className="mb-0"
          />
          <TextField
            label="Risco médio até (%)"
            type="number"
            min={0.01}
            max={99}
            step="0.1"
            value={mediumInput}
            onChange={(e) => setMediumInput(e.target.value)}
            disabled={!isOwner}
            placeholder="Ex: 30"
            className="mb-0"
          />
        </div>
        <p className="mt-2 text-2xs text-ink-faint">Acima do limiar de risco médio, o paciente/agendamento vira risco alto.</p>

        {isOwner && (
          <div className="mt-3 rounded-md border border-border-hairline bg-canvas-raised/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xs text-ink-faint">
                Calculado a partir do histórico real de falta dos pacientes desta clínica, não um valor genérico.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                className="flex shrink-0 items-center gap-1.5"
                onClick={() => suggestionQuery.refetch()}
                disabled={suggestionQuery.isFetching}
              >
                <Sparkles size={12} />
                {suggestionQuery.isFetching ? "Calculando..." : "Sugerir com base no histórico"}
              </Button>
            </div>
            {suggestionQuery.data && suggestionQuery.data.low_threshold === null && (
              <p className="mt-2 text-2xs text-pending">
                Ainda não há histórico suficiente ({suggestionQuery.data.sample_size} paciente(s) qualificado(s) — são
                necessários pelo menos 10) para uma sugestão confiável.
              </p>
            )}
            {suggestionQuery.data && suggestionQuery.data.low_threshold !== null && suggestionQuery.data.medium_threshold !== null && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-2xs text-ink-muted">
                  Sugestão (baseada em {suggestionQuery.data.sample_size} pacientes): baixo até{" "}
                  <span className="font-mono">{(suggestionQuery.data.low_threshold * 100).toFixed(1)}%</span>, médio até{" "}
                  <span className="font-mono">{(suggestionQuery.data.medium_threshold * 100).toFixed(1)}%</span>.
                </p>
                <Button type="button" variant="ghost" size="xs" onClick={applySuggestion}>
                  Preencher campos
                </Button>
              </div>
            )}
          </div>
        )}

        {isOwner && (
          <div className="mt-3 flex justify-end">
            <Button type="submit" disabled={mutation.isPending || !lowInput || !mediumInput}>
              {mutation.isPending ? "Salvando..." : "Salvar limiares"}
            </Button>
          </div>
        )}
        {!isOwner && <p className="mt-2 text-2xs text-ink-faint">Só o papel "owner" pode editar os limiares de risco.</p>}
      </form>
    </Panel>
  );
}

/**
 * Épico F2.1 do Plano Diretor ("Calibração por especialidade/porte") —
 * mesmo padrão de NoShowThresholdsPanel acima, aplicado ao limiar de
 * risco de glosa (denial_risk_pct, ver smart_insights_engine.py). Campos
 * PERCENTUAIS (0-100), não frações.
 */
function DenialRiskThresholdsPanel({ tenant, isOwner }: { tenant: Tenant; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [warningInput, setWarningInput] = useState("");
  const [criticalInput, setCriticalInput] = useState("");

  useEffect(() => {
    setWarningInput(tenant.denial_risk_warning_threshold !== null ? String(tenant.denial_risk_warning_threshold) : "");
    setCriticalInput(tenant.denial_risk_critical_threshold !== null ? String(tenant.denial_risk_critical_threshold) : "");
  }, [tenant.denial_risk_warning_threshold, tenant.denial_risk_critical_threshold]);

  const suggestionQuery = useQuery({
    queryKey: ["tenant", "denial-risk-thresholds", "suggested"],
    queryFn: () => apiClient.get<DenialRiskThresholdSuggestion>("/api/v1/tenant/denial-risk-thresholds/suggested"),
    enabled: false,
  });

  function applySuggestion() {
    const suggestion = suggestionQuery.data;
    if (!suggestion || suggestion.warning_threshold === null || suggestion.critical_threshold === null) return;
    setWarningInput(suggestion.warning_threshold.toFixed(1));
    setCriticalInput(suggestion.critical_threshold.toFixed(1));
  }

  const mutation = useMutation({
    mutationFn: (payload: { denial_risk_warning_threshold: number; denial_risk_critical_threshold: number }) =>
      apiClient.patch<Tenant>("/api/v1/tenant", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
      showSuccess("Limiares de risco de glosa atualizados.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const warning = Number(warningInput.replace(",", "."));
    const critical = Number(criticalInput.replace(",", "."));
    if (!Number.isFinite(warning) || !Number.isFinite(critical) || warning <= 0 || critical <= 0 || warning >= 100 || critical >= 100) {
      showError("Informe valores entre 0 e 100.");
      return;
    }
    if (warning >= critical) {
      showError("O limiar de atenção precisa ser menor que o de crítico.");
      return;
    }
    mutation.mutate({ denial_risk_warning_threshold: warning, denial_risk_critical_threshold: critical });
  }

  const usingDefaults = tenant.denial_risk_warning_threshold === null && tenant.denial_risk_critical_threshold === null;

  return (
    <Panel title="Limiares de risco de glosa">
      <form onSubmit={handleSubmit} className="p-4">
        <p className="mb-3.5 max-w-xl text-xs leading-relaxed text-ink-faint">
          Define a partir de qual percentual do faturamento em risco médio/alto o insight de risco de glosa vira
          "atenção" ou "crítico" na Sala de Comando.
        </p>
        {usingDefaults && (
          <p className="-mt-1.5 mb-3.5 text-2xs text-ink-faint">
            Nenhum limiar configurado ainda — usando o padrão do sistema (acima de 15% = atenção, acima de 40% =
            crítico).
          </p>
        )}
        <div className="grid max-w-md grid-cols-2 gap-3">
          <TextField
            label="Atenção a partir de (%)"
            type="number"
            min={0.1}
            max={99}
            step="0.1"
            value={warningInput}
            onChange={(e) => setWarningInput(e.target.value)}
            disabled={!isOwner}
            placeholder="Ex: 15"
            className="mb-0"
          />
          <TextField
            label="Crítico a partir de (%)"
            type="number"
            min={0.1}
            max={99}
            step="0.1"
            value={criticalInput}
            onChange={(e) => setCriticalInput(e.target.value)}
            disabled={!isOwner}
            placeholder="Ex: 40"
            className="mb-0"
          />
        </div>

        {isOwner && (
          <div className="mt-3 rounded-md border border-border-hairline bg-canvas-raised/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xs text-ink-faint">
                Calculado a partir do histórico mensal real de risco de glosa desta clínica, não um valor genérico.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                className="flex shrink-0 items-center gap-1.5"
                onClick={() => suggestionQuery.refetch()}
                disabled={suggestionQuery.isFetching}
              >
                <Sparkles size={12} />
                {suggestionQuery.isFetching ? "Calculando..." : "Sugerir com base no histórico"}
              </Button>
            </div>
            {suggestionQuery.data && suggestionQuery.data.warning_threshold === null && (
              <p className="mt-2 text-2xs text-pending">
                Ainda não há histórico suficiente ({suggestionQuery.data.sample_size} mês(es) fechado(s) — são
                necessários pelo menos 6) para uma sugestão confiável.
              </p>
            )}
            {suggestionQuery.data && suggestionQuery.data.warning_threshold !== null && suggestionQuery.data.critical_threshold !== null && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-2xs text-ink-muted">
                  Sugestão (baseada em {suggestionQuery.data.sample_size} meses): atenção a partir de{" "}
                  <span className="font-mono">{suggestionQuery.data.warning_threshold.toFixed(1)}%</span>, crítico a
                  partir de <span className="font-mono">{suggestionQuery.data.critical_threshold.toFixed(1)}%</span>.
                </p>
                <Button type="button" variant="ghost" size="xs" onClick={applySuggestion}>
                  Preencher campos
                </Button>
              </div>
            )}
          </div>
        )}

        {isOwner && (
          <div className="mt-3 flex justify-end">
            <Button type="submit" disabled={mutation.isPending || !warningInput || !criticalInput}>
              {mutation.isPending ? "Salvando..." : "Salvar limiares"}
            </Button>
          </div>
        )}
        {!isOwner && <p className="mt-2 text-2xs text-ink-faint">Só o papel "owner" pode editar os limiares de risco.</p>}
      </form>
    </Panel>
  );
}

/**
 * Épico F2.1 do Plano Diretor — mesmo padrão, para os DOIS tetos da Nota
 * de Saúde Financeira (ver health_score_engine.py). Campos são FRAÇÕES
 * 0-1 exibidas como percentual, mesma convenção de NoShowThresholdsPanel.
 */
function HealthScoreCeilingsPanel({ tenant, isOwner }: { tenant: Tenant; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [denialInput, setDenialInput] = useState("");
  const [noShowInput, setNoShowInput] = useState("");

  useEffect(() => {
    setDenialInput(tenant.health_score_denial_ceiling !== null ? String(tenant.health_score_denial_ceiling * 100) : "");
    setNoShowInput(tenant.health_score_no_show_ceiling !== null ? String(tenant.health_score_no_show_ceiling * 100) : "");
  }, [tenant.health_score_denial_ceiling, tenant.health_score_no_show_ceiling]);

  const suggestionQuery = useQuery({
    queryKey: ["tenant", "health-score-ceilings", "suggested"],
    queryFn: () => apiClient.get<HealthScoreCeilingSuggestion>("/api/v1/tenant/health-score-ceilings/suggested"),
    enabled: false,
  });

  function applySuggestion() {
    const suggestion = suggestionQuery.data;
    if (!suggestion) return;
    if (suggestion.denial_ceiling !== null) setDenialInput((suggestion.denial_ceiling * 100).toFixed(1));
    if (suggestion.no_show_ceiling !== null) setNoShowInput((suggestion.no_show_ceiling * 100).toFixed(1));
  }

  const mutation = useMutation({
    mutationFn: (payload: { health_score_denial_ceiling: number; health_score_no_show_ceiling: number }) =>
      apiClient.patch<Tenant>("/api/v1/tenant", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
      showSuccess("Tetos da Nota de Saúde Financeira atualizados.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const denial = Number(denialInput.replace(",", "."));
    const noShow = Number(noShowInput.replace(",", "."));
    if (!Number.isFinite(denial) || !Number.isFinite(noShow) || denial <= 0 || noShow <= 0 || denial >= 100 || noShow >= 100) {
      showError("Informe valores entre 0 e 100.");
      return;
    }
    mutation.mutate({ health_score_denial_ceiling: denial / 100, health_score_no_show_ceiling: noShow / 100 });
  }

  const usingDefaults = tenant.health_score_denial_ceiling === null && tenant.health_score_no_show_ceiling === null;

  return (
    <Panel title="Tetos da Nota de Saúde Financeira">
      <form onSubmit={handleSubmit} className="p-4">
        <p className="mb-3.5 max-w-xl text-xs leading-relaxed text-ink-faint">
          A partir de qual taxa de glosa e de falta os componentes correspondentes da Nota de Saúde Financeira já
          valem a pior nota possível (0).
        </p>
        {usingDefaults && (
          <p className="-mt-1.5 mb-3.5 text-2xs text-ink-faint">
            Nenhum teto configurado ainda — usando o padrão do sistema (25% de glosa, 40% de falta).
          </p>
        )}
        <div className="grid max-w-md grid-cols-2 gap-3">
          <TextField
            label="Teto de glosa (%)"
            type="number"
            min={0.1}
            max={99}
            step="0.1"
            value={denialInput}
            onChange={(e) => setDenialInput(e.target.value)}
            disabled={!isOwner}
            placeholder="Ex: 25"
            className="mb-0"
          />
          <TextField
            label="Teto de falta (%)"
            type="number"
            min={0.1}
            max={99}
            step="0.1"
            value={noShowInput}
            onChange={(e) => setNoShowInput(e.target.value)}
            disabled={!isOwner}
            placeholder="Ex: 40"
            className="mb-0"
          />
        </div>

        {isOwner && (
          <div className="mt-3 rounded-md border border-border-hairline bg-canvas-raised/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xs text-ink-faint">
                Calculado a partir do histórico mensal real desta clínica (percentil 90), não um valor genérico.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                className="flex shrink-0 items-center gap-1.5"
                onClick={() => suggestionQuery.refetch()}
                disabled={suggestionQuery.isFetching}
              >
                <Sparkles size={12} />
                {suggestionQuery.isFetching ? "Calculando..." : "Sugerir com base no histórico"}
              </Button>
            </div>
            {suggestionQuery.data && (
              <div className="mt-2 space-y-1 text-2xs">
                <p className="text-ink-muted">
                  Glosa:{" "}
                  {suggestionQuery.data.denial_ceiling !== null ? (
                    <span className="font-mono">{(suggestionQuery.data.denial_ceiling * 100).toFixed(1)}%</span>
                  ) : (
                    <span className="text-pending">
                      sem histórico suficiente ({suggestionQuery.data.denial_ceiling_sample_size}/6 meses)
                    </span>
                  )}
                  {" · "}
                  Falta:{" "}
                  {suggestionQuery.data.no_show_ceiling !== null ? (
                    <span className="font-mono">{(suggestionQuery.data.no_show_ceiling * 100).toFixed(1)}%</span>
                  ) : (
                    <span className="text-pending">
                      sem histórico suficiente ({suggestionQuery.data.no_show_ceiling_sample_size}/6 meses)
                    </span>
                  )}
                </p>
                {(suggestionQuery.data.denial_ceiling !== null || suggestionQuery.data.no_show_ceiling !== null) && (
                  <Button type="button" variant="ghost" size="xs" onClick={applySuggestion}>
                    Preencher campos
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {isOwner && (
          <div className="mt-3 flex justify-end">
            <Button type="submit" disabled={mutation.isPending || !denialInput || !noShowInput}>
              {mutation.isPending ? "Salvando..." : "Salvar tetos"}
            </Button>
          </div>
        )}
        {!isOwner && <p className="mt-2 text-2xs text-ink-faint">Só o papel "owner" pode editar os tetos.</p>}
      </form>
    </Panel>
  );
}

/**
 * Achado da Auditoria Estratégica ("primeiro incremento de enterprise:
 * vinculação self-service de unidades multi-tenant") — antes, agrupar
 * clínicas na mesma Organization (Comparativo multi-unidade, ver
 * OrganizationSummaryPage) só acontecia via ops (create_admin.py).
 * Decisão confirmada com o usuário: manter self-service, mas com uma
 * defesa automática contra fraude adequada a "enterprise" — o backend
 * SÓ vincula quando a raiz do CNPJ (matriz/filial) de quem entra bate
 * com a de quem convidou (ver DECISÃO completa em
 * app/sql/062_organization_invites.sql, backend). Por isso o erro do
 * backend é sempre a MESMA mensagem genérica (código errado, expirado,
 * já usado, ou empresa sem relação nenhuma) — nunca revelamos aqui qual
 * desses casos é, mesmo princípio anti-enumeração do restante do
 * produto (ex: login).
 */
function OrganizationLinkingPanel({ isOwner }: { isOwner: boolean }) {
  const { showSuccess, showError } = useToast();
  const [invite, setInvite] = useState<OrganizationInviteResponse | null>(null);
  const [joinCode, setJoinCode] = useState("");

  const inviteMutation = useMutation({
    mutationFn: () => apiClient.post<OrganizationInviteResponse>("/api/v1/tenant/organization/invite"),
    onSuccess: (data) => setInvite(data),
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const joinMutation = useMutation({
    mutationFn: (code: string) => apiClient.post<OrganizationJoinResponse>("/api/v1/tenant/organization/join", { code }),
    onSuccess: (data) => {
      showSuccess(`Vinculado à organização "${data.organization_name}" com sucesso.`);
      setJoinCode("");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  async function handleCopy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      showSuccess("Código copiado.");
    } catch {
      showError("Não foi possível copiar o código automaticamente — selecione e copie manualmente.");
    }
  }

  function handleJoinSubmit(e: FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    joinMutation.mutate(joinCode.trim());
  }

  if (!isOwner) {
    return (
      <Panel title="Vincular outra unidade">
        <div className="p-4">
          <p className="text-2xs text-ink-faint">Só o papel "owner" pode gerar convites ou vincular esta clínica a uma organização.</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Vincular outra unidade">
      <div className="space-y-5 p-4">
        <p className="max-w-xl text-xs leading-relaxed text-ink-faint">
          Se sua clínica tem mais de uma unidade (matriz/filial do mesmo grupo), vincule-as para ver o comparativo
          consolidado entre elas na tela "Comparativo entre unidades". Gere um código aqui e passe para quem
          administra a outra unidade — ela entra com o código na própria tela "Minha clínica".
        </p>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-ink">Gerar código de convite</span>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              className="flex shrink-0 items-center gap-1.5"
              onClick={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending}
            >
              <Link2 size={12} />
              {inviteMutation.isPending ? "Gerando..." : "Gerar novo código"}
            </Button>
          </div>
          {invite && (
            <div className="rounded-md border border-border-hairline bg-canvas-raised/40 p-3">
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={invite.code}
                  onFocus={(e) => e.target.select()}
                  className="w-full rounded-md border border-border-default bg-canvas-raised px-3 py-2 font-mono text-xs text-ink"
                />
                <Button type="button" variant="secondary" size="xs" onClick={handleCopy} className="flex shrink-0 items-center gap-1">
                  <Copy size={12} />
                  Copiar
                </Button>
              </div>
              <p className="mt-2 text-2xs text-ink-faint">
                Válido até {formatDateTime(invite.expires_at)}. Só funciona para uma unidade com a MESMA raiz de CNPJ
                (os 8 primeiros dígitos) desta clínica — a verificação é automática, um código sozinho não é
                suficiente.
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleJoinSubmit} className="border-t border-border-hairline pt-4">
          <span className="mb-2 block text-xs font-medium text-ink">Entrar com um código recebido</span>
          <div className="flex max-w-md items-end gap-3">
            <TextField
              label="Código de convite"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Cole aqui o código recebido"
              className="mb-0 flex-1"
            />
            <Button type="submit" disabled={joinMutation.isPending || !joinCode.trim()}>
              {joinMutation.isPending ? "Vinculando..." : "Vincular"}
            </Button>
          </div>
        </form>
      </div>
    </Panel>
  );
}

export function TenantPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => apiClient.get<Tenant>("/api/v1/tenant"),
  });

  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [specialty, setSpecialty] = useState("");

  useEffect(() => {
    if (tenant) {
      setLegalName(tenant.legal_name);
      setTradeName(tenant.trade_name);
      setSpecialty(tenant.specialty ?? "");
    }
  }, [tenant]);

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.patch<Tenant>("/api/v1/tenant", { legal_name: legalName, trade_name: tradeName, specialty }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
      showSuccess("Dados da clínica atualizados.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2}
        title="Minha clínica"
        subtitle="Dados cadastrais e configuração da conta — visível apenas para proprietário(a) e administrador(a)."
      />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}

      {tenant && (
        <div className="space-y-4">
          <Panel title="Dados da clínica">
            <form onSubmit={handleSubmit} className="p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField label="Razão social" required value={legalName} onChange={(e) => setLegalName(e.target.value)} disabled={!isOwner} className="mb-0" />
                <TextField label="Nome fantasia" required value={tradeName} onChange={(e) => setTradeName(e.target.value)} disabled={!isOwner} className="mb-0" />
                <TextField label="CNPJ" value={tenant.cnpj} disabled className="mb-0" />
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-muted">Plano</label>
                  <Badge tone="accent">{PLAN_LABELS[tenant.plan_tier] ?? tenant.plan_tier}</Badge>
                </div>
                <TextField
                  label="Especialidade predominante"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  disabled={!isOwner}
                  placeholder="Ex: odontologia, psicologia, clínica geral"
                  className="mb-0"
                />
              </div>
              <p className="mt-1.5 text-2xs text-ink-faint">
                Contexto descritivo — hoje não seleciona nenhum benchmark automático de mercado (a Insighta ainda não
                tem esse dado real e validado por especialidade). Os limiares abaixo continuam calibrados pelo
                histórico da sua própria clínica.
              </p>
              <p className="mt-4 text-2xs text-ink-faint">CNPJ não pode ser alterado por aqui — fale com o suporte.</p>
              {isOwner && (
                <div className="mt-3 flex justify-end">
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? "Salvando..." : "Salvar alterações"}
                  </Button>
                </div>
              )}
              {!isOwner && <p className="mt-3 text-2xs text-ink-faint">Só o papel “owner” pode editar os dados cadastrais.</p>}
            </form>
          </Panel>

          <SubscriptionPlanPanel tenant={tenant} isOwner={isOwner} />
          <OrganizationLinkingPanel isOwner={isOwner} />
          <AnnualGoalPanel tenant={tenant} isOwner={isOwner} />
          <NoShowThresholdsPanel tenant={tenant} isOwner={isOwner} />
          <DenialRiskThresholdsPanel tenant={tenant} isOwner={isOwner} />
          <HealthScoreCeilingsPanel tenant={tenant} isOwner={isOwner} />
        </div>
      )}
    </div>
  );
}
