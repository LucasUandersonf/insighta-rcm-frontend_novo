import { useQuery } from "@tanstack/react-query";
import { Panel } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { ContractUtilization } from "@/lib/types";

const MAX_ROWS = 5;

/**
 * Painel → Faturamento: segunda das 3 colunas da seção de rankings (ver
 * canvas de design, Painel.dc.html) — lista de barra compacta com o
 * gradiente de marca (não tiers de cor por faixa: aqui o canvas usa a
 * MESMA cor pra todas as barras, diferente do card antigo desta tela,
 * que tinha uma cor por faixa de aproveitamento). Ordenado pelo próprio
 * backend do pior para o melhor (ver AnalyticsRepository.contract_utilization).
 */
export function ContractUtilizationPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "contract-utilization", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<ContractUtilization>(`/api/v1/analytics/contract-utilization?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  const contracts = (data?.contracts ?? []).slice(0, MAX_ROWS);

  return (
    <Panel title="Utilização de contrato" subtitle="% já coberto por tabela homologada">
      {isLoading && (
        <div className="space-y-3 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[7px] animate-pulse rounded-full bg-canvas-raised" />
          ))}
        </div>
      )}
      {error && <p className="p-5 text-xs text-denied">{getApiErrorMessage(error)}</p>}
      {!isLoading && !error && contracts.length === 0 && (
        <p className="p-5 text-xs text-ink-faint">Nenhum contrato homologado com itens cadastrados.</p>
      )}
      {!isLoading && contracts.length > 0 && (
        <div className="space-y-3 p-5">
          {contracts.map((contract) => (
            <div key={contract.contract_id} className="flex items-center gap-3">
              <span className="w-[168px] shrink-0 truncate text-[12.5px] text-ink-muted">{contract.plan_name}</span>
              <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-canvas-raised">
                <div className="h-full rounded-full bg-aura-line" style={{ width: `${Math.min(contract.utilization_pct, 100)}%` }} />
              </div>
              <span className="tabular w-16 shrink-0 text-right text-xs text-ink">{contract.utilization_pct.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
