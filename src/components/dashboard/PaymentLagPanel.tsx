import { useQuery } from "@tanstack/react-query";
import { Panel } from "@/components/ui/Panel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { PaymentLagByPlan } from "@/lib/types";

const MAX_ROWS = 5;

// Mesmos limiares de _payment_lag_insight (smart_insights_engine.py,
// backend) — a cor da barra precisa bater com o que o card de insight
// já classificou como "preocupante", nunca uma leitura visual diferente
// do mesmo número.
const WARNING_DAYS = 60;
const CRITICAL_DAYS = 90;

function barToneClass(days: number): string {
  if (days >= CRITICAL_DAYS) return "bg-denied";
  if (days >= WARNING_DAYS) return "bg-pending";
  return "bg-revenue";
}

/**
 * Painel → Faturamento: ranking de PMR (Prazo Médio de Recebimento) por
 * convênio — achado da auditoria "Veredito do Gestor Clínico" (Seção 4,
 * Achado 2): billing.created_at/settled_at sempre existiram no banco,
 * mas nenhuma tela mostrava essa diferença. Mesmo formato de "escaneio
 * rápido" de PlanLossRankingPanel (lista de barra compacta, pior
 * primeiro) — quem precisa investigar convênio a convênio já tem essa
 * lista aqui, não é preciso abrir uma tela nova.
 */
export function PaymentLagPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "payment-lag-by-plan", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<PaymentLagByPlan>(`/api/v1/analytics/payment-lag-by-plan?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  const plans = (data?.items ?? []).slice(0, MAX_ROWS);
  const maxDays = Math.max(...plans.map((p) => p.avg_days_to_receive), 1);

  return (
    <Panel title="Prazo de recebimento por convênio" subtitle="Pior prazo primeiro">
      {isLoading && (
        <div className="space-y-3 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[7px] animate-pulse rounded-full bg-canvas-raised" />
          ))}
        </div>
      )}
      {error && <p className="p-5 text-xs text-denied">{getApiErrorMessage(error)}</p>}
      {!isLoading && !error && plans.length === 0 && (
        <p className="p-5 text-xs text-ink-faint">Nenhum faturamento conciliado por convênio nesta janela.</p>
      )}
      {!isLoading && plans.length > 0 && (
        <div className="space-y-3 p-5">
          {plans.map((plan) => (
            <div key={plan.insurance_plan_id} className="flex items-center gap-3">
              <span className="w-[168px] shrink-0 truncate text-[12.5px] text-ink-muted">{plan.insurance_plan_name}</span>
              <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-canvas-raised">
                <div
                  className={`h-full rounded-full ${barToneClass(plan.avg_days_to_receive)}`}
                  style={{ width: `${(plan.avg_days_to_receive / maxDays) * 100}%` }}
                />
              </div>
              <span className="tabular w-16 shrink-0 text-right text-xs text-ink">{plan.avg_days_to_receive.toFixed(0)} dias</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
