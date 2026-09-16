import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Repeat } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState } from "@/components/ui/Panel";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { cn } from "@/lib/cn";
import type { ReturnRate } from "@/lib/types";

/**
 * Achado do Dossiê Insighta RCM — taxa de retorno de pacientes
 * (`Appointment.visit_type`, capturado pela normalização desde sempre
 * mas nunca agregado). Segue o mesmo seletor de período do resto do
 * Painel/Agenda (diferente de HealthScoreWidget/SatisfactionSummaryWidget,
 * que usam janela fixa) — "taxa de retorno da semana" é uma pergunta
 * legítima do gestor.
 */
export function ReturnRatePanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "return-rate", dateFrom, dateTo],
    queryFn: () => apiClient.get<ReturnRate>(`/api/v1/analytics/return-rate?date_from=${dateFrom}&date_to=${dateTo}`),
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

  if (data.return_rate === null) {
    return (
      <BentoCard colSpan={12} className="mb-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas-raised text-ink-faint">
            <Repeat size={17} strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">Taxa de retorno de pacientes</p>
            <p className="text-xs text-ink-muted">
              Nenhum atendimento concluído com tipo de visita (primeira consulta/retorno) identificado neste
              período — depende do template de Agenda trazer essa coluna preenchida.
            </p>
          </div>
        </div>
      </BentoCard>
    );
  }

  const { return_rate, return_count, first_visit_count, untagged_count } = data;

  return (
    <BentoCard colSpan={12} className="mb-4">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex shrink-0 items-center gap-2">
          <Repeat size={20} className="text-revenue" />
          <span className="font-serif text-xl font-medium text-ink">
            <AnimatedNumber value={return_rate.value} format={(n) => n.toFixed(0)} durationSeconds={0.8} />
          </span>
          <span className="text-sm text-ink-faint">%</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ink">Taxa de retorno de pacientes</p>
            {return_rate.delta_pct !== null && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium",
                  return_rate.delta_pct >= 0 ? "bg-revenue-bg text-revenue" : "bg-denied-bg text-denied"
                )}
              >
                {return_rate.delta_pct >= 0 ? <ArrowUp aria-hidden size={10} /> : <ArrowDown aria-hidden size={10} />}
                {Math.abs(return_rate.delta_pct).toFixed(1)}% vs. período anterior
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            {return_count} retorno{return_count === 1 ? "" : "s"} de {return_count + first_visit_count} atendimento
            {return_count + first_visit_count === 1 ? "" : "s"} concluído{return_count + first_visit_count === 1 ? "" : "s"} com
            tipo de visita identificado
            {untagged_count > 0
              ? ` (${untagged_count} atendimento${untagged_count === 1 ? "" : "s"} sem essa informação, fora da conta).`
              : "."}
          </p>
        </div>
      </div>
    </BentoCard>
  );
}
