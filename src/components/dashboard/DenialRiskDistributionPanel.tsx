import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Panel } from "@/components/ui/Panel";
import { DonutChart, type DonutSegment } from "@/components/ui/DonutChart";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { cn } from "@/lib/cn";
import type { DenialRiskDistribution } from "@/lib/types";

const LEVEL_CONFIG: Record<DenialRiskDistribution["items"][number]["level"], { label: string; tone: DonutSegment["tone"] }> = {
  high: { label: "Alto risco", tone: "denied" },
  medium: { label: "Médio risco", tone: "pending" },
  low: { label: "Baixo risco", tone: "revenue" },
};

// Ordem fixa (alto -> médio -> baixo) — mesma ordem do canvas de
// design, independente da ordem em que o backend devolve os grupos.
const LEVEL_ORDER: DenialRiskDistribution["items"][number]["level"][] = ["high", "medium", "low"];

function formatCurrencyCompact(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

type ViewMode = "atendimentos" | "reais";

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border-hairline bg-canvas-raised/60 p-0.5 text-2xs">
      {(["atendimentos", "reais"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded px-2 py-1 font-medium transition-colors",
            mode === option ? "bg-canvas text-ink shadow-sm" : "text-ink-faint hover:text-ink-muted"
          )}
        >
          {option === "atendimentos" ? "Atendimentos" : "R$"}
        </button>
      ))}
    </div>
  );
}

/**
 * Painel → Faturamento: donut de distribuição de risco de glosa com
 * legenda lateral. Achado do Parecer Técnico "Boletim Insighta"
 * (revisão 2): antes existia esta visão (contagem) e o card de insight
 * "% do faturado em risco de glosa" (valor, só agregado) cobrindo o
 * MESMO dado em duas telas separadas — agora um único painel alterna
 * entre "quantos atendimentos" e "quantos reais" por nível de risco.
 */
export function DenialRiskDistributionPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [mode, setMode] = useState<ViewMode>("atendimentos");
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "denial-risk-distribution", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<DenialRiskDistribution>(`/api/v1/analytics/denial-risk-distribution?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  const byLevel = new Map((data?.items ?? []).map((item) => [item.level, item]));
  const segments: DonutSegment[] = LEVEL_ORDER.map((level) => ({
    label: LEVEL_CONFIG[level].label,
    value: mode === "atendimentos" ? byLevel.get(level)?.count ?? 0 : byLevel.get(level)?.value ?? 0,
    tone: LEVEL_CONFIG[level].tone,
  }));

  const total = mode === "atendimentos" ? data?.total_reviewed ?? 0 : data?.total_value_reviewed ?? 0;
  const centerValue = mode === "atendimentos" ? String(data?.total_reviewed ?? 0) : formatCurrencyCompact(data?.total_value_reviewed ?? 0);

  return (
    <Panel
      title="Distribuição de risco de glosa"
      subtitle="Faturamentos revisados no período"
      action={data && data.total_reviewed > 0 ? <ViewToggle mode={mode} onChange={setMode} /> : undefined}
    >
      {isLoading && <div className="h-[120px] animate-pulse rounded-full bg-canvas-raised" style={{ width: 120, margin: "20px" }} />}
      {error && <p className="p-5 text-xs text-denied">{getApiErrorMessage(error)}</p>}
      {!isLoading && !error && data && data.total_reviewed === 0 && (
        <p className="p-5 text-xs text-ink-faint">Nenhum faturamento revisado nesta janela.</p>
      )}
      {!isLoading && data && data.total_reviewed > 0 && (
        <div className="p-5">
          <DonutChart segments={segments} centerLabel={mode === "atendimentos" ? "Revisados" : "Faturado"} centerValue={centerValue} />
          {total === 0 && mode === "reais" && (
            <p className="mt-3 text-2xs text-ink-faint">Nenhum valor faturado nesta janela para os atendimentos revisados.</p>
          )}
        </div>
      )}
    </Panel>
  );
}
