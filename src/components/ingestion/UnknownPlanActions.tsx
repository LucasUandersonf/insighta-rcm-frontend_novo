import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type { InsurancePlan, ResolveByNameResponse } from "@/lib/types";

/**
 * UX-06/UX-07/UX-08: o que resolve um “convênio não cadastrado”, no próprio
 * lugar onde o problema aparece — cadastrar com esse nome ou dizer que é
 * outro nome de um convênio que a clínica já tem. Todas as linhas com o mesmo
 * texto entram de uma vez.
 */
export function UnknownPlanActions({
  rawValue,
  suggestedPlanId,
  suggestedPlanName,
  onResolved,
}: {
  rawValue: string;
  suggestedPlanId?: string | null;
  suggestedPlanName?: string | null;
  onResolved?: () => void;
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [choosing, setChoosing] = useState(false);
  const [planId, setPlanId] = useState(suggestedPlanId ?? "");
  const { data: plans } = useQuery({
    queryKey: ["insurance-plans"],
    queryFn: () => apiClient.get<InsurancePlan[]>("/api/v1/insurance-companies/plans"),
    enabled: choosing,
  });

  const resolve = useMutation({
    mutationFn: (body: { create?: boolean; insurance_plan_id?: string }) =>
      apiClient.post<ResolveByNameResponse>("/api/v1/ingestion/rejected/resolve-by-name", { raw_value: rawValue, ...body }, { timeoutMs: 5 * 60_000 }),
    onSuccess: (result) => {
      // Contagens do histórico, relatório, pendências e números das telas mudam.
      queryClient.invalidateQueries();
      showSuccess(result.message);
      setChoosing(false);
      onResolved?.();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  if (resolve.isPending) {
    return (
      <p role="status" className="text-2xs text-ink-muted">
        Trazendo as linhas de “{rawValue}” para o sistema… pode levar alguns segundos em arquivos grandes.
      </p>
    );
  }

  if (choosing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`plan-${rawValue}`}>
          Convênio já cadastrado
        </label>
        <select
          id={`plan-${rawValue}`}
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          className="h-8 rounded-md border border-border-default bg-canvas-raised px-2 text-xs text-ink"
        >
          <option value="">Qual convênio é?</option>
          {(plans ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
        <Button type="button" size="xs" disabled={!planId} onClick={() => resolve.mutate({ insurance_plan_id: planId })}>
          Confirmar
        </Button>
        <Button type="button" size="xs" variant="ghost" onClick={() => setChoosing(false)}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {suggestedPlanId && suggestedPlanName ? (
        <Button type="button" size="xs" onClick={() => resolve.mutate({ insurance_plan_id: suggestedPlanId })}>
          É o convênio “{suggestedPlanName}”
        </Button>
      ) : null}
      <Button type="button" size="xs" variant={suggestedPlanId ? "secondary" : "primary"} onClick={() => resolve.mutate({ create: true })}>
        Cadastrar “{rawValue}”
      </Button>
      <Button type="button" size="xs" variant="ghost" onClick={() => setChoosing(true)}>
        É outro nome de um convênio que já tenho
      </Button>
    </div>
  );
}
