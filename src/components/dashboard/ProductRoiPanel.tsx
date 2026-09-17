import { useQuery } from "@tanstack/react-query";
import { BentoCard, BentoGrid } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState } from "@/components/ui/Panel";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { ProductRoi } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${iso}T00:00:00`));
}

/**
 * Épico F4.4 do Plano Diretor ("Prova de ROI do próprio produto") —
 * soma três componentes REAIS, nunca hipotéticos, cada um já medido em
 * outro lugar do produto:
 *
 * 1. Valor protegido pelo motor anti-glosa (denial_risk_engine corrige
 *    ANTES de enviar ao convênio).
 * 2. Valor recuperado em recursos de glosa GANHOS (status='deferido') —
 *    dinheiro que seria perdido sem o recurso protocolado a tempo do
 *    prazo que o produto avisa.
 * 3. Ganho REAL medido (não prometido) em qualquer insight que um
 *    gestor marcou como resolvido e o produto reavaliou depois (F1.2) —
 *    inclui ganhos de renegociação de contrato, mas não se limita a eles.
 *
 * Cumulativo desde o primeiro faturamento, nunca uma janela de período
 * — é "quanto a Insighta já te ajudou a proteger/recuperar/ganhar",
 * não um cartão de "esta semana".
 */
export function ProductRoiPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "product-roi"],
    queryFn: () => apiClient.get<ProductRoi>("/api/v1/analytics/product-roi"),
  });

  if (isLoading) return <LoadingState variant="cards" rows={2} />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <BentoGrid>
        <BentoCard colSpan={12} glow="revenue" className="flex flex-col items-center justify-center py-8 text-center">
          <span className="text-2xs font-medium uppercase tracking-wide text-ink-faint">
            Quanto a Insighta já protegeu e recuperou pra você
            {data.tracking_since && <> desde {formatDate(data.tracking_since)}</>}
          </span>
          <div className="mt-2 bg-grad-revenue bg-clip-text font-sans text-5xl font-semibold tracking-tightest text-transparent drop-shadow-[0_0_24px_hsl(var(--revenue)/0.35)]">
            <AnimatedNumber value={data.total_roi_value} format={formatCurrency} durationSeconds={0.8} />
          </div>
          {data.total_roi_value === 0 && (
            <p className="mt-3 max-w-md text-2xs text-ink-muted">
              Ainda não há nenhum valor protegido, recuperado ou realizado registrado — esse número cresce conforme
              o faturamento entra no sistema e os recursos de glosa e insights vão sendo resolvidos.
            </p>
          )}
        </BentoCard>
      </BentoGrid>

      <BentoGrid>
        <BentoCard colSpan={4}>
          <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-ink-faint">Protegido contra glosa</p>
          <p className="font-mono text-xl tabular text-ink">{formatCurrency(data.protected_from_denial_value)}</p>
          <p className="mt-1.5 text-2xs text-ink-faint">
            Corrigido pelo motor anti-glosa antes de enviar ao convênio.
          </p>
        </BentoCard>
        <BentoCard colSpan={4}>
          <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-ink-faint">Recuperado em recursos</p>
          <p className="font-mono text-xl tabular text-ink">{formatCurrency(data.recovered_appeals_value)}</p>
          <p className="mt-1.5 text-2xs text-ink-faint">
            {data.recovered_appeals_count} recurso(s) de glosa ganho(s), protocolado(s) a tempo do prazo.
          </p>
        </BentoCard>
        <BentoCard colSpan={4}>
          <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-ink-faint">Ganho realizado</p>
          <p className="font-mono text-xl tabular text-ink">{formatCurrency(data.realized_insight_outcomes_value)}</p>
          <p className="mt-1.5 text-2xs text-ink-faint">
            {data.realized_insight_outcomes_count} insight(s) resolvido(s) e reavaliado(s) — inclui renegociação de
            contrato.
          </p>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
