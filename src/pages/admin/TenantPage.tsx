import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Sparkles } from "lucide-react";
import { Panel, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import type { NoShowThresholdSuggestion, Tenant } from "@/lib/types";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
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

export function TenantPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => apiClient.get<Tenant>("/api/v1/tenant"),
  });

  const { data: availablePlans } = useQuery({
    queryKey: ["tenant", "plans"],
    queryFn: () => apiClient.get<string[]>("/api/v1/tenant/plans/available"),
  });

  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");

  useEffect(() => {
    if (tenant) {
      setLegalName(tenant.legal_name);
      setTradeName(tenant.trade_name);
    }
  }, [tenant]);

  const mutation = useMutation({
    mutationFn: () => apiClient.patch<Tenant>("/api/v1/tenant", { legal_name: legalName, trade_name: tradeName }),
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
              </div>
              <p className="mt-4 text-2xs text-ink-faint">
                CNPJ não pode ser alterado por aqui — fale com o suporte. Para alterar de plano
                {(availablePlans ?? []).length > 0 && <> (disponíveis: {(availablePlans ?? []).map((t) => PLAN_LABELS[t] ?? t).join(", ")})</>},
                fale com o time comercial — mudança de assinatura ainda não é self-service neste MVP.
              </p>
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

          <AnnualGoalPanel tenant={tenant} isOwner={isOwner} />
          <NoShowThresholdsPanel tenant={tenant} isOwner={isOwner} />
        </div>
      )}
    </div>
  );
}
