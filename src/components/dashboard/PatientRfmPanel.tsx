import { useQuery } from "@tanstack/react-query";
import { Panel } from "@/components/ui/Panel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { RegisterOutreachButton } from "@/components/dashboard/RegisterOutreachButton";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { RfmResponse, RfmSegment } from "@/lib/types";

/**
 * RFM completo (Gaps Dossiê Insighta RCM, item 4) — Recência,
 * Frequência e Valor combinados, segmentando toda a carteira com
 * histórico. Ver DECISÃO completa em app/services/rfm_engine.py
 * (backend) sobre os 7 segmentos e os limiares usados.
 *
 * `segment_counts` dá a visão panorâmica ("quantos campeões, quantos em
 * risco"); `action_items` é a fila real de quem precisa de contato
 * agora — os dois segmentos de maior urgência de reativação, maior
 * receita histórica primeiro (mais R$ em risco por paciente).
 */

const SEGMENT_CONFIG: Record<RfmSegment, { label: string; tone: BadgeTone }> = {
  campeoes: { label: "Campeões", tone: "revenue" },
  fieis: { label: "Fiéis", tone: "accent" },
  nao_pode_perder: { label: "Não pode perder", tone: "denied" },
  em_risco: { label: "Em risco", tone: "pending" },
  novos: { label: "Novos", tone: "comparativo" },
  hibernando: { label: "Hibernando", tone: "neutral" },
  precisa_atencao: { label: "Precisa de atenção", tone: "novo" },
};

// Ordem fixa (mais valioso -> menos valioso), independente da ordem em
// que o backend devolve os grupos — mesmo espírito de LEVEL_ORDER em
// DenialRiskDistributionPanel.tsx.
const SEGMENT_ORDER: RfmSegment[] = ["campeoes", "fieis", "nao_pode_perder", "em_risco", "novos", "hibernando", "precisa_atencao"];

function formatCurrencyCompact(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

export function PatientRfmPanel() {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["analytics", "patient-rfm"],
    queryFn: () => apiClient.get<RfmResponse>("/api/v1/analytics/patient-rfm"),
  });

  const countBySegment = new Map((data?.segment_counts ?? []).map((row) => [row.segment, row.patient_count]));

  return (
    <Panel
      title="RFM: quem são seus pacientes"
      subtitle={data ? `${data.total_patients} paciente${data.total_patients === 1 ? "" : "s"} com histórico, por segmento` : undefined}
      updatedAt={dataUpdatedAt || null}
    >
      {isLoading && (
        <div className="space-y-3 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded-md bg-canvas-raised" />
          ))}
        </div>
      )}
      {error && <p className="p-5 text-xs text-denied">{getApiErrorMessage(error)}</p>}
      {!isLoading && !error && data && data.total_patients === 0 && (
        <p className="p-5 text-xs text-ink-faint">Nenhum paciente com histórico de atendimento ainda.</p>
      )}
      {!isLoading && data && data.total_patients > 0 && (
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            {SEGMENT_ORDER.map((segment) => (
              <Badge key={segment} tone={SEGMENT_CONFIG[segment].tone}>
                {SEGMENT_CONFIG[segment].label}: {countBySegment.get(segment) ?? 0}
              </Badge>
            ))}
          </div>
          {data.action_items.length === 0 ? (
            <p className="text-xs text-ink-faint">Nenhum paciente de alto valor ou frequência sumiu — carteira saudável.</p>
          ) : (
            <div className="space-y-2.5">
              <p className="text-2xs font-medium uppercase tracking-wide text-ink-faint">Fila de reativação prioritária</p>
              {data.action_items.map((item) => (
                <div
                  key={item.patient_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-hairline bg-canvas-raised/40 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm text-ink">{item.full_name}</span>
                    <Badge tone={SEGMENT_CONFIG[item.segment].tone}>{SEGMENT_CONFIG[item.segment].label}</Badge>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-right text-xs text-ink-faint">
                      {formatCurrencyCompact(item.total_revenue)} históricos
                      <span className="ml-1.5">· sumiu há {item.days_since_last_appointment}d</span>
                      {item.last_outreach_at && <span className="ml-1.5 text-revenue">· já contatado</span>}
                    </span>
                    <RegisterOutreachButton
                      patientId={item.patient_id}
                      patientName={item.full_name}
                      invalidateKeys={[["analytics", "patient-rfm"]]}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
