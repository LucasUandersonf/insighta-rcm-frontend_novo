import { useQuery } from "@tanstack/react-query";
import { Panel } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { PlanLossRanking } from "@/lib/types";

// Sem centavos de propósito — este é o cartão de "escaneio rápido" do
// canvas de design (lista de barra compacta, valor arredondado), não o
// número contábil exato; quem precisa do valor exato tem os 3
// componentes de perda detalhados na Sala de Comando e no
// ExecutiveSummary. Ver canvas de design, Painel.dc.html.
function formatCurrencyCompact(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

const MAX_ROWS = 5;

/**
 * Painel → Faturamento: uma das 3 colunas da seção de rankings (ao
 * lado de ContractUtilizationPanel e DenialRiskDistributionPanel) — ver
 * canvas de design, Painel.dc.html. Lista de barra compacta, não
 * gráfico/tabela: o canvas trata isso como um "escaneio rápido" de qual
 * convênio pesa mais, não como o lugar de decompor a perda em cobrança/
 * recebimento/glosa (essa quebra já existe na Sala de Comando e no
 * ExecutiveSummary, ver DECISÃO anterior).
 */
export function PlanLossRankingPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "plan-loss-ranking", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<PlanLossRanking>(`/api/v1/analytics/plan-loss-ranking?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  const plans = (data?.plans ?? []).slice(0, MAX_ROWS);
  const maxLoss = Math.max(...plans.map((p) => p.total_loss), 1);

  return (
    <Panel title="Ranking de perda por convênio" subtitle="Maior perda primeiro">
      {isLoading && (
        <div className="space-y-3 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[7px] animate-pulse rounded-full bg-canvas-raised" />
          ))}
        </div>
      )}
      {error && <p className="p-5 text-xs text-denied">{getApiErrorMessage(error)}</p>}
      {!isLoading && !error && plans.length === 0 && (
        <p className="p-5 text-xs text-ink-faint">Nenhuma perda financeira identificada por convênio nesta janela.</p>
      )}
      {!isLoading && plans.length > 0 && (
        <div className="space-y-3 p-5">
          {plans.map((plan) => (
            <div key={plan.plan_name} className="flex items-center gap-3">
              <span className="w-[168px] shrink-0 truncate text-[12.5px] text-ink-muted">{plan.plan_name}</span>
              <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-canvas-raised">
                <div className="h-full rounded-full bg-denied" style={{ width: `${(plan.total_loss / maxLoss) * 100}%` }} />
              </div>
              <span className="tabular w-16 shrink-0 text-right text-xs text-ink">{formatCurrencyCompact(plan.total_loss)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
