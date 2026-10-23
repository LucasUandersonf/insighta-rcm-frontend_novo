import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { brl } from "@/components/money/PreSubmissionIssues";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import type { PlanWithholding, WithholdingOverview, WithholdingRates } from "@/lib/types";

const KEY = ["financeiro", "retencoes"] as const;
const CAN_WRITE = ["owner", "admin", "financeiro"];
const TAXES: { key: keyof WithholdingRates; label: string }[] = [
  { key: "irrf", label: "IRRF" },
  { key: "pis", label: "PIS" },
  { key: "cofins", label: "COFINS" },
  { key: "csll", label: "CSLL" },
  { key: "iss", label: "ISS" },
];

function pct(value: number): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function total(rates: WithholdingRates): number {
  return TAXES.reduce((sum, t) => sum + rates[t.key], 0);
}

function breakdown(rates: WithholdingRates): string {
  return TAXES.filter((t) => rates[t.key] > 0)
    .map((t) => `${t.label} ${pct(rates[t.key])}`)
    .join(" · ");
}

function PlanRow({ plan, canWrite }: { plan: PlanWithholding; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<WithholdingRates>(plan.confirmed ?? plan.suggested);
  const confirm = useMutation({
    mutationFn: (rates: WithholdingRates) => apiClient.put(`/api/v1/financeiro/retencoes/${plan.plan_id}`, rates),
    onSuccess: () => {
      showSuccess(`Retenção de ${plan.plan_name} confirmada. O Caixa 13 semanas passa a mostrar o valor líquido.`);
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: KEY });
      void queryClient.invalidateQueries({ queryKey: ["financeiro", "caixa-13-semanas"] });
      void queryClient.invalidateQueries({ queryKey: ["financeiro", "ponte"] });
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });
  const shown = plan.confirmed ?? plan.suggested;

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium text-ink">{plan.plan_name}</span>
        <span className="text-2xs text-ink-faint">{brl(plan.billed_90d)} faturados em 90 dias</span>
        <span className="ml-auto text-sm tabular text-ink">
          {plan.confirmed ? `Retém ${pct(total(plan.confirmed))}` : `Sugestão: ${pct(total(plan.suggested))}`}
        </span>
      </div>
      <p className="text-xs text-ink-muted">
        {breakdown(shown) || "Sem retenção"}
        {plan.observed_pct !== null && ` · nas ${plan.observed_count} contas pagas, o convênio reteve em média ${pct(plan.observed_pct)}`}
        {!plan.confirmed && plan.suggestion_source === "padrao" && " · sugestão pelo padrão legal (sem histórico suficiente)"}
      </p>
      {canWrite && !editing && (
        <div className="flex gap-2">
          {!plan.confirmed && (
            <Button size="xs" disabled={confirm.isPending} onClick={() => confirm.mutate(plan.suggested)}>
              {confirm.isPending ? "Salvando…" : "Confirmar sugestão"}
            </Button>
          )}
          <Button size="xs" variant="secondary" onClick={() => setEditing(true)}>
            {plan.confirmed ? "Alterar" : "Ajustar"}
          </Button>
        </div>
      )}
      {editing && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            confirm.mutate(values);
          }}
        >
          {TAXES.map((t) => (
            <label key={t.key} className="flex flex-col text-2xs text-ink-faint">
              {t.label} (%)
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={values[t.key]}
                onChange={(e) => setValues((v) => ({ ...v, [t.key]: Number(e.target.value) }))}
                className="w-20 rounded-md border border-border-subtle bg-canvas px-2 py-1 text-sm text-ink"
              />
            </label>
          ))}
          <Button size="xs" type="submit" disabled={confirm.isPending}>
            Confirmar {pct(total(values))}
          </Button>
          <Button size="xs" variant="secondary" type="button" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </form>
      )}
    </li>
  );
}

/**
 * Retenções na fonte por convênio: o imposto que o convênio desconta antes
 * de pagar. Uma confirmação por convênio, com o valor já sugerido pelo que
 * ele de fato reteve; a partir dela o Caixa e a ponte faturado → recebido
 * saem líquidos, e o "pagou menos" deixa de contar o imposto.
 */
export function WithholdingPanel() {
  const { user } = useAuth();
  const canWrite = !!user && CAN_WRITE.includes(user.role);
  const { data, isLoading, error } = useQuery({
    queryKey: KEY,
    queryFn: () => apiClient.get<WithholdingOverview>("/api/v1/financeiro/retencoes"),
    retry: false,
  });
  const pending = data?.plans.filter((p) => !p.confirmed).length ?? 0;

  return (
    <Panel
      title="Retenções na fonte"
      subtitle="O convênio desconta IRRF, PIS, COFINS, CSLL e, em alguns municípios, ISS antes de pagar. Confirme uma vez por convênio; confira com seu contador."
    >
      <div className="px-6 py-5">
        {isLoading && <LoadingState />}
        {error && <ErrorState message={getApiErrorMessage(error)} />}
        {data && data.plans.length === 0 && <EmptyState message="Nenhum convênio com faturamento nos últimos 90 dias." />}
        {data && data.plans.length > 0 && (
          <>
            {pending > 0 && (
              <p className="mb-2 text-xs text-ink-muted">
                {pending} {pending === 1 ? "convênio ainda sem retenção confirmada" : "convênios ainda sem retenção confirmada"}: até lá,
                o Caixa mostra o valor bruto.
              </p>
            )}
            <ul className="divide-y divide-border-hairline">
              {data.plans.map((plan) => (
                <PlanRow key={plan.plan_id} plan={plan} canWrite={canWrite} />
              ))}
            </ul>
          </>
        )}
      </div>
    </Panel>
  );
}
