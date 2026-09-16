import { useQuery } from "@tanstack/react-query";
import { Panel } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { DailySummary } from "@/lib/types";

/**
 * Onda 6 do Plano de Ação, item 18 ("resumo diário narrado") — não é
 * uma fonte de dado nova: compõe em texto corrido o que já existe
 * espalhado em telas diferentes (faturamento, agenda, carteira
 * inativa, priorização de convênio). Sempre HOJE, sem seletor de
 * período — primeira coisa que aparece na aba "Hoje".
 */
export function DailySummaryPanel() {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["analytics", "daily-summary"],
    queryFn: () => apiClient.get<DailySummary>("/api/v1/analytics/daily-summary"),
  });

  return (
    <Panel title="Resumo de hoje" updatedAt={dataUpdatedAt || null}>
      {isLoading && <div className="m-5 h-16 animate-pulse rounded-md bg-canvas-raised" />}
      {error && <p className="p-5 text-xs text-denied">{getApiErrorMessage(error)}</p>}
      {!isLoading && !error && data && (
        <div className="space-y-2 p-5">
          <p className="text-sm font-medium text-ink">{data.headline}</p>
          {data.sentences.length > 1 && (
            <ul className="space-y-1.5 text-xs text-ink-muted">
              {data.sentences.slice(1).map((sentence, i) => (
                <li key={i}>{sentence}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}
