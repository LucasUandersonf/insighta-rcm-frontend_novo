import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { UpsellFunnel, UpsellFunnelItem } from "@/lib/types";

/**
 * "Equilíbrio Insighta" (Balanced Scorecard, perna Cliente, mecanismo 3)
 * — funil de upsell (oferecido × aceito) por procedimento adicional.
 * Complementa MarketingChannelsPanel (aquisição) olhando expansão de
 * receita em paciente já conquistado — mesmo padrão visual de tabela
 * rankeada usado ali.
 */

function formatPct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function FunnelRow({ item, rank }: { item: UpsellFunnelItem; rank: number }) {
  return (
    <tr className="border-b border-border-hairline last:border-0">
      <td className="whitespace-nowrap py-3 pl-4 pr-3 text-2xs font-semibold text-ink-faint">#{rank}</td>
      <td className="py-3 pr-3 text-sm text-ink">{item.procedure_name}</td>
      <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm text-ink-muted">{item.offered_count}</td>
      <td className="tabular whitespace-nowrap py-3 pr-3 text-right text-sm text-ink-muted">{item.accepted_count}</td>
      <td className="tabular whitespace-nowrap py-3 pl-3 pr-4 text-right text-sm font-semibold text-revenue">
        {item.acceptance_rate !== null ? formatPct(item.acceptance_rate) : "—"}
      </td>
    </tr>
  );
}

export function UpsellFunnelPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "upsell-funnel", dateFrom, dateTo],
    queryFn: () => apiClient.get<UpsellFunnel>(`/api/v1/analytics/upsell-funnel?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  if (isLoading) return <LoadingState variant="cards" rows={3} />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  if (data.items.length === 0) {
    return (
      <BentoCard colSpan={12}>
        <EmptyState
          icon={<TrendingUp size={17} strokeWidth={1.5} />}
          message="Nenhuma oferta de procedimento adicional registrada neste período — capture no checkout da consulta (ver 'Registrar atendimento' na Agenda)."
        />
      </BentoCard>
    );
  }

  return (
    <BentoCard colSpan={12} noPadding>
      <div className="px-4 pt-4">
        <p className="text-sm font-medium text-ink">Funil de upsell</p>
        <p className="mt-1 max-w-2xl text-xs text-ink-muted">
          Quantas vezes cada procedimento adicional foi oferecido no checkout e quantas dessas ofertas o paciente
          aceitou — {data.total_accepted} de {data.total_offered} no total
          {data.overall_acceptance_rate !== null ? ` (${formatPct(data.overall_acceptance_rate)} de aceite).` : "."}
        </p>
      </div>
      <div className="overflow-x-auto" tabIndex={0}>
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="border-b border-border-hairline text-2xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="py-3 pl-4 pr-3">#</th>
              <th className="py-3 pr-3">Procedimento oferecido</th>
              <th className="py-3 pr-3 text-right">Ofertas</th>
              <th className="py-3 pr-3 text-right">Aceitas</th>
              <th className="py-3 pl-3 pr-4 text-right">Taxa de aceite</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <FunnelRow key={item.procedure_name} item={item} rank={idx + 1} />
            ))}
          </tbody>
        </table>
      </div>
    </BentoCard>
  );
}
