import { useQuery } from "@tanstack/react-query";
import { KpiCard } from "@/components/ui/KpiCard";
import { ErrorState, LoadingState } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { PeriodWindowSelect } from "@/components/ui/PeriodWindowSelect";
import { ExecutiveAgendaSummary } from "@/components/dashboard/ExecutiveAgendaSummary";
import { SmartInsightsFeed } from "@/components/dashboard/SmartInsightsFeed";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useDateWindow } from "@/lib/useDateWindow";
import { trendFrom } from "@/lib/narrative";
import { firstNameFrom, useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import type { ExecutiveSummary } from "@/lib/types";

/** Saudação por horário do dia — mesmo raciocínio de qualquer painel
 * executivo (o de referência do briefing inclusive): "bom dia" às 9h e
 * "boa noite" às 21h não é o mesmo texto, e usar sempre "olá" perderia
 * esse toque pessoal pedido no redesenho. Baseado no relógio do
 * NAVEGADOR do gestor (não do servidor) — é o fuso que importa para
 * quem está lendo a tela. */
function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function ExecutiveOverviewPage() {
  const { windowDays, setWindowDays, dateFrom, dateTo } = useDateWindow(7);
  const { data: profile } = useCurrentUserProfile();

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ["analytics", "executive-summary", dateFrom, dateTo],
    queryFn: () => apiClient.get<ExecutiveSummary>(`/api/v1/analytics/executive-summary?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sala de Comando"
        subtitle="Onde estamos perdendo dinheiro hoje?"
        greeting={profile ? `${timeOfDayGreeting()}, ${firstNameFrom(profile.full_name)}.` : undefined}
        action={<PeriodWindowSelect windowDays={windowDays} onChange={setWindowDays} />}
      />

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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-12">
            <KpiCard
              size="compact"
              colSpan={2}
              label="Buraco financeiro"
              value={formatCurrency(summary.financial_hole.value)}
              numericValue={summary.financial_hole.value}
              format={formatCurrency}
              tone="denied"
              gradient
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
              gradient
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
        <ExecutiveAgendaSummary dateFrom={dateFrom} dateTo={dateTo} />
      </section>
    </div>
  );
}
