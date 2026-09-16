import { useQuery } from "@tanstack/react-query";
import { Panel } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { DenialReasonConfirmation } from "@/lib/types";

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

// Quantos pontos percentuais ACIMA do baseline um motivo precisa estar
// para valer chamar de "confirmado" (cor de alerta) em vez de "parecido
// com a base" (cor neutra) — mesmo espírito de WARNING_DAYS/CRITICAL_DAYS
// em PaymentLagPanel.tsx: um corte nomeado, não um número mágico solto
// no JSX. 15 pontos é um chute de partida (mesma limitação já
// documentada nos demais limiares do produto), não uma calibração
// validada — o valor real de cada motivo é o número já mostrado, esta
// cor é só destaque visual de "vale investigar primeiro".
const CONFIRMED_LIFT_THRESHOLD = 0.15;

function rateToneClass(rate: number, baseline: number): string {
  return rate - baseline >= CONFIRMED_LIFT_THRESHOLD ? "text-denied" : "text-ink-faint";
}

/**
 * Painel → Faturamento: "a regra prevê glosa de verdade, ou é ruído?" —
 * Camada 2 do plano de IA preditiva (pedido direto do usuário: "aprender
 * com o histórico de decisões" em vez de só regras fixas). Contrasta a
 * taxa de glosa REAL (Billing.status = 'denied', não o risco calculado
 * na criação) entre faturamentos sinalizados por cada motivo do motor
 * anti-glosa e o baseline (faturamentos sem nenhum motivo sinalizado) —
 * ver DECISÃO completa em AnalyticsRepository.denial_reason_confirmation_rates
 * (backend). Sem seletor de período: usa todo o histórico já resolvido.
 */
export function DenialReasonConfirmationPanel() {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["analytics", "denial-reason-confirmation"],
    queryFn: () => apiClient.get<DenialReasonConfirmation>("/api/v1/analytics/denial-reason-confirmation"),
  });

  return (
    <Panel
      title="Precisão do motor de risco de glosa"
      subtitle="Taxa real de confirmação por motivo"
      updatedAt={dataUpdatedAt || null}
    >
      {isLoading && (
        <div className="space-y-3 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-3.5 animate-pulse rounded bg-canvas-raised" />
          ))}
        </div>
      )}
      {error && <p className="p-5 text-xs text-denied">{getApiErrorMessage(error)}</p>}
      {!isLoading && !error && data && data.baseline_denial_rate === null && (
        <p className="p-5 text-xs text-ink-faint">
          Ainda sem faturamento resolvido (pago ou glosado de verdade) suficiente para calcular.
        </p>
      )}
      {!isLoading && data && data.baseline_denial_rate !== null && (
        <div className="space-y-2.5 p-5">
          <div className="flex items-center justify-between gap-3 border-b border-border-hairline pb-2.5">
            <span className="text-[12.5px] text-ink-muted">Sem motivo sinalizado (base)</span>
            <span className="tabular text-xs text-ink">{formatPct(data.baseline_denial_rate)}</span>
          </div>
          {data.items.length === 0 ? (
            <p className="pt-1 text-2xs leading-relaxed text-ink-faint">
              Nenhum motivo com amostra suficiente ainda (mínimo {data.min_sample} faturamentos resolvidos por motivo).
            </p>
          ) : (
            data.items.map((item) => (
              <div key={item.reason_code} className="flex items-center justify-between gap-3">
                <span className="truncate text-[12.5px] text-ink-muted" title={item.reason_label}>
                  {item.reason_label}
                </span>
                <span className={`tabular shrink-0 text-xs font-medium ${rateToneClass(item.confirmed_denial_rate, data.baseline_denial_rate!)}`}>
                  {formatPct(item.confirmed_denial_rate)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </Panel>
  );
}
