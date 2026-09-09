import { useQuery } from "@tanstack/react-query";
import { UserRoundX } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { InactivePatients } from "@/lib/types";

/**
 * Carteira de pacientes inativos — a lista real por trás da
 * recomendação "reativar quem já foi cliente e não voltou" do insight
 * de meta anual (ver DECISÃO em smart_insights_engine.py::_annual_goal_insight).
 * Antes o insight só recomendava em texto, sem lugar nenhum pra levar o
 * clique — esta seção é o destino de `#carteira-inativa`.
 *
 * DECISÃO — lista de leitura rápida, NUNCA uma reintrodução do CRUD de
 * Pacientes
 * -------------------------------------------------------------------
 * O CRUD operacional de Pacientes foi removido por decisão de produto
 * (ver App.tsx: "o SaaS opera exclusivamente sobre dados consolidados
 * do ERP externo"). Isto não reabre essa decisão — é só nome + data do
 * último atendimento, ordenado por quem está inativo há mais tempo,
 * pensado como "por onde começar a ligar hoje", igual à lista vermelha
 * de risco de falta que já existe em Agenda & Capacidade.
 */

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

function formatDaysInactive(days: number): string {
  if (days >= 365) {
    const years = Math.floor(days / 365);
    return years === 1 ? "há 1 ano" : `há ${years} anos`;
  }
  const months = Math.floor(days / 30);
  return months <= 1 ? "há mais de 1 mês" : `há ${months} meses`;
}

export function InactivePatientsPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "inactive-patients"],
    queryFn: () => apiClient.get<InactivePatients>("/api/v1/analytics/inactive-patients"),
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
          icon={<UserRoundX size={17} strokeWidth={1.5} />}
          message="Nenhum paciente parado há mais de 1 ano — sua carteira está ativa."
        />
      </BentoCard>
    );
  }

  return (
    <BentoCard colSpan={12} glow="pending">
      <p className="mb-1 text-sm font-medium text-ink">Carteira de pacientes inativos</p>
      <p className="mb-4 max-w-2xl text-xs text-ink-muted">
        {data.total_count} paciente{data.total_count > 1 ? "s" : ""} não {data.total_count > 1 ? "voltam" : "volta"} há
        mais de 1 ano — por onde começar a ligar hoje, do mais parado pro mais recente entre os inativos.
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
              <span className="ml-1.5 font-medium text-pending">({formatDaysInactive(patient.days_since_last_appointment)})</span>
            </span>
          </div>
        ))}
      </div>
      {data.total_count > data.items.length && (
        <p className="mt-3 text-2xs text-ink-faint">
          Mostrando os {data.items.length} mais inativos de {data.total_count} no total.
        </p>
      )}
    </BentoCard>
  );
}
