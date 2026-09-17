import { useQuery } from "@tanstack/react-query";
import { KpiCard } from "@/components/ui/KpiCard";
import { LoadingState, ErrorState } from "@/components/ui/Panel";
import { InactivePatientsPanel } from "@/components/dashboard/InactivePatientsPanel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { CrmSummary } from "@/lib/types";

function formatPct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

/**
 * Aba CRM (Roadmap "Rumo à Nota 9", Fase 5) — pedido direto do usuário:
 * "ninguém sabe a média de idade dos pacientes, ninguém sabe quanto
 * tempo os pacientes estão sem ir à unidade... precisamos ter
 * basicamente um CRM porque ajuda o cliente a ganhar dinheiro, achar
 * oportunidades". Junta os números que faltavam (idade média, dias sem
 * visita, taxa de retorno) com a Carteira de Inativos, que antes vivia
 * dentro do Diagnóstico (ver DECISÃO em smart_insights_engine.py::
 * _annual_goal_insight — o botão "Ver quem não voltou" agora troca pra
 * esta aba, "#tab:crm", em vez de rolar até uma seção do Diagnóstico).
 */
export function CrmPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "crm-summary"],
    queryFn: () => apiClient.get<CrmSummary>("/api/v1/analytics/crm-summary"),
  });

  return (
    <div className="space-y-6">
      {isLoading && <LoadingState variant="cards" rows={3} />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}

      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-12">
          <KpiCard
            colSpan={4}
            label="Idade média da carteira"
            value={data.avg_patient_age_years !== null ? `${data.avg_patient_age_years.toFixed(0)} anos` : "—"}
            numericValue={data.avg_patient_age_years ?? undefined}
            format={(n) => `${n.toFixed(0)} anos`}
            tone="neutral"
            narrative={data.avg_patient_age_years === null ? "Nenhum paciente com data de nascimento cadastrada ainda." : undefined}
          />
          <KpiCard
            colSpan={4}
            label="Tempo médio sem visita"
            value={data.avg_days_since_last_visit !== null ? `${data.avg_days_since_last_visit.toFixed(0)} dias` : "—"}
            numericValue={data.avg_days_since_last_visit ?? undefined}
            format={(n) => `${n.toFixed(0)} dias`}
            tone={data.avg_days_since_last_visit !== null && data.avg_days_since_last_visit > 180 ? "pending" : "neutral"}
          />
          <KpiCard
            colSpan={4}
            label="Taxa de retorno"
            value={data.return_rate !== null ? formatPct(data.return_rate) : "—"}
            numericValue={data.return_rate ?? undefined}
            format={formatPct}
            tone="neutral"
            narrative={
              data.return_rate !== null
                ? `Sobre ${data.return_rate_sample_size} atendimento(s) com tipo de visita identificado.`
                : "Nenhum atendimento com tipo de visita (primeira consulta/retorno) preenchido ainda."
            }
          />
        </div>
      )}

      <InactivePatientsPanel />
    </div>
  );
}
