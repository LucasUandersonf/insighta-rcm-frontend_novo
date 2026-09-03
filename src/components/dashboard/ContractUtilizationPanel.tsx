import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { cn } from "@/lib/cn";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { ContractUtilization, ContractUtilizationItem } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${iso}T00:00:00`));
}

// Mesmos 3 patamares de "saudável" já usados em outros lugares do
// sistema (ex: avgNoShowRate em AgendaAnalyticsPanel usa 20% como corte
// único) — aqui com 2 cortes porque utilização é um espectro maior:
// abaixo de 50% é capacidade contratada praticamente parada, entre
// 50-80% é uso parcial (esperado ter alguma folga), acima de 80% é
// bem aproveitado.
function utilizationTone(pct: number): "denied" | "pending" | "revenue" {
  if (pct < 50) return "denied";
  if (pct < 80) return "pending";
  return "revenue";
}

const TONE_BAR_CLASS: Record<ReturnType<typeof utilizationTone>, string> = {
  denied: "bg-denied",
  pending: "bg-pending",
  revenue: "bg-revenue",
};

const TONE_TEXT_CLASS: Record<ReturnType<typeof utilizationTone>, string> = {
  denied: "text-denied",
  pending: "text-pending",
  revenue: "text-revenue",
};

function UtilizationBar({ item }: { item: ContractUtilizationItem }) {
  const tone = utilizationTone(item.utilization_pct);
  return (
    <div className="min-w-[120px]">
      <div className="mb-1 flex items-center justify-between gap-2 text-2xs">
        <span className={cn("font-mono font-medium", TONE_TEXT_CLASS[tone])}>{item.utilization_pct.toFixed(0)}%</span>
        <span className="text-ink-faint">
          {item.items_billed}/{item.total_items} itens
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas-raised">
        <div className={cn("h-1.5 rounded-full", TONE_BAR_CLASS[tone])} style={{ width: `${Math.min(item.utilization_pct, 100)}%` }} />
      </div>
    </div>
  );
}

/**
 * Painel → Faturamento: dos procedimentos NEGOCIADOS em cada contrato,
 * quantos foram de fato faturados no período — a resposta direta ao
 * pedido "avaliar os contratos que estão perdendo dinheiro por falta
 * de utilização". Ordenado do PIOR para o melhor pelo backend (ver
 * AnalyticsRepository.contract_utilization) — o contrato mais parado
 * aparece primeiro, sem precisar ordenar de novo aqui.
 *
 * `idle_catalog_value` é rotulado explicitamente como "valor de tabela
 * parado", nunca "perda" — ver DECISÃO no backend sobre por que não é
 * uma estimativa de receita perdida (não há como saber quantas vezes o
 * procedimento SERIA faturado se fosse oferecido).
 */
export function ContractUtilizationPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "contract-utilization", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<ContractUtilization>(`/api/v1/analytics/contract-utilization?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  const contracts = data?.contracts ?? [];

  return (
    <Panel
      title="Utilização de contrato"
      subtitle="Dos procedimentos negociados em cada contrato, quantos foram faturados ao menos 1x no período — pior utilização primeiro"
    >
      {isLoading && <LoadingState variant="table" rows={4} />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {!isLoading && !error && contracts.length === 0 && (
        <EmptyState icon={<FileText size={17} strokeWidth={1.5} />} message="Nenhum contrato homologado com itens cadastrados." />
      )}
      {!isLoading && contracts.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Convênio</th>
              <th className="px-4 py-2.5 font-medium">Vigência</th>
              <th className="px-4 py-2.5 font-medium">Utilização</th>
              <th className="px-4 py-2.5 text-right font-medium">Valor de tabela parado</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => (
              <tr key={contract.contract_id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                <td className="px-4 py-2.5 text-ink">{contract.plan_name}</td>
                <td className="px-4 py-2.5 text-ink-muted">
                  {formatDate(contract.valid_from)} — {contract.valid_until ? formatDate(contract.valid_until) : "vigente"}
                </td>
                <td className="px-4 py-2.5">
                  <UtilizationBar item={contract} />
                </td>
                <td className="tabular px-4 py-2.5 text-right font-mono text-ink-muted">
                  {contract.idle_catalog_value > 0 ? formatCurrency(contract.idle_catalog_value) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
