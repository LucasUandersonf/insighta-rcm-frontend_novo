import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Filter, ShieldAlert, X } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { MediumRiskBillingsPanel } from "@/components/dashboard/MediumRiskBillingsPanel";
import { DenialReasonConfirmationPanel } from "@/components/dashboard/DenialReasonConfirmationPanel";
import { DataQualityPanel } from "@/components/dashboard/DataQualityPanel";
import { useDateWindow } from "@/lib/useDateWindow";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { BillingResponse, PaginatedResponse } from "@/lib/types";

/**
 * Fila de correção (Redesign 2026 — o antigo "Painel" saiu da barra).
 * O Painel era a terceira visão geral da mesma coisa (Home e Sala de
 * Comando já contam a história em frases); o que ele tinha de TRABALHO
 * de verdade era esta fila: faturamentos com risco de glosa, para
 * corrigir antes de enviar ao convênio. Ela ficou, como módulo de
 * Faturamento. "/painel" redireciona para cá (links antigos e o
 * `?insurance_plan_id=` dos insights de glosa por convênio continuam
 * funcionando).
 */
const PAGE_SIZE = 20;

// Rótulo em português para `item_type` (ver ITEM_TYPE_VALUES, backend).
const ITEM_TYPE_LABELS: Record<string, string> = {
  procedimento: "Procedimento",
  material_opme: "OPME",
  taxa: "Taxa",
  diaria: "Diária",
  medicamento: "Medicamento",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function BillingRiskQueuePage() {
  const [offset, setOffset] = useState(0);
  const { dateFrom, dateTo } = useDateWindow(30);
  const [searchParams, setSearchParams] = useSearchParams();
  const filterPlanId = searchParams.get("insurance_plan_id");
  // Insight "profissional fora do padrão de glosa" abre a fila já nas guias dele.
  const filterProfessionalId = searchParams.get("professional_id");
  const filterQuery =
    (filterPlanId ? `&insurance_plan_id=${filterPlanId}` : "") + (filterProfessionalId ? `&professional_id=${filterProfessionalId}` : "");
  const isFiltered = Boolean(filterPlanId || filterProfessionalId);

  const {
    data: highRiskPage,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["billing", "high-risk", offset, filterPlanId, filterProfessionalId],
    queryFn: () =>
      apiClient.get<PaginatedResponse<BillingResponse>>(
        `/api/v1/billing/high-risk?limit=${PAGE_SIZE}&offset=${offset}${filterQuery}`
      ),
  });

  function clearPlanFilter() {
    setSearchParams((params) => {
      params.delete("insurance_plan_id");
      params.delete("professional_id");
      return params;
    });
    setOffset(0);
  }

  const highRiskBillings = highRiskPage?.items ?? [];
  const totalValueSaved = highRiskBillings.reduce((sum, b) => sum + b.value_saved_by_correction, 0);
  const totalAtRisk = highRiskBillings.reduce((sum, b) => sum + b.charged_value, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldAlert}
        title="Fila de correção"
        subtitle="Faturamentos com risco de glosa — corrija antes de enviar ao convênio e a receita não volta recusada."
      />

      <section>
        
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
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

        <Panel
          title="Faturamentos de alto risco"
          subtitle="Do maior valor para o menor — corrija antes de enviar ao convênio."
          glow={(highRiskPage?.total ?? 0) > 0 ? "pending" : "revenue"}
        >
          {isFiltered && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-tier1/25 bg-tier1-bg px-3 py-2 text-xs text-ink">
              <span className="flex items-center gap-1.5">
                <Filter aria-hidden size={12} />
                {filterProfessionalId ? "Filtrando pelas guias de 1 profissional" : "Filtrando por 1 convênio"} — veio de um alerta da Sala de Comando.
              </span>
              <button
                type="button"
                onClick={clearPlanFilter}
                className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-medium text-tier1 hover:bg-canvas-surface/60"
              >
                <X aria-hidden size={11} />
                Limpar filtro
              </button>
            </div>
          )}
          {isLoading && <LoadingState variant="table" rows={5} />}
          {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
          {!isLoading && !error && highRiskBillings.length === 0 && (
            <EmptyState
              icon={<CheckCircle2 size={17} strokeWidth={1.5} />}
              message={
                isFiltered
                  ? "Nenhum faturamento de alto risco neste filtro no momento."
                  : "Nenhum faturamento de alto risco no momento — a fila está limpa."
              }
            />
          )}
          {!isLoading && highRiskBillings.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-medium">Criado em</th>
                  <th className="px-4 py-2.5 font-medium">Valor cobrado</th>
                  <th className="px-4 py-2.5 font-medium">Item</th>
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
                      <td className="px-4 py-2.5 text-ink-muted">
                        {billing.item_type ? ITEM_TYPE_LABELS[billing.item_type] ?? billing.item_type : "—"}
                      </td>
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
            <Pagination total={highRiskPage.total} limit={PAGE_SIZE} offset={offset} onOffsetChange={setOffset} label="Paginação de faturamentos de alto risco" />
          )}
        </Panel>
      </section>

      <MediumRiskBillingsPanel />
      <DenialReasonConfirmationPanel />
      {/* Quem lança atendimento sem CID/procedimento — a origem da glosa (últimos 30 dias). */}
      <DataQualityPanel dateFrom={dateFrom} dateTo={dateTo} />
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}
