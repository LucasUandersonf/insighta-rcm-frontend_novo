import { useQuery } from "@tanstack/react-query";
import { Panel } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { AgendaPlanPriority } from "@/lib/types";

function formatCurrencyCompact(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

/**
 * Painel → Agenda: Onda 4 do Plano de Ação, item 14 — evolução do PMR
 * (PaymentLagPanel): não só reporta prazo de recebimento por convênio,
 * RECOMENDA qual priorizar ao encaixar um paciente novo/de retorno.
 * Ver DECISÃO completa em AnalyticsService.get_agenda_plan_priority
 * (backend) — combinação por ranking, não fórmula ponderada.
 */
export function AgendaPlanPriorityPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["analytics", "agenda-plan-priority", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<AgendaPlanPriority>(`/api/v1/analytics/agenda-plan-priority?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  const items = data?.items ?? [];
  const top = items[0];

  return (
    <Panel
      title="Priorização de agenda por convênio"
      subtitle="Qual convênio priorizar ao encaixar um paciente novo, combinando prazo de recebimento e perda financeira"
      updatedAt={dataUpdatedAt || null}
    >
      {isLoading && (
        <div className="space-y-3 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded-md bg-canvas-raised" />
          ))}
        </div>
      )}
      {error && <p className="p-5 text-xs text-denied">{getApiErrorMessage(error)}</p>}
      {!isLoading && !error && items.length === 0 && (
        <p className="p-5 text-xs text-ink-faint">Nenhum convênio com prazo de recebimento calculável nesta janela.</p>
      )}
      {!isLoading && items.length > 0 && (
        <div className="space-y-3 p-5">
          {top && (
            <p className="text-xs text-ink">
              Priorize <span className="font-medium text-revenue">{top.insurance_plan_name}</span> — melhor combinação de
              prazo de recebimento ({top.avg_days_to_receive.toFixed(0)} dias) e perda financeira ({formatCurrencyCompact(top.total_loss)}).
            </p>
          )}
          <ol className="space-y-2">
            {items.map((item) => (
              <li
                key={item.insurance_plan_id}
                className="flex items-center justify-between gap-3 rounded-md border border-border-hairline bg-canvas-raised/40 px-3 py-2"
              >
                <span className="flex items-center gap-2 truncate text-sm text-ink">
                  <span className="tabular shrink-0 text-xs text-ink-faint">#{item.priority_rank}</span>
                  <span className="truncate">{item.insurance_plan_name}</span>
                </span>
                <span className="shrink-0 text-right text-xs text-ink-faint">
                  {item.avg_days_to_receive.toFixed(0)} dias · {formatCurrencyCompact(item.total_loss)} em perda
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Panel>
  );
}
