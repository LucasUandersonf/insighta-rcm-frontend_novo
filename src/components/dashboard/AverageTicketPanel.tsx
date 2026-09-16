import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Receipt } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState } from "@/components/ui/Panel";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { cn } from "@/lib/cn";
import type { AverageTicket } from "@/lib/types";

/**
 * Achado do Dossiê Insighta RCM — nenhuma agregação de ticket médio
 * existia, apesar de Billing.charged_value estar pronto desde sempre.
 * Segue o mesmo seletor de período do resto da aba Rentabilidade.
 */

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const CHANNEL_LABELS: Record<string, string> = {
  telefone: "Telefone",
  whatsapp: "WhatsApp",
  site: "Site",
  presencial: "Presencial",
};

export function AverageTicketPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "average-ticket", dateFrom, dateTo],
    queryFn: () => apiClient.get<AverageTicket>(`/api/v1/analytics/average-ticket?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  if (isLoading) {
    return (
      <BentoCard colSpan={12}>
        <LoadingState rows={2} />
      </BentoCard>
    );
  }

  if (error) {
    return (
      <BentoCard colSpan={12}>
        <ErrorState message={getApiErrorMessage(error)} />
      </BentoCard>
    );
  }

  if (!data || data.overall === null) {
    return (
      <BentoCard colSpan={12}>
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas-raised text-ink-faint">
            <Receipt size={17} strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">Ticket médio</p>
            <p className="text-xs text-ink-muted">Nenhum faturamento neste período ainda.</p>
          </div>
        </div>
      </BentoCard>
    );
  }

  const { overall, billing_count, by_channel, by_procedure } = data;

  return (
    <BentoCard colSpan={12}>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <Receipt size={20} className="text-revenue" />
            <span className="font-serif text-xl font-medium text-ink">
              <AnimatedNumber value={overall.value} format={formatCurrency} durationSeconds={0.8} />
            </span>
            {overall.delta_pct !== null && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium",
                  overall.delta_pct >= 0 ? "bg-revenue-bg text-revenue" : "bg-denied-bg text-denied"
                )}
              >
                {overall.delta_pct >= 0 ? <ArrowUp aria-hidden size={10} /> : <ArrowDown aria-hidden size={10} />}
                {Math.abs(overall.delta_pct).toFixed(1)}% vs. período anterior
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Ticket médio geral — {billing_count} lançamento{billing_count === 1 ? "" : "s"} no período.
          </p>
        </div>

        {by_channel.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-2xs font-medium uppercase tracking-wide text-ink-faint">Por canal</span>
            {by_channel.map((item) => (
              <div key={item.channel} className="flex items-center justify-between gap-4 text-xs">
                <span className="text-ink-muted">{CHANNEL_LABELS[item.channel] ?? item.channel}</span>
                <span className="tabular font-medium text-ink">{formatCurrency(item.average_ticket)}</span>
              </div>
            ))}
          </div>
        )}

        {by_procedure.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-2xs font-medium uppercase tracking-wide text-ink-faint">Por procedimento</span>
            {by_procedure.slice(0, 5).map((item) => (
              <div key={item.procedure_code} className="flex items-center justify-between gap-4 text-xs">
                <span className="truncate text-ink-muted">{item.procedure_name ?? item.procedure_code}</span>
                <span className="tabular font-medium text-ink">{formatCurrency(item.average_ticket)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </BentoCard>
  );
}
