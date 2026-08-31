import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KpiCard } from "@/components/ui/KpiCard";
import { ErrorState, LoadingState } from "@/components/ui/Panel";
import { SelectField } from "@/components/ui/FormField";
import { AgendaAnalyticsPanel } from "@/components/dashboard/AgendaAnalyticsPanel";
import { SmartInsightsFeed } from "@/components/dashboard/SmartInsightsFeed";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { ExecutiveSummary, PeriodKpi } from "@/lib/types";

const WINDOW_OPTIONS = [
  { days: 7, label: "Últimos 7 dias" },
  { days: 14, label: "Últimos 14 dias" },
  { days: 30, label: "Últimos 30 dias" },
];

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Converte um PeriodKPI em trend do KpiCard — o mesmo cartão "estilo
 * terminal financeiro" já usado no resto do app (ver KpiCard.tsx), só
 * alimentado com a variação % semanal REAL vinda do backend, em vez de
 * dado de exemplo. */
function trendFrom(kpi: PeriodKpi, opts?: { invert?: boolean }): { value: string; positive: boolean } | undefined {
  if (kpi.delta_pct === null) return undefined;
  const positive = opts?.invert ? kpi.delta_pct < 0 : kpi.delta_pct >= 0;
  return { value: `${Math.abs(kpi.delta_pct).toFixed(1)}% vs. período anterior`, positive };
}

export function ExecutiveOverviewPage() {
  const [windowDays, setWindowDays] = useState(7);

  const { dateFrom, dateTo } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (windowDays - 1));
    return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end) };
  }, [windowDays]);

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ["analytics", "executive-summary", dateFrom, dateTo],
    queryFn: () => apiClient.get<ExecutiveSummary>(`/api/v1/analytics/executive-summary?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Sala de Comando</h1>
          <p className="text-xs text-ink-faint">Onde estamos perdendo dinheiro hoje?</p>
        </div>
        <div className="w-48">
          <SelectField
            label=""
            className="mb-0"
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
          >
            {WINDOW_OPTIONS.map((opt) => (
              <option key={opt.days} value={opt.days}>
                {opt.label}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {/* Redesenho "menos BI, mais consultor" (Auditoria Go-Live): o
          diagnóstico em texto vem PRIMEIRO — é a resposta direta à
          pergunta "onde estamos perdendo dinheiro hoje?". Os números
          continuam existindo logo abaixo, como evidência de apoio para
          quem quer conferir, não como o elemento principal da tela. */}
      <div className="mb-6">
        <SmartInsightsFeed dateFrom={dateFrom} dateTo={dateTo} />
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}

      {summary && (
        <>
          <h2 className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-faint">Números do período — para conferência</h2>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KpiCard
              size="compact"
              label="Buraco financeiro"
              value={formatCurrency(summary.financial_hole.value)}
              tone="denied"
              trend={trendFrom(summary.financial_hole, { invert: true })}
            />
            <KpiCard
              size="compact"
              label="Caixa protegido"
              value={formatCurrency(summary.total_value_saved.value)}
              tone="revenue"
              trend={trendFrom(summary.total_value_saved)}
            />
            <KpiCard
              size="compact"
              label="Margem vs. contratada"
              value={summary.margin_vs_contracted_pct !== null ? `${summary.margin_vs_contracted_pct.toFixed(1)}%` : "—"}
              tone="neutral"
            />
            <KpiCard
              size="compact"
              label="Faturamento retido"
              value={String(summary.high_risk_pending_count)}
              tone={summary.high_risk_pending_count > 0 ? "pending" : "neutral"}
            />
            <KpiCard
              size="compact"
              label="Total faturado"
              value={formatCurrency(summary.total_billed.value)}
              tone="revenue"
              trend={trendFrom(summary.total_billed)}
            />
            <KpiCard
              size="compact"
              label="Ocupação da agenda"
              value={summary.avg_capacity_utilization ? formatPct(summary.avg_capacity_utilization.value) : "—"}
              tone="neutral"
              trend={summary.avg_capacity_utilization ? trendFrom(summary.avg_capacity_utilization) : undefined}
            />
          </div>
        </>
      )}

      <h2 className="mb-3 text-sm font-medium text-ink">Agenda & Capacidade Operacional</h2>
      <AgendaAnalyticsPanel dateFrom={dateFrom} dateTo={dateTo} />
    </div>
  );
}
