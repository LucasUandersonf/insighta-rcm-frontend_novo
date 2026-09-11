import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CalendarCheck2, CheckCircle2, Filter, Gauge, Receipt, X } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { PeriodWindowSelect } from "@/components/ui/PeriodWindowSelect";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { AgendaAnalyticsPanel } from "@/components/dashboard/AgendaAnalyticsPanel";
import { PlanLossRankingPanel } from "@/components/dashboard/PlanLossRankingPanel";
import { ContractUtilizationPanel } from "@/components/dashboard/ContractUtilizationPanel";
import { DenialRiskDistributionPanel } from "@/components/dashboard/DenialRiskDistributionPanel";
import { PaymentLagPanel } from "@/components/dashboard/PaymentLagPanel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useDateWindow } from "@/lib/useDateWindow";
import { trendFrom } from "@/lib/narrative";
import { useAuth } from "@/context/AuthContext";
import type { BillingResponse, ExecutiveSummary, PaginatedResponse, UserRole } from "@/lib/types";

// "Painel" — a central de BI tradicional (auditoria de dado primário,
// gráfico por gráfico), diferente da "Sala de Comando" (diagnóstico em
// texto + números de apoio). As duas leem os MESMOS endpoints de
// /analytics/* — a diferença é de apresentação, não de dado: aqui o
// número é o elemento principal da tela, sem narrativa em torno dele
// (quem quer o "porquê" em português vai até a Sala de Comando).
//
// Zero Mocks: todo KPI/gráfico abaixo vem de um endpoint real. Nenhum
// placeholder rotulado "exemplo" — o que o backend ainda não agrega,
// simplesmente não aparece aqui.
//
// DECISÃO — sub-abas por domínio (Faturamento/Agenda) em vez de uma
// página só
// -------------------------------------------------------------------
// O Painel cresceu de 3 seções empilhadas para o ponto em que rolar a
// página inteira para comparar dois números do mesmo domínio já era
// desconfortável, e a lista de métricas planejada (ranking de convênio
// por perda, utilização de contrato, lista de risco de falta) só ia
// piorar isso. Dividir por domínio, ao lado de janela de período
// compartilhada, é a mesma tela — mesmos endpoints, mesmo RBAC —, só
// com um seletor de vista em vez de rolagem infinita. "Pacientes" fica
// de fora por ora: não tem massa própria ainda para virar uma terceira
// aba (a lista de risco de falta faz mais sentido dentro de Agenda,
// onde a ação de agendar de fato acontece).
const TABS_GROUP = "painel";

const PAGE_SIZE = 20;

// Espelha o RBAC real do backend (ver _CAN_VIEW em analytics.py e
// require_role(...) em billing.py) — este Painel é a "central de BI"
// da alta cúpula (ver briefing de produto: "não é mais um software
// operacional para recepcionistas"), então "atendimento" nunca teve —
// e continua sem ter — acesso a este dado financeiro/estratégico. Sem
// esse filtro no cliente, esse papel bateria de frente com um 403 do
// backend logo ao entrar (esta é a rota "/" pós-login, para todo papel).
const CAN_VIEW_ANALYTICS: UserRole[] = ["owner", "admin", "financeiro", "auditor"];
const CAN_VIEW_BILLING_QUEUE: UserRole[] = ["owner", "admin", "financeiro"];

