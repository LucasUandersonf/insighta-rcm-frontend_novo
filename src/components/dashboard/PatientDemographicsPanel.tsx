import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { PatientDemographics } from "@/lib/types";

/**
 * Achado do Dossiê Insighta RCM — faixa etária/demografia da carteira
 * ativa, a partir de Patient.birth_date (capturado desde sempre, nunca
 * agregado). Segue o seletor de período da tela (carteira ATIVA no
 * período, não um corte fixo).
 */
export function PatientDemographicsPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "patient-demographics", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<PatientDemographics>(`/api/v1/analytics/patient-demographics?date_from=${dateFrom}&date_to=${dateTo}`),
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

  if (!data) return null;

  const totalKnown = data.buckets.reduce((sum, b) => sum + b.patient_count, 0);

  if (totalKnown === 0) {
    return (
      <BentoCard colSpan={12}>
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas-raised text-ink-faint">
            <Users size={17} strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">Faixa etária dos pacientes</p>
            <p className="text-xs text-ink-muted">
              Nenhum paciente com data de nascimento cadastrada atendido neste período ainda.
            </p>
          </div>
        </div>
      </BentoCard>
    );
  }

  const maxCount = Math.max(1, ...data.buckets.map((b) => b.patient_count));

  return (
    <BentoCard colSpan={12}>
      <p className="mb-1 text-sm font-medium text-ink">Faixa etária dos pacientes</p>
      <p className="mb-4 max-w-2xl text-xs text-ink-muted">
        {totalKnown} paciente{totalKnown === 1 ? "" : "s"} atendido{totalKnown === 1 ? "" : "s"} neste período com data de
        nascimento conhecida
        {data.unknown_age_count > 0
          ? ` (${data.unknown_age_count} sem essa informação, fora da contagem).`
          : "."}
      </p>
      <div className="flex flex-col gap-1.5">
        {data.buckets.map((bucket) => (
          <div key={bucket.label} className="flex items-center gap-2 text-xs">
            <span className="w-14 shrink-0 text-right text-ink-faint">{bucket.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas-raised">
              <div
                className="h-full rounded-full bg-revenue"
                style={{ width: bucket.patient_count > 0 ? `${Math.max(4, (bucket.patient_count / maxCount) * 100)}%` : "0%" }}
              />
            </div>
            <span className="tabular w-6 text-ink-muted">{bucket.patient_count}</span>
          </div>
        ))}
      </div>
    </BentoCard>
  );
}
