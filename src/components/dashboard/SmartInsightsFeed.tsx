import { useQuery } from "@tanstack/react-query";
import { LoadingState, ErrorState } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { InsightSeverity, SmartInsight, SmartInsights } from "@/lib/types";

/**
 * Redesenho da Sala de Comando (Auditoria Go-Live — "menos BI, mais
 * consultor"): esta seção deixa de ser mais um painel de KPIs entre
 * outros e passa a ser o PRIMEIRO elemento visual da tela — a resposta
 * em texto de "onde está o problema", com o insight de maior impacto
 * financeiro destacado como manchete, e os demais logo abaixo como
 * lista de apoio. Os números continuam existindo (na tira de KPIs
 * compacta abaixo desta seção, e nos gráficos de evidência de cada
 * painel específico) — só deixaram de ser o elemento PRINCIPAL da tela.
 */

const SEVERITY_CONFIG: Record<InsightSeverity, { label: string; icon: string; text: string; border: string; bg: string; dot: string }> = {
  critical: { label: "Crítico", icon: "▼", text: "text-denied", border: "border-denied/30", bg: "bg-denied-bg", dot: "bg-denied" },
  warning: { label: "Atenção", icon: "●", text: "text-pending", border: "border-pending/30", bg: "bg-pending-bg", dot: "bg-pending" },
  positive: { label: "Eficiência", icon: "▲", text: "text-revenue", border: "border-revenue/30", bg: "bg-revenue-bg", dot: "bg-revenue" },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function HeroInsight({ insight }: { insight: SmartInsight }) {
  const cfg = SEVERITY_CONFIG[insight.severity];
  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} p-5 shadow-card sm:p-6`}>
      <div className="flex items-start gap-3">
        <span aria-hidden className={`mt-0.5 text-xl ${cfg.text}`}>
          {cfg.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-sm border px-1.5 py-0.5 text-2xs font-medium ${cfg.border} ${cfg.text}`}>{cfg.label}</span>
            <h2 className="font-serif text-base font-medium tracking-premium text-ink sm:text-lg">{insight.title}</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-muted sm:text-[0.95rem]">{insight.message}</p>
          {insight.financial_impact !== null && (
            <p className={`mt-3 inline-block rounded-sm bg-canvas-surface/70 px-2 py-1 font-mono text-xs ${cfg.text}`}>
              Impacto estimado: {formatCurrency(insight.financial_impact)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SecondaryInsightsList({ insights }: { insights: SmartInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <div className="mt-3 divide-y divide-border-subtle rounded-lg border border-border-hairline bg-canvas-surface/80 shadow-card backdrop-blur-sm">
      {insights.map((insight, idx) => {
        const cfg = SEVERITY_CONFIG[insight.severity];
        return (
          <div key={idx} className="flex gap-3 px-4 py-3">
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink">{insight.title}</p>
                <span className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-2xs font-medium ${cfg.border} text-ink-muted`}>{cfg.label}</span>
              </div>
              <p className="mt-0.5 text-sm text-ink-muted">{insight.message}</p>
              {insight.financial_impact !== null && (
                <p className="mt-1 font-mono text-xs text-ink-faint">Impacto estimado: {formatCurrency(insight.financial_impact)}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AllClearHero() {
  return (
    <div className="rounded-lg border border-revenue/30 bg-revenue-bg p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-xl text-revenue">
          ✓
        </span>
        <div>
          <h2 className="font-serif text-base font-medium tracking-premium text-ink sm:text-lg">Tudo certo por aqui</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Nenhum desvio relevante identificado nesta janela — operação dentro do esperado. Os números de apoio continuam
            disponíveis logo abaixo, caso queira conferir de qualquer forma.
          </p>
        </div>
      </div>
    </div>
  );
}

export function SmartInsightsFeed({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "smart-insights", dateFrom, dateTo],
    queryFn: () => apiClient.get<SmartInsights>(`/api/v1/analytics/smart-insights?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  const insights = data?.insights ?? [];

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border-hairline bg-canvas-surface/80 shadow-card backdrop-blur-sm">
        <LoadingState rows={3} />
      </div>
    );
  }

  if (error) return <ErrorState message={getApiErrorMessage(error)} />;

  if (insights.length === 0) return <AllClearHero />;

  const [topInsight, ...rest] = insights;

  return (
    <div>
      <HeroInsight insight={topInsight} />
      <SecondaryInsightsList insights={rest} />
    </div>
  );
}
