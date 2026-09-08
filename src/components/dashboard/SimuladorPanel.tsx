import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BentoCard, BentoGrid } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState } from "@/components/ui/Panel";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useDateWindow } from "@/lib/useDateWindow";
import type { AgendaMetrics, ExecutiveSummary } from "@/lib/types";

/**
 * Simulador "e se" — Sala de Comando 2.0, Nível 2 do roadmap. Projeção
 * client-side pura sobre dado JÁ REAL (denial_at_risk_value do
 * executive-summary, estimated_revenue_at_risk do agenda-metrics) —
 * NUNCA um número inventado: os dois valores-base já são o que os
 * outros cartões da Sala de Comando mostram, só multiplicados pelo
 * percentual que o usuário arrasta. Nenhuma chamada grava nada — é
 * simulação, não ação.
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function SliderControl({
  label,
  value,
  onChange,
  baseValue,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  baseValue: number;
}) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="font-mono text-xs text-accent">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-canvas-raised accent-[hsl(var(--accent))]"
        aria-label={label}
      />
      <p className="mt-1.5 text-2xs text-ink-faint">Base atual: {formatCurrency(baseValue)}</p>
    </div>
  );
}

export function SimuladorPanel() {
  const [denialReduction, setDenialReduction] = useState(40);
  const [noShowReduction, setNoShowReduction] = useState(20);
  const { dateFrom, dateTo } = useDateWindow(30);

  const summaryQuery = useQuery({
    queryKey: ["analytics", "executive-summary", dateFrom, dateTo],
    queryFn: () => apiClient.get<ExecutiveSummary>(`/api/v1/analytics/executive-summary?date_from=${dateFrom}&date_to=${dateTo}`),
  });
  const agendaQuery = useQuery({
    queryKey: ["analytics", "agenda-metrics", dateFrom, dateTo],
    queryFn: () => apiClient.get<AgendaMetrics>(`/api/v1/analytics/agenda-metrics?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  if (summaryQuery.isLoading || agendaQuery.isLoading) return <LoadingState variant="cards" rows={2} />;
  if (summaryQuery.error) return <ErrorState message={getApiErrorMessage(summaryQuery.error)} />;
  if (agendaQuery.error) return <ErrorState message={getApiErrorMessage(agendaQuery.error)} />;
  if (!summaryQuery.data || !agendaQuery.data) return null;

  const denialBase = summaryQuery.data.denial_at_risk_value;
  const noShowBase = agendaQuery.data.estimated_revenue_at_risk;
  const projectedTotal = denialBase * (denialReduction / 100) + noShowBase * (noShowReduction / 100);

  return (
    <BentoGrid>
      <BentoCard colSpan={6}>
        <p className="mb-1 text-sm font-medium text-ink">Ajuste os cenários</p>
        <p className="mb-5 text-2xs text-ink-muted">
          Projeção sobre os últimos 30 dias — nada aqui altera dado real, é só simulação.
        </p>
        <SliderControl
          label="Reduzir valor em risco de glosa"
          value={denialReduction}
          onChange={setDenialReduction}
          baseValue={denialBase}
        />
        <SliderControl
          label="Reduzir valor em risco de falta"
          value={noShowReduction}
          onChange={setNoShowReduction}
          baseValue={noShowBase}
        />
      </BentoCard>
      <BentoCard colSpan={6} glow="revenue" className="flex flex-col items-center justify-center text-center">
        <span className="text-2xs font-medium uppercase tracking-wide text-ink-faint">Impacto projetado</span>
        <div className="mt-2 bg-grad-revenue bg-clip-text font-sans text-4xl font-semibold tracking-tightest text-transparent drop-shadow-[0_0_24px_hsl(var(--revenue)/0.35)]">
          <AnimatedNumber value={projectedTotal} format={formatCurrency} durationSeconds={0.6} />
        </div>
        <p className="mt-3 max-w-xs text-2xs text-ink-muted">
          Simulação sem efeito real — útil para decidir antes de agir, não para registrar depois.
        </p>
      </BentoCard>
    </BentoGrid>
  );
}