// Achado 12 da Auditoria de Templates e Insights (médio) — rótulo em
// português para `item_type` (ver ITEM_TYPE_VALUES, app/models/billing.py
// no backend). Sem uma coluna que mostre isso aqui, o insight de
// "concentração de OPME" (ver _opme_concentration_insight, backend)
// linkava pra esta mesma tela sem nenhum jeito de ver QUAL linha é OPME.
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

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const canViewAnalytics = !!user && CAN_VIEW_ANALYTICS.includes(user.role);
  const canViewBillingQueue = !!user && CAN_VIEW_BILLING_QUEUE.includes(user.role);

  const [offset, setOffset] = useState(0);
  const { windowDays, setWindowDays, dateFrom, dateTo } = useDateWindow(7);
  const [activeTab, setActiveTab] = useState<"faturamento" | "agenda">("faturamento");

  // Deep-link do botão de ação da Sala de Comando (ver DECISÃO em
  // smart_insights_engine.py::_denial_spike_insights, backend): o
  // insight de recusa em alta de um convênio específico já chega aqui
  // com esse parâmetro — a fila abre JÁ FILTRADA, em vez da fila geral
  // que o usuário tinha que vasculhar sozinho pra achar as linhas do
  // convênio certo.
  const [searchParams, setSearchParams] = useSearchParams();
  const filterPlanId = searchParams.get("insurance_plan_id");

  const {
    data: highRiskPage,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["billing", "high-risk", offset, filterPlanId],
    queryFn: () =>
      apiClient.get<PaginatedResponse<BillingResponse>>(
        `/api/v1/billing/high-risk?limit=${PAGE_SIZE}&offset=${offset}${filterPlanId ? `&insurance_plan_id=${filterPlanId}` : ""}`
      ),
    enabled: canViewBillingQueue,
  });

  function clearPlanFilter() {
    setSearchParams((params) => {
      params.delete("insurance_plan_id");
      return params;
    });
    setOffset(0);
  }

  const {
    data: summary,
    isLoading: isSummaryLoading,
    error: summaryError,
  } = useQuery({
    queryKey: ["analytics", "executive-summary", dateFrom, dateTo],
    queryFn: () => apiClient.get<ExecutiveSummary>(`/api/v1/analytics/executive-summary?date_from=${dateFrom}&date_to=${dateTo}`),
    enabled: canViewAnalytics,
  });

  const highRiskBillings = highRiskPage?.items ?? [];
  const totalValueSaved = highRiskBillings.reduce((sum, b) => sum + b.value_saved_by_correction, 0);
  const totalAtRisk = highRiskBillings.reduce((sum, b) => sum + b.charged_value, 0);

  // Faturamento líquido = bruto menos as duas divergências já
  // identificadas no período (cobrança abaixo do contratado + pago pela
  // operadora abaixo do contratado). Não é um número contábil fechado
  // (não inclui, por ex., glosa ainda não conciliada) — é a leitura
  // "líquido do que já sabemos ter vazado", calculada a partir de 3
  // números reais do mesmo endpoint, não um dado novo inventado.
  const netRevenue = summary ? summary.total_billed.value - summary.financial_hole.value - summary.payment_gap.value : null;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Gauge}
        title="Painel"
        subtitle="Auditoria de dado primário — todo indicador disponível, sem narrativa em torno dele. Para o diagnóstico em texto, veja a Sala de Comando."
        action={canViewAnalytics && <PeriodWindowSelect windowDays={windowDays} onChange={setWindowDays} />}
      />

      {!canViewAnalytics && !canViewBillingQueue && (
        <Panel>
          <EmptyState
            icon={<Gauge size={17} strokeWidth={1.5} />}
            message="Este painel reúne dado financeiro e estratégico da clínica — fale com o financeiro, administrador(a) ou proprietário(a) para solicitar acesso."
          />
        </Panel>
      )}

      {canViewAnalytics && (
        <Tabs
          groupId={TABS_GROUP}
          active={activeTab}
          onChange={(id) => setActiveTab(id as "faturamento" | "agenda")}
          items={[
            { id: "faturamento", label: "Faturamento", icon: Receipt },
            { id: "agenda", label: "Agenda", icon: CalendarCheck2 },
          ]}
        />
      )}

      {canViewAnalytics && activeTab === "faturamento" && (
      <TabPanel id="faturamento" groupId={TABS_GROUP}>
      <div className="space-y-6">
      {isSummaryLoading && <LoadingState variant="cards" rows={6} />}
      {summaryError && <ErrorState message={getApiErrorMessage(summaryError)} />}

      {summary && (
        <section>
          <h2 className="mb-3 text-2xs font-medium uppercase tracking-wide text-ink-faint">Indicadores do período selecionado</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
            <KpiCard
              colSpan={3}
              label="Faturamento bruto"
              value={formatCurrency(summary.total_billed.value)}
              numericValue={summary.total_billed.value}
              format={formatCurrency}
              tone="revenue"
              gradient
              trend={trendFrom(summary.total_billed)}
            />
            <KpiCard
              colSpan={3}
              label="Faturamento líquido (estimado)"
              value={netRevenue !== null ? formatCurrency(netRevenue) : "—"}
              numericValue={netRevenue ?? undefined}
              format={netRevenue !== null ? formatCurrency : undefined}
              tone="neutral"
              narrative="Bruto menos divergência de cobrança e de recebimento já identificadas no período — não inclui glosa ainda não conciliada."
            />
            <KpiCard
              colSpan={3}
              label="Perda por divergência de cobrança"
              value={formatCurrency(summary.financial_hole.value)}
              numericValue={summary.financial_hole.value}
              format={formatCurrency}
              tone="denied"
              trend={trendFrom(summary.financial_hole, { invert: true })}
              narrative="Valor cobrado abaixo da tabela contratada com o convênio — subprecificação, não glosa."
            />
            <KpiCard
              colSpan={3}
              label="Perda por divergência de recebimento"
              value={formatCurrency(summary.payment_gap.value)}
              numericValue={summary.payment_gap.value}
              format={formatCurrency}
              tone="denied"
              trend={trendFrom(summary.payment_gap, { invert: true })}
              narrative="Billings já conciliados em que a operadora pagou abaixo do valor contratado."
            />
            <KpiCard
              colSpan={3}
              label="Valor em risco de glosa"
              value={formatCurrency(summary.denial_at_risk_value)}
              numericValue={summary.denial_at_risk_value}
              format={formatCurrency}
              tone={summary.denial_at_risk_value > 0 ? "pending" : "revenue"}
              narrative={
                summary.denial_risk_pct !== null
                  ? `${summary.denial_risk_pct.toFixed(1)}% do valor faturado no período tem risco de glosa médio ou alto.`
                  : undefined
              }
            />
            <KpiCard
              colSpan={3}
              label="Caixa protegido (motor anti-glosa)"
              value={formatCurrency(summary.total_value_saved.value)}
              numericValue={summary.total_value_saved.value}
              format={formatCurrency}
              tone="revenue"
              gradient
              trend={trendFrom(summary.total_value_saved)}
            />
            <KpiCard
              colSpan={3}
              label="Ocupação média da agenda"
              value={summary.avg_capacity_utilization ? formatPct(summary.avg_capacity_utilization.value) : "—"}
              numericValue={summary.avg_capacity_utilization ? summary.avg_capacity_utilization.value * 100 : undefined}
              format={summary.avg_capacity_utilization ? (n) => `${n.toFixed(1)}%` : undefined}
              tone="neutral"
              trend={summary.avg_capacity_utilization ? trendFrom(summary.avg_capacity_utilization) : undefined}
            />
            <KpiCard
              colSpan={3}
              label="Margem vs. tabela contratada"
              value={summary.margin_vs_contracted_pct !== null ? `${summary.margin_vs_contracted_pct.toFixed(1)}%` : "—"}
              numericValue={summary.margin_vs_contracted_pct ?? undefined}
              format={summary.margin_vs_contracted_pct !== null ? (n) => `${n.toFixed(1)}%` : undefined}
              tone="neutral"
            />
            <KpiCard
              colSpan={3}
              label="Recursos de glosa com prazo vencendo"
              value={String(summary.appeals_due_soon_count)}
              numericValue={summary.appeals_due_soon_count}
              format={(n) => String(Math.round(n))}
              tone={summary.appeals_due_soon_count > 0 ? "denied" : "revenue"}
            />
            {/* Achado 2 da auditoria "Veredito do Gestor Clínico": PMR
                (Prazo Médio de Recebimento) — billing.created_at/settled_at
                sempre existiram no banco, mas nenhum indicador calculava
                essa diferença. null quando não há billing conciliado no
                período (amostra vazia, não "0 dias"). */}
            <KpiCard
              colSpan={3}
              label="Prazo médio de recebimento"
              value={summary.avg_days_to_receive ? `${summary.avg_days_to_receive.value.toFixed(0)} dias` : "—"}
              numericValue={summary.avg_days_to_receive ? summary.avg_days_to_receive.value : undefined}
              format={summary.avg_days_to_receive ? (n) => `${n.toFixed(0)} dias` : undefined}
              tone={summary.avg_days_to_receive && summary.avg_days_to_receive.value >= 60 ? "pending" : "neutral"}
              trend={summary.avg_days_to_receive ? trendFrom(summary.avg_days_to_receive, { invert: true }) : undefined}
              narrative="Média entre faturamento e recebimento — só contas já conciliadas."
            />
          </div>
        </section>
      )}

      {summary && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PlanLossRankingPanel dateFrom={dateFrom} dateTo={dateTo} />
          <ContractUtilizationPanel dateFrom={dateFrom} dateTo={dateTo} />
          <DenialRiskDistributionPanel dateFrom={dateFrom} dateTo={dateTo} />
          <PaymentLagPanel dateFrom={dateFrom} dateTo={dateTo} />
        </section>
      )}

      {canViewBillingQueue && (
      <section>
        <h2 className="mb-3 text-sm font-medium text-ink">Fila de correção agora — faturamentos de alto risco</h2>
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
          subtitle="Ordenado por criação — dados reais de GET /billing/high-risk"
          glow={(highRiskPage?.total ?? 0) > 0 ? "pending" : "revenue"}
        >
          {filterPlanId && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-tier1/25 bg-tier1-bg px-3 py-2 text-xs text-ink">
              <span className="flex items-center gap-1.5">
                <Filter aria-hidden size={12} />
                Filtrando por 1 convênio — veio de um card da Sala de Comando.
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
                filterPlanId
                  ? "Nenhum faturamento de alto risco deste convênio no momento."
                  : "Nenhum faturamento de alto risco no momento — a agenda está limpa."
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
            <Pagination total={highRiskPage.total} limit={PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />
          )}
        </Panel>
      </section>
      )}
      </div>
      </TabPanel>
      )}

      {canViewAnalytics && activeTab === "agenda" && (
      <TabPanel id="agenda" groupId={TABS_GROUP}>
        <AgendaAnalyticsPanel dateFrom={dateFrom} dateTo={dateTo} />
      </TabPanel>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}
