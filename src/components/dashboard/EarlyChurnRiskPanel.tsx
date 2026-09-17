import { useQuery } from "@tanstack/react-query";
import { UserRoundSearch } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { EarlyChurnRisk } from "@/lib/types";

/**
 * Raio-X da Receita, frente "Prevendo movimentos" — a lista real por
 * trás do botão "Ver quem está sumindo" do insight de churn antecipado
 * (ver DECISÃO em smart_insights_engine.py::_early_churn_insight).
 * Diferente de InactivePatientsPanel (piso fixo de 1 ano, igual pra
 * todo mundo), aqui o critério é o PRÓPRIO ritmo de cada paciente —
 * "já está bem além do que costuma esperar entre consultas", mesmo sem
 * ter completado 1 ano de ausência ainda. Vive na mesma âncora
 * `#carteira-inativa` (ExecutiveOverviewPage.tsx): as duas listas
 * respondem "quem está indo embora", só em estágios diferentes.
 */

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

function formatRhythm(item: { avg_interval_days: number; days_since_last: number }): string {
  const ratio = item.days_since_last / item.avg_interval_days;
  return `${Math.round(item.days_since_last)} dias sem voltar — costuma vir a cada ${Math.round(item.avg_interval_days)} (${ratio.toFixed(1)}x o próprio ritmo)`;
}

export function EarlyChurnRiskPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "early-churn-risk"],
    queryFn: () => apiClient.get<EarlyChurnRisk>("/api/v1/analytics/early-churn-risk"),
  });

  if (isLoading) {
    return (
      <BentoCard colSpan={12}>
        <LoadingState rows={3} />
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

  if (!data || data.total_count === 0) {
    return (
      <BentoCard colSpan={12}>
        <EmptyState
          icon={<UserRoundSearch size={17} strokeWidth={1.5} />}
          message="Ninguém sumindo do próprio padrão de retorno no momento."
        />
      </BentoCard>
    );
  }

  return (
    <BentoCard colSpan={12} glow="pending">
      <p className="mb-1 text-sm font-medium text-ink">Sumindo do próprio padrão</p>
      <p className="mb-4 max-w-2xl text-xs text-ink-muted">
        {data.total_count} paciente{data.total_count > 1 ? "s" : ""} já {data.total_count > 1 ? "estão" : "está"} bem
        além do ritmo de retorno que cada um costuma ter — ainda sem completar 1 ano de ausência. Quanto mais cedo
        ligar, maior a chance de reverter.
      </p>
      <div className="space-y-2.5">
        {data.items.map((patient) => (
          <div
            key={patient.patient_id}
            className="flex items-center justify-between gap-3 rounded-md border border-border-hairline bg-canvas-raised/40 px-3 py-2"
          >
            <span className="truncate text-sm text-ink">{patient.full_name}</span>
            <span className="shrink-0 text-right text-xs text-ink-faint">
              última consulta {formatDate(patient.last_appointment_at)}
              <span className="ml-1.5 font-medium text-pending">({formatRhythm(patient)})</span>
            </span>
          </div>
        ))}
      </div>
      {data.total_count > data.items.length && (
        <p className="mt-3 text-2xs text-ink-faint">
          Mostrando os {data.items.length} mais fora do próprio ritmo de {data.total_count} no total.
        </p>
      )}
    </BentoCard>
  );
}
