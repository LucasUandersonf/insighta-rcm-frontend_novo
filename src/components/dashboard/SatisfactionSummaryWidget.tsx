import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState } from "@/components/ui/Panel";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { cn } from "@/lib/cn";
import type { SatisfactionSummary } from "@/lib/types";

/**
 * "Equilíbrio Insighta" (Balanced Scorecard, perna Cliente, mecanismo 2)
 * — resumo de NPS/satisfação pós-atendimento. Widget PERSISTENTE, mesmo
 * espírito de HealthScoreWidget (janela fixa de 90 dias, não o seletor
 * de período da tela) — mas mais simples: sem anel de nota, porque
 * `visit_satisfaction_score` já é intuitivo em estrelas (1-5), não
 * precisa de uma escala 0-100 pra ser lido de relance.
 */

const SCORES = [1, 2, 3, 4, 5] as const;

export function SatisfactionSummaryWidget() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "satisfaction-summary"],
    queryFn: () => apiClient.get<SatisfactionSummary>("/api/v1/analytics/satisfaction-summary"),
  });

  if (isLoading) {
    return (
      <BentoCard colSpan={12} className="mb-4">
        <LoadingState rows={1} />
      </BentoCard>
    );
  }

  if (error) {
    return (
      <BentoCard colSpan={12} className="mb-4">
        <ErrorState message={getApiErrorMessage(error)} />
      </BentoCard>
    );
  }

  if (!data) return null;

  if (data.average_score === null) {
    return (
      <BentoCard colSpan={12} className="mb-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas-raised text-ink-faint">
            <Star size={17} strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">Satisfação pós-atendimento</p>
            <p className="text-xs text-ink-muted">
              Nenhuma avaliação recebida nos últimos {data.window_days} dias ainda — o link de avaliação é enviado a cada
              atendimento concluído (ver botão "Link de avaliação" na Agenda).
            </p>
          </div>
        </div>
      </BentoCard>
    );
  }

  const { average_score, response_count, distribution } = data;
  const maxCount = Math.max(1, ...SCORES.map((s) => distribution[String(s)] ?? 0));

  return (
    <BentoCard colSpan={12} className="mb-4">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex shrink-0 items-center gap-2">
          <Star size={22} className="fill-pending text-pending" />
          <span className="text-xl font-semibold text-ink">
            <AnimatedNumber value={average_score.value} format={(n) => n.toFixed(1)} durationSeconds={0.8} />
          </span>
          <span className="text-sm text-ink-faint">/5</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ink">Satisfação pós-atendimento</p>
            {average_score.delta_pct !== null && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium",
                  average_score.delta_pct >= 0 ? "bg-revenue-bg text-revenue" : "bg-denied-bg text-denied"
                )}
              >
                {average_score.delta_pct >= 0 ? <ArrowUp aria-hidden size={10} /> : <ArrowDown aria-hidden size={10} />}
                {Math.abs(average_score.delta_pct).toFixed(1)}% vs. janela anterior
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            {response_count} avaliaç{response_count === 1 ? "ão" : "ões"} nos últimos {data.window_days} dias.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          {SCORES.slice()
            .reverse()
            .map((score) => {
              const count = distribution[String(score)] ?? 0;
              return (
                <div key={score} className="flex items-center gap-1.5 text-2xs text-ink-faint">
                  <span className="w-3 text-right tabular">{score}</span>
                  <Star size={9} aria-hidden />
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-canvas-raised">
                    <div
                      className="h-full rounded-full bg-pending"
                      style={{ width: count > 0 ? `${Math.max(8, (count / maxCount) * 100)}%` : "0%" }}
                    />
                  </div>
                  <span className="tabular w-4">{count}</span>
                </div>
              );
            })}
        </div>
      </div>
    </BentoCard>
  );
}
