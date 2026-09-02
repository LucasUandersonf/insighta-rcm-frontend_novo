import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Gauge } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { BillingResponse, PaginatedResponse } from "@/lib/types";

// "Painel" — visão operacional do dia a dia (quem precisa de atenção
// AGORA), diferente da "Sala de Comando" (visão estratégica/período).
// Zero Mocks: esta página só mostra o que é real — GET /billing/high-risk
// — sem KPI nem gráfico de exemplo. Um card de placeholder rotulado
// "exemplo" foi removido daqui de propósito (não fingimos ter uma métrica
// que ainda não existe; a Sala de Comando é onde o dado agregado real
// vive, em /decisao).

const PAGE_SIZE = 20;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}

export function DashboardPage() {
  const [offset, setOffset] = useState(0);

  const {
    data: highRiskPage,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["billing", "high-risk", offset],
    queryFn: () =>
      apiClient.get<PaginatedResponse<BillingResponse>>(`/api/v1/billing/high-risk?limit=${PAGE_SIZE}&offset=${offset}`),
  });

  const highRiskBillings = highRiskPage?.items ?? [];
  const totalValueSaved = highRiskBillings.reduce((sum, b) => sum + b.value_saved_by_correction, 0);
  const totalAtRisk = highRiskBillings.reduce((sum, b) => sum + b.charged_value, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Gauge}
        title="Painel"
        subtitle="O que precisa da sua atenção agora — para a visão estratégica de período, veja a Sala de Comando."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <KpiCard
          colSpan={6}
          label="Faturamentos de alto risco em aberto"
          value={isLoading ? "..." : String(highRiskPage?.total ?? 0)}
          numericValue={isLoading ? undefined : (highRiskPage?.total ?? 0)}
          format={(n) => String(Math.round(n))}
          tone={(highRiskPage?.total ?? 0) > 0 ? "pending" : "revenue"}
          narrative={
            !isLoading && highRiskPage
              ? highRiskPage.total > 0
                ? `Juntos, somam ${formatCurrency(totalAtRisk)} em risco de glosa nesta página — corrija antes do envio para não perder essa receita.`
                : "Nenhum faturamento de alto risco em aberto — a fila de correção está limpa."
              : undefined
          }
        />
        <KpiCard
          colSpan={6}
          label="Valor salvo por correção automática (nesta página)"
          value={isLoading ? "..." : formatCurrency(totalValueSaved)}
          numericValue={isLoading ? undefined : totalValueSaved}
          format={formatCurrency}
          tone="revenue"
          narrative={
            !isLoading && totalValueSaved > 0
              ? "Esse valor é receita que já teria sido glosada se o motor anti-glosa não tivesse sinalizado a correção antes do envio."
              : undefined
          }
        />
      </div>

      <Panel title="Faturamentos de alto risco" subtitle="Ordenado por criação — dados reais de GET /billing/high-risk">
        {isLoading && <LoadingState variant="table" rows={5} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
        {!isLoading && !error && highRiskBillings.length === 0 && (
          <EmptyState icon={<CheckCircle2 size={17} strokeWidth={1.5} />} message="Nenhum faturamento de alto risco no momento — a agenda está limpa." />
        )}
        {!isLoading && highRiskBillings.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Criado em</th>
                <th className="px-4 py-2.5 font-medium">Valor cobrado</th>
                <th className="px-4 py-2.5 font-medium">Risco</th>
                <th className="px-4 py-2.5 font-medium">Motivos</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Valor salvo</th>
              </tr>
            </thead>
            <tbody>
              {highRiskBillings
                .slice()
                .sort((a, b) => b.charged_value - a.charged_value)
                .map((billing) => (
                  <tr key={billing.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                    <td className="px-4 py-2.5 text-ink-muted">{formatDate(billing.created_at)}</td>
                    <td className="tabular px-4 py-2.5 font-mono text-ink">{formatCurrency(billing.charged_value)}</td>
                    <td className="px-4 py-2.5">
                      <RiskBadge level={billing.denial_risk_level} />
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{billing.denial_reasons.join(", ")}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{billing.status}</td>
                    <td className="tabular px-4 py-2.5 text-right font-mono text-revenue">
                      {billing.value_saved_by_correction > 0 ? formatCurrency(billing.value_saved_by_correction) : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
        {highRiskPage && highRiskPage.total > 0 && (
          <Pagination total={highRiskPage.total} limit={PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />
        )}
      </Panel>
    </div>
  );
}
