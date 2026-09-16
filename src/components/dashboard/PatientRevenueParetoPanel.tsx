import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { PatientRevenueItem, PatientRevenuePareto } from "@/lib/types";

/**
 * Achado do Dossiê Insighta RCM — Pareto de receita por PACIENTE,
 * dimensão diferente da concentração por convênio que já existe no
 * motor de insights (ver `_revenue_concentration_insight`, backend):
 * aqui o risco é depender de poucos pacientes, não de poucos convênios.
 * Mesmo padrão visual de tabela rankeada de UpsellFunnelPanel/
 * ProfitabilityPanel.
 */

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function ParetoRow({ item, rank }: { item: PatientRevenueItem; rank: number }) {
  return (
    <tr className="border-b border-border-hairline last:border-0">
      <td className="whitespace-nowrap py-3 pl-4 pr-3 text-2xs font-semibold text-ink-faint">#{rank}</td>
      <td className="py-3 pr-3 text-sm text-ink">{item.full_name}</td>
      <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm text-ink-muted">{formatCurrency(item.revenue)}</td>
      <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm font-semibold text-revenue">{item.share_pct.toFixed(1)}%</td>
      <td className="tabular whitespace-nowrap py-3 pl-3 pr-4 text-right text-xs text-ink-faint">{item.cumulative_share_pct.toFixed(1)}% acum.</td>
    </tr>
  );
}

export function PatientRevenueParetoPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "patient-revenue-pareto", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<PatientRevenuePareto>(`/api/v1/analytics/patient-revenue-pareto?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  if (isLoading) return <LoadingState variant="cards" rows={3} />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  if (data.items.length === 0) {
    return (
      <BentoCard colSpan={12}>
        <EmptyState icon={<Users size={17} strokeWidth={1.5} />} message="Nenhum faturamento neste período para calcular concentração por paciente." />
      </BentoCard>
    );
  }

  return (
    <BentoCard colSpan={12} noPadding>
      <div className="px-4 pt-4">
        <p className="text-sm font-medium text-ink">Pareto de receita por paciente</p>
        <p className="mt-1 max-w-2xl text-xs text-ink-muted">
          Os {data.items.length} pacientes com maior faturamento no período
          {data.top_n_share_pct !== null ? ` somam ${data.top_n_share_pct.toFixed(1)}% de tudo que a clínica faturou.` : "."}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="border-b border-border-hairline text-2xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="py-3 pl-4 pr-3">#</th>
              <th className="py-3 pr-3">Paciente</th>
              <th className="py-3 pr-3 text-right">Faturado</th>
              <th className="py-3 pr-3 text-right">% do total</th>
              <th className="py-3 pl-3 pr-4 text-right">Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <ParetoRow key={item.patient_id} item={item} rank={idx + 1} />
            ))}
          </tbody>
        </table>
      </div>
    </BentoCard>
  );
}
