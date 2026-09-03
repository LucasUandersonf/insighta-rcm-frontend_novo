import { useQuery } from "@tanstack/react-query";
import { Panel } from "@/components/ui/Panel";
import { DonutChart, type DonutSegment } from "@/components/ui/DonutChart";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { DenialRiskDistribution } from "@/lib/types";

const LEVEL_CONFIG: Record<DenialRiskDistribution["items"][number]["level"], { label: string; tone: DonutSegment["tone"] }> = {
  high: { label: "Alto risco", tone: "denied" },
  medium: { label: "Médio risco", tone: "pending" },
  low: { label: "Baixo risco", tone: "revenue" },
};

// Ordem fixa (alto -> médio -> baixo) — mesma ordem do canvas de
// design, independente da ordem em que o backend devolve os grupos.
const LEVEL_ORDER: DenialRiskDistribution["items"][number]["level"][] = ["high", "medium", "low"];

/**
 * Painel → Faturamento: terceira das 3 colunas da seção de rankings
 * (ver canvas de design, Painel.dc.html) — donut de distribuição de
 * risco de glosa com legenda lateral, novo nesta reescrita (não existia
 * antes do canvas pedir explicitamente por ele).
 */
export function DenialRiskDistributionPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "denial-risk-distribution", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<DenialRiskDistribution>(`/api/v1/analytics/denial-risk-distribution?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  const countByLevel = new Map((data?.items ?? []).map((item) => [item.level, item.count]));
  const segments: DonutSegment[] = LEVEL_ORDER.map((level) => ({
    label: LEVEL_CONFIG[level].label,
    value: countByLevel.get(level) ?? 0,
    tone: LEVEL_CONFIG[level].tone,
  }));

  return (
    <Panel title="Distribuição de risco de glosa" subtitle="Faturamentos revisados no período">
      {isLoading && <div className="h-[120px] animate-pulse rounded-full bg-canvas-raised" style={{ width: 120, margin: "20px" }} />}
      {error && <p className="p-5 text-xs text-denied">{getApiErrorMessage(error)}</p>}
      {!isLoading && !error && data && data.total_reviewed === 0 && (
        <p className="p-5 text-xs text-ink-faint">Nenhum faturamento revisado nesta janela.</p>
      )}
      {!isLoading && data && data.total_reviewed > 0 && (
        <div className="p-5">
          <DonutChart segments={segments} centerLabel="Revisados" centerValue={String(data.total_reviewed)} />
        </div>
      )}
    </Panel>
  );
}
