import { useQuery } from "@tanstack/react-query";
import { KpiCard } from "@/components/ui/KpiCard";
import { LoadingState, ErrorState } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { PepConformidade } from "@/lib/types";

/**
 * Aba Clínico dedicada (Sala de Comando 3.0, achado do Comitê de
 * Liderança Tecnológica "5 pernas") — conformidade assistencial do PEP
 * (Prontuário Eletrônico do Paciente), até aqui só existia como texto
 * de insight no feed (`_pep_documentation_gap_insight`/
 * `_pep_cid_completeness_insight`, backend) — aqui os mesmos dois
 * números aparecem como KPI de conferência, igual ao padrão de
 * "Números do período" da aba Diagnóstico.
 */
export function PepConformidadePanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "pep-conformidade", dateFrom, dateTo],
    queryFn: () => apiClient.get<PepConformidade>(`/api/v1/analytics/pep-conformidade?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  if (isLoading) return <LoadingState variant="cards" rows={2} />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <KpiCard
        label="Atendimentos sem evolução clínica"
        value={data.missing_documentation_pct !== null ? `${data.missing_documentation_pct.toFixed(0)}%` : "—"}
        numericValue={data.missing_documentation_pct ?? undefined}
        format={(n) => `${n.toFixed(0)}%`}
        tone={data.missing_documentation_pct !== null && data.missing_documentation_pct >= 15 ? "pending" : "neutral"}
        narrative={
          data.completed_encounters_count > 0
            ? `${data.missing_documentation_count} de ${data.completed_encounters_count} atendimento(s) concluído(s) no período sem nenhuma evolução registrada no prontuário.`
            : "Nenhum atendimento concluído neste período."
        }
      />
      <KpiCard
        label="Evoluções sem CID principal"
        value={data.missing_cid_pct !== null ? `${data.missing_cid_pct.toFixed(0)}%` : "—"}
        numericValue={data.missing_cid_pct ?? undefined}
        format={(n) => `${n.toFixed(0)}%`}
        tone={data.missing_cid_pct !== null && data.missing_cid_pct >= 40 ? "pending" : "neutral"}
        narrative={
          data.evolutions_count > 0
            ? `${data.missing_cid_count} de ${data.evolutions_count} evolução(ões) clínica(s) registrada(s) no período sem o código da doença preenchido.`
            : "Nenhuma evolução clínica registrada neste período."
        }
      />
    </div>
  );
}
