import { useQuery } from "@tanstack/react-query";
import { Panel } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { cn } from "@/lib/cn";
import type { DataQuality } from "@/lib/types";

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

// Mesmo espírito de CONFIRMED_LIFT_THRESHOLD em
// DenialReasonConfirmationPanel.tsx: um corte de DESTAQUE visual (quem
// merece uma cor de alerta na lista), não uma meta oficial do produto —
// abaixo disso, boa parte do que o atendente lança já nasce sem CID ou
// procedimento, a fonte mais comum de risco de glosa por dado ausente.
const LOW_COMPLETION_THRESHOLD = 0.7;

function rateToneClass(rate: number): string {
  return rate < LOW_COMPLETION_THRESHOLD ? "text-denied" : "text-ink-muted";
}

/**
 * Painel → Faturamento: "quem está lançando atendimento incompleto?" —
 * Épico F2.2 do Plano Diretor ("Qualidade de dado na origem"). Em vez de
 * só reagir à glosa depois de acontecer, mostra por atendente a taxa de
 * atendimento já lançado com CID + procedimento preenchidos — o dado que
 * mais alimenta risco de glosa quando ausente (ver
 * denial_risk_engine._rule_missing_cid/_rule_missing_procedure_code).
 * Ordenado do pior pro melhor: quem mais precisa de atenção/treinamento
 * aparece primeiro.
 */
export function DataQualityPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["analytics", "data-quality", dateFrom, dateTo],
    queryFn: () => apiClient.get<DataQuality>(`/api/v1/analytics/data-quality?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  return (
    <Panel
      title="Qualidade de cadastro por atendente"
      subtitle="Atendimentos lançados já completos (CID + procedimento)"
      updatedAt={dataUpdatedAt || null}
    >
      {isLoading && (
        <div className="space-y-3 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-3.5 animate-pulse rounded bg-canvas-raised" />
          ))}
        </div>
      )}
      {error && <p className="p-5 text-xs text-denied">{getApiErrorMessage(error)}</p>}
      {!isLoading && !error && data && data.items.length === 0 && (
        <p className="p-5 text-xs text-ink-faint">
          Nenhum atendente com amostra suficiente ainda (mínimo {data.min_sample ?? 5} atendimentos lançados no
          período).
        </p>
      )}
      {!isLoading && data && data.items.length > 0 && (
        <div className="space-y-2.5 p-5">
          {data.overall_completion_rate !== null && (
            <div className="flex items-center justify-between gap-3 border-b border-border-hairline pb-2.5">
              <span className="text-[12.5px] text-ink-muted">Geral (todos os atendentes)</span>
              <span className="tabular text-xs font-medium text-ink">{formatPct(data.overall_completion_rate)}</span>
            </div>
          )}
          {data.items.map((item) => (
            <div key={item.user_id} className="flex items-center justify-between gap-3">
              <span className="truncate text-[12.5px] text-ink-muted" title={item.full_name}>
                {item.full_name}
                <span className="ml-1.5 text-2xs text-ink-faint">
                  ({item.complete_count}/{item.total_count})
                </span>
              </span>
              <span className={cn("tabular shrink-0 text-xs font-medium", rateToneClass(item.completion_rate))}>
                {formatPct(item.completion_rate)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
