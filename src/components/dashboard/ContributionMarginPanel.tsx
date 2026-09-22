import { useQuery } from "@tanstack/react-query";
import { Percent } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { cn } from "@/lib/cn";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { ContributionMargin } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/**
 * Achado do Comitê de Liderança Tecnológica ("5 pernas", aba Estoque
 * dedicada) — margem de contribuição REAL por procedimento: receita
 * menos custo de material consumido, a peça que faltava para responder
 * "esse procedimento dá lucro de verdade?" (não só "faturou bem").
 *
 * DECISÃO — só atendimentos de procedimento único aparecem aqui (ver
 * AnalyticsRepository.contribution_margin_by_procedure, backend):
 * atendimento com mais de um procedimento faturado no mesmo dia não
 * entra, porque não dá pra saber qual procedimento "consumiu" qual
 * material. `sample_count` mostra o tamanho real da amostra por trás de
 * cada linha — números com amostra baixa merecem menos confiança.
 */
export function ContributionMarginPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "margem-contribuicao-por-procedimento", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<ContributionMargin>(
        `/api/v1/analytics/margem-contribuicao-por-procedimento?date_from=${dateFrom}&date_to=${dateTo}`
      ),
  });

  if (isLoading) return <LoadingState variant="cards" rows={3} />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  if (data.items.length === 0) {
    return (
      <BentoCard colSpan={12}>
        <EmptyState
          icon={<Percent size={17} strokeWidth={1.5} />}
          message="Nenhum atendimento de procedimento único com faturamento neste período para calcular margem de contribuição."
        />
      </BentoCard>
    );
  }

  const sorted = [...data.items].sort((a, b) => b.total_revenue - a.total_revenue);

  return (
    <BentoCard colSpan={12} noPadding>
      <div className="px-4 pt-4">
        <p className="text-sm font-medium text-ink">Margem de contribuição real por procedimento</p>
        <p className="mt-1 max-w-2xl text-xs text-ink-muted">
          Receita menos custo de material consumido, só em atendimentos com um único procedimento faturado — onde a atribuição de custo é inequívoca.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left">
          <thead>
            <tr className="border-b border-border-hairline text-2xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="py-3 pl-4 pr-3">Procedimento</th>
              <th className="py-3 pr-3 text-right">Receita</th>
              <th className="py-3 pr-3 text-right">Custo material</th>
              <th className="py-3 pr-3 text-right">Margem</th>
              <th className="py-3 pl-3 pr-4 text-right">Amostra</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.procedure_code} className="border-b border-border-hairline last:border-0">
                <td className="py-3 pl-4 pr-3 text-sm text-ink">{item.procedure_code}</td>
                <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm text-ink-muted">{formatCurrency(item.total_revenue)}</td>
                <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm text-ink-muted">{formatCurrency(item.total_cost)}</td>
                <td
                  className={cn(
                    "tabular whitespace-nowrap py-3 pr-3 text-right text-sm font-semibold",
                    item.margin_pct !== null && item.margin_pct < 30 ? "text-denied" : "text-revenue"
                  )}
                >
                  {item.margin_pct !== null ? `${item.margin_pct.toFixed(1)}%` : "—"}
                </td>
                <td className="tabular whitespace-nowrap py-3 pl-3 pr-4 text-right text-xs text-ink-faint">{item.sample_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BentoCard>
  );
}
