import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { ErrorState, LoadingState } from "@/components/ui/Panel";
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
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tightest text-ink">Sala de Comando</h1>
          <p className="mt-1 text-sm text-ink-faint">Onde estamos perdendo dinheiro hoje?</p>
        </div>
        <div className="relative w-52">
          <select
            aria-label="Janela de período"
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            className="w-full appearance-none rounded-md border border-border-subtle bg-canvas-surface py-2 pl-3.5 pr-9 text-sm text-ink shadow-card transition-colors hover:border-border focus:border-revenue"
          >
            {WINDOW_OPTIONS.map((opt) => (
              <option key={opt.days} value={opt.days}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        </div>
      </motion.div>

      {/* Redesenho "menos BI, mais consultor": o diagnóstico em texto vem
          PRIMEIRO — é a resposta direta à pergunta "onde estamos perdendo
          dinheiro hoje?". Os números continuam existindo logo abaixo,
          como evidência de apoio para quem quer conferir, não como o
          elemento principal da tela. */}
      <SmartInsightsFeed dateFrom={dateFrom} dateTo={dateTo} />

      {isLoading && <LoadingState variant="cards" rows={6} />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}

      {summary && (
        <section>
          <h2 className="mb-3 text-2xs font-medium uppercase tracking-wide text-ink-faint">Números do período — para conferência</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-12">
            <KpiCard
              size="compact"
              colSpan={2}
              label="Buraco financeiro"
              value={formatCurrency(summary.financial_hole.value)}
              numericValue={summary.financial_hole.value}
              format={formatCurrency}
              tone="denied"
              trend={trendFrom(summary.financial_hole, { invert: true })}
            />
            <KpiCard
              size="compact"
              colSpan={2}
              label="Caixa protegido"
              value={formatCurrency(summary.total_value_saved.value)}
              numericValue={summary.total_value_saved.value}
              format={formatCurrency}
              tone="revenue"
              trend={trendFrom(summary.total_value_saved)}
            />
            <KpiCard
              size="compact"
              colSpan={2}
              label="Margem vs. contratada"
              value={summary.margin_vs_contracted_pct !== null ? `${summary.margin_vs_contracted_pct.toFixed(1)}%` : "—"}
              numericValue={summary.margin_vs_contracted_pct ?? undefined}
              format={summary.margin_vs_contracted_pct !== null ? (n) => `${n.toFixed(1)}%` : undefined}
              tone="neutral"
            />
            <KpiCard
              size="compact"
              colSpan={2}
              label="Faturamento retido"
              value={String(summary.high_risk_pending_count)}
              numericValue={summary.high_risk_pending_count}
              format={(n) => String(Math.round(n))}
              tone={summary.high_risk_pending_count > 0 ? "pending" : "neutral"}
            />
            <KpiCard
              size="compact"
              colSpan={2}
              label="Total faturado"
              value={formatCurrency(summary.total_billed.value)}
              numericValue={summary.total_billed.value}
              format={formatCurrency}
              tone="revenue"
              trend={trendFrom(summary.total_billed)}
            />
            <KpiCard
              size="compact"
              colSpan={2}
              label="Ocupação da agenda"
              value={summary.avg_capacity_utilization ? formatPct(summary.avg_capacity_utilization.value) : "—"}
              numericValue={summary.avg_capacity_utilization ? summary.avg_capacity_utilization.value * 100 : undefined}
              format={summary.avg_capacity_utilization ? (n) => `${n.toFixed(1)}%` : undefined}
              tone="neutral"
              trend={summary.avg_capacity_utilization ? trendFrom(summary.avg_capacity_utilization) : undefined}
            />
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink">Agenda & Capacidade Operacional</h2>
        <AgendaAnalyticsPanel dateFrom={dateFrom} dateTo={dateTo} />
      </section>
    </div>
  );
}
