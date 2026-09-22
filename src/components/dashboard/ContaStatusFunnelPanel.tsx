import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Panel, LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { cn } from "@/lib/cn";
import type { ContaStatusFunnel } from "@/lib/types";

const STAGES: { key: keyof ContaStatusFunnel; label: string; tone: "neutral" | "pending" | "revenue" | "denied" }[] = [
  { key: "aberta", label: "Aberta", tone: "neutral" },
  { key: "pre_faturada", label: "Pré-faturada", tone: "neutral" },
  { key: "faturada", label: "Faturada", tone: "pending" },
  { key: "em_auditoria", label: "Em auditoria", tone: "pending" },
  { key: "glosada_parcial", label: "Glosada parcial", tone: "denied" },
  { key: "fechada", label: "Fechada", tone: "revenue" },
  { key: "cancelada", label: "Cancelada", tone: "neutral" },
];

/**
 * Bloco "Contas" na aba Diagnóstico — primeira superfície analítica da
 * camada de Contas (core.contas), que até esta fase só existia no
 * banco (migração 076) sem nenhuma tela agregada. Mostra a distribuição
 * atual por status (funil do ciclo de vida financeiro de cada conta) e
 * destaca quando há contas paradas em auditoria há muito tempo — o
 * mesmo caso coberto pelo insight `_conta_stale_em_auditoria_insight`
 * no feed (aqui é a tela de destino do `action_href="#tab:diagnostico"`
 * daquele insight, não uma duplicata: o feed avisa, este painel mostra
 * o quadro completo).
 */
export function ContaStatusFunnelPanel() {
  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["analytics", "conta-status-funnel"],
    queryFn: () => apiClient.get<ContaStatusFunnel>("/api/v1/analytics/conta-status-funnel"),
  });

  const total = data ? STAGES.reduce((sum, stage) => sum + (data[stage.key] as number), 0) : 0;

  return (
    <Panel
      title="Contas"
      subtitle="Distribuição das contas por etapa do ciclo financeiro — do atendimento até o fechamento."
      updatedAt={dataUpdatedAt || null}
    >
      {isLoading && <LoadingState variant="cards" rows={4} />}
      {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
      {!isLoading && !error && data && total === 0 && (
        <EmptyState message="Nenhuma conta registrada ainda nesta janela." />
      )}
      {!isLoading && data && total > 0 && (
        <div className="p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {STAGES.map((stage) => (
              <div
                key={stage.key}
                className="flex flex-col gap-1.5 rounded-md border border-border-hairline bg-canvas-raised/40 px-3 py-2.5"
              >
                <span className="text-2xs uppercase tracking-wide text-ink-faint">{stage.label}</span>
                <span className="tabular font-sans text-lg font-semibold text-ink">{data[stage.key] as number}</span>
              </div>
            ))}
          </div>

          {data.stale_em_auditoria_count > 0 && (
            <div
              className={cn(
                "mt-4 flex flex-wrap items-center gap-2.5 rounded-md border border-pending/25 bg-pending-bg px-4 py-3"
              )}
            >
              <AlertTriangle aria-hidden size={15} className="shrink-0 text-pending/80" />
              <p className="text-xs leading-relaxed text-ink">
                {data.stale_em_auditoria_count === 1 ? "1 conta está" : `${data.stale_em_auditoria_count} contas estão`} parada
                {data.stale_em_auditoria_count === 1 ? "" : "s"} em auditoria
                {data.oldest_em_auditoria_age_days !== null && (
                  <> — a mais antiga há {data.oldest_em_auditoria_age_days} dias</>
                )}
                .
              </p>
              <Badge tone="pending">Atenção</Badge>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
