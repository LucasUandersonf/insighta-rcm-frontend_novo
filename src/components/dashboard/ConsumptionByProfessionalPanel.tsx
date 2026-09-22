import { useQuery } from "@tanstack/react-query";
import { Stethoscope } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { ConsumptionByProfessional } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/**
 * Achado do Comitê de Liderança Tecnológica ("5 pernas", aba Estoque
 * dedicada) — desvio de consumo de material por profissional
 * SOLICITANTE (não quem executou o atendimento, ver DECISÃO em
 * MaterialRepository.consumption_deviation_by_professional, backend).
 * Só entram profissionais com amostra mínima. Ordenado por custo médio
 * por atendimento (maior primeiro) — é essa coluna que revela desvio de
 * padrão de consumo, não o custo total (que só reflete volume de
 * atendimentos).
 */
export function ConsumptionByProfessionalPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "estoque-consumo-por-medico", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<ConsumptionByProfessional>(`/api/v1/analytics/estoque-consumo-por-medico?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  if (isLoading) return <LoadingState variant="cards" rows={3} />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  if (data.items.length === 0) {
    return (
      <BentoCard colSpan={12}>
        <EmptyState
          icon={<Stethoscope size={17} strokeWidth={1.5} />}
          message="Nenhum profissional com amostra suficiente de consumo de material vinculado a atendimento neste período."
        />
      </BentoCard>
    );
  }

  const sorted = [...data.items].sort((a, b) => b.custo_medio_por_atendimento - a.custo_medio_por_atendimento);

  return (
    <BentoCard colSpan={12} noPadding>
      <div className="px-4 pt-4">
        <p className="text-sm font-medium text-ink">Consumo de material por profissional</p>
        <p className="mt-1 max-w-2xl text-xs text-ink-muted">
          Custo médio de material por atendimento, por profissional solicitante — maior custo médio primeiro, o jeito mais direto de ver desvio de padrão de consumo.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="border-b border-border-hairline text-2xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="py-3 pl-4 pr-3">Profissional</th>
              <th className="py-3 pr-3 text-right">Atendimentos</th>
              <th className="py-3 pr-3 text-right">Custo total</th>
              <th className="py-3 pl-3 pr-4 text-right">Custo médio/atendimento</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.professional_id} className="border-b border-border-hairline last:border-0">
                <td className="py-3 pl-4 pr-3 text-sm text-ink">{item.professional_name}</td>
                <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm text-ink-muted">{item.atendimentos_count}</td>
                <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm text-ink-muted">{formatCurrency(item.custo_total)}</td>
                <td className="tabular whitespace-nowrap py-3 pl-3 pr-4 text-right text-sm font-semibold text-ink">
                  {formatCurrency(item.custo_medio_por_atendimento)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BentoCard>
  );
}
