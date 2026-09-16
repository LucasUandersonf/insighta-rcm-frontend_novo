import { useQuery } from "@tanstack/react-query";
import { Cake } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { PatientBirthdays } from "@/lib/types";

/**
 * Achado do Dossiê Insighta RCM — Patient.birth_date já era capturado
 * pela normalização, mas nenhuma tela listava aniversariantes do mês
 * (ação clássica de relacionamento/retenção de clínica). Mesmo espírito
 * de leitura rápida de InactivePatientsPanel — não reabre o CRUD de
 * Pacientes (decisão de produto: "o SaaS opera exclusivamente sobre
 * dados consolidados do ERP externo"), só nome + dia do aniversário,
 * ordenado por quem faz aniversário primeiro no mês.
 */

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function formatDay(iso: string): string {
  // Só o DIA importa aqui (o ano de nascimento não é o ponto da lista,
  // e extrair via Date(iso) arriscaria deslocar 1 dia por fuso — lê o
  // dia direto da string "YYYY-MM-DD", sem passar por Date).
  return iso.slice(8, 10).replace(/^0/, "");
}

export function BirthdaysPanel() {
  const now = new Date();
  const month = now.getMonth() + 1;

  const { data, isLoading, error } = useQuery({
    queryKey: ["patients", "birthdays", month],
    queryFn: () => apiClient.get<PatientBirthdays>(`/api/v1/patients/birthdays?month=${month}`),
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

  if (!data || data.items.length === 0) {
    return (
      <BentoCard colSpan={12}>
        <EmptyState
          icon={<Cake size={17} strokeWidth={1.5} />}
          message={`Nenhum paciente com data de nascimento cadastrada faz aniversário em ${MONTH_NAMES[month - 1]}.`}
        />
      </BentoCard>
    );
  }

  return (
    <BentoCard colSpan={12}>
      <p className="mb-1 text-sm font-medium text-ink">Aniversariantes de {MONTH_NAMES[month - 1]}</p>
      <p className="mb-4 max-w-2xl text-xs text-ink-muted">
        {data.items.length} paciente{data.items.length > 1 ? "s faz" : " faz"} aniversário este mês — oportunidade de
        contato de relacionamento.
      </p>
      <div className="space-y-2.5">
        {data.items.map((patient) => (
          <div
            key={patient.patient_id}
            className="flex items-center justify-between gap-3 rounded-md border border-border-hairline bg-canvas-raised/40 px-3 py-2"
          >
            <span className="truncate text-sm text-ink">{patient.full_name}</span>
            <span className="shrink-0 text-right text-xs text-ink-faint">
              dia {formatDay(patient.birth_date)}
              {patient.communication_consent === false && (
                <span className="ml-1.5 text-2xs text-ink-faint">(sem consentimento de contato)</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </BentoCard>
  );
}
