import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { Panel, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import type { Tenant } from "@/lib/types";

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
    <Panel
      title="Meta de Faturamento Anual"
      subtitle="Definida por vocês — o sistema nunca calcula essa meta sozinho, só compara o faturamento real com ela."
    >
      <form onSubmit={handleSubmit} className="p-4">
        {tenant.annual_revenue_goal !== null && (
          <p className="mb-3 text-sm text-ink-muted">
            Meta atual: <span className="font-mono font-medium text-ink">{formatCurrency(tenant.annual_revenue_goal)}</span>
          </p>
        )}
        {tenant.annual_revenue_goal === null && (
          <p className="mb-3 text-xs text-ink-faint">
            Nenhuma meta configurada ainda — sem ela, a Sala de Comando não mostra o insight de desempenho anual.
          </p>
        )}
        <TextField
          label="Nova meta anual (R$)"
          type="number"
          min={0.01}
          step="0.01"
          value={goalInput}
          onChange={(e) => setGoalInput(e.target.value)}
          disabled={!isOwner}
          placeholder="Ex: 1200000.00"
        />
        {isOwner && (
          <div className="mt-2 flex justify-end">
            <Button type="submit" disabled={mutation.isPending || !goalInput}>
              {mutation.isPending ? "Salvando..." : "Salvar meta"}
            </Button>
          </div>
        )}
        {!isOwner && <p className="text-2xs text-ink-faint">Só o papel "owner" pode editar a meta de faturamento.</p>}
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
      <PageHeader icon={Building2} title="Minha Clínica" subtitle="Dados cadastrais, plano de assinatura e meta de faturamento anual." />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}

      {tenant && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <Panel title="Dados cadastrais" subtitle="CNPJ não pode ser alterado por aqui — fale com o suporte.">
            <form onSubmit={handleSubmit} className="p-4">
              <TextField label="Razão social" required value={legalName} onChange={(e) => setLegalName(e.target.value)} disabled={!isOwner} />
              <TextField label="Nome fantasia" required value={tradeName} onChange={(e) => setTradeName(e.target.value)} disabled={!isOwner} />
              <TextField label="CNPJ" value={tenant.cnpj} disabled />
              {isOwner && (
                <div className="mt-2 flex justify-end">
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? "Salvando..." : "Salvar alterações"}
                  </Button>
                </div>
              )}
              {!isOwner && <p className="text-2xs text-ink-faint">Só o papel “owner” pode editar os dados cadastrais.</p>}
            </form>
          </Panel>
          </div>

          <div className="lg:col-span-6">
          <Panel title="Plano e Assinatura">
            <div className="p-4">
              <p className="text-2xs uppercase tracking-wide text-ink-faint">Plano atual</p>
              <p className="mb-4 text-lg font-semibold text-revenue">{PLAN_LABELS[tenant.plan_tier] ?? tenant.plan_tier}</p>
              <p className="mb-2 text-2xs uppercase tracking-wide text-ink-faint">Planos disponíveis</p>
              <ul className="space-y-1 text-sm text-ink-muted">
                {(availablePlans ?? []).map((tier) => (
                  <li key={tier} className={tier === tenant.plan_tier ? "font-medium text-ink" : ""}>
                    {PLAN_LABELS[tier] ?? tier}
                    {tier === tenant.plan_tier && <span className="ml-1.5 text-2xs text-revenue">(atual)</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-2xs text-ink-faint">
                Para alterar de plano, fale com o time comercial — mudança de assinatura ainda não é self-service neste MVP.
              </p>
            </div>
          </Panel>
          </div>

          <div className="lg:col-span-12">
            <AnnualGoalPanel tenant={tenant} isOwner={isOwner} />
          </div>
        </div>
      )}
    </div>
  );
}
