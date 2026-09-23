import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CalendarCheck2, ClipboardList, ListChecks, Package, Receipt, Upload } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { ErrorState, LoadingState } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { PeriodWindowSelect } from "@/components/ui/PeriodWindowSelect";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { ContaStatusFunnelPanel } from "@/components/dashboard/ContaStatusFunnelPanel";
import { EstoquePanel } from "@/components/dashboard/EstoquePanel";
import { PepConformidadePanel } from "@/components/dashboard/PepConformidadePanel";
import { AverageTicketPanel } from "@/components/dashboard/AverageTicketPanel";
import { DataFreshnessBanner } from "@/components/dashboard/DataFreshnessBanner";
import { EarlyChurnRiskPanel } from "@/components/dashboard/EarlyChurnRiskPanel";
import { ExecutiveAgendaSummary } from "@/components/dashboard/ExecutiveAgendaSummary";
import { ExecutiveNarrativeBanner } from "@/components/dashboard/ExecutiveNarrativeBanner";
import { FinancialHoleBillingsPanel } from "@/components/dashboard/FinancialHoleBillingsPanel";
import { InactivePatientsPanel } from "@/components/dashboard/InactivePatientsPanel";
import { CommandCenterToday } from "@/components/dashboard/CommandCenterToday";
import { SmartInsightsFeed } from "@/components/dashboard/SmartInsightsFeed";
import { HealthScoreWidget } from "@/components/dashboard/HealthScoreWidget";
import { SatisfactionSummaryWidget } from "@/components/dashboard/SatisfactionSummaryWidget";
import { MarketingChannelsPanel } from "@/components/dashboard/MarketingChannelsPanel";
import { UpsellFunnelPanel } from "@/components/dashboard/UpsellFunnelPanel";
import { OportunidadesPanel } from "@/components/dashboard/OportunidadesPanel";
import { PatientRevenueParetoPanel } from "@/components/dashboard/PatientRevenueParetoPanel";
import { PatientRfmPanel } from "@/components/dashboard/PatientRfmPanel";
import { ProfitabilityPanel } from "@/components/dashboard/ProfitabilityPanel";
import { AgendaPlanPriorityPanel } from "@/components/dashboard/AgendaPlanPriorityPanel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useDateWindow } from "@/lib/useDateWindow";
import { trendFrom } from "@/lib/narrative";
import { firstNameFrom, useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import type { AgendaFocus, ExecutiveSummary } from "@/lib/types";

/** Saudação por horário do dia — mesmo raciocínio de qualquer painel
 * executivo (o de referência do briefing inclusive): "bom dia" às 9h e
 * "boa noite" às 21h não é o mesmo texto, e usar sempre "olá" perderia
 * esse toque pessoal pedido no redesenho. Baseado no relógio do
 * NAVEGADOR do gestor (não do servidor) — é o fuso que importa para
 * quem está lendo a tela. */
function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** "Exportar relatório" (ícone do canvas ao lado do período) — baixa um
 * CSV com os indicadores do período, pronto para abrir no Excel. */
function exportCommandCenterCsv(summary: ExecutiveSummary, dateFrom: string, dateTo: string) {
  const rows: (string | number)[][] = [
    ["Indicador", "Valor", "Período anterior", "Variação (%)"],
    ["Total faturado", summary.total_billed.value, summary.total_billed.previous_value, summary.total_billed.delta_pct ?? ""],
    ["Buraco financeiro", summary.financial_hole.value, summary.financial_hole.previous_value, summary.financial_hole.delta_pct ?? ""],
    ["Caixa protegido", summary.total_value_saved.value, summary.total_value_saved.previous_value, summary.total_value_saved.delta_pct ?? ""],
    ["Divergência de recebimento", summary.payment_gap.value, summary.payment_gap.previous_value, summary.payment_gap.delta_pct ?? ""],
    ["Você faturou do que podia (%)", summary.margin_vs_contracted_pct ?? "", "", ""],
    ["Faturamentos travados por risco", summary.high_risk_pending_count, "", ""],
    ["Recursos com prazo vencendo", summary.appeals_due_soon_count, "", ""],
  ];
  if (summary.avg_days_to_receive) {
    rows.push(["Prazo médio de recebimento (dias)", summary.avg_days_to_receive.value, summary.avg_days_to_receive.previous_value, summary.avg_days_to_receive.delta_pct ?? ""]);
  }
  if (summary.avg_capacity_utilization) {
    rows.push(["Agenda ocupada (%)", summary.avg_capacity_utilization.value * 100, summary.avg_capacity_utilization.previous_value * 100, summary.avg_capacity_utilization.delta_pct ?? ""]);
  }
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sala-de-comando_${dateFrom}_${dateTo}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const TABS_GROUP = "sala-de-comando";
type TabId = "hoje" | "faturamento" | "agenda" | "estoque" | "prontuario";
const TAB_IDS: TabId[] = ["hoje", "faturamento", "agenda", "estoque", "prontuario"];

/** Redesign 2026 (enxugamento aprovado): as 11 abas antigas viraram 5.
 * Links antigos (Home, insights do backend, favoritos) continuam
 * funcionando — cada aba antiga cai onde o conteúdo dela foi parar. */
const LEGACY_TABS: Record<string, TabId> = {
  diagnostico: "faturamento",
  oportunidades: "faturamento",
  comparativo: "faturamento",
  crm: "agenda",
  rentabilidade: "agenda",
  simulador: "hoje",
  capital: "hoje",
  roi: "hoje",
  clinico: "prontuario",
};

export function normalizeCommandCenterTab(value: string | null): TabId {
  if (!value) return "hoje";
  if ((TAB_IDS as string[]).includes(value)) return value as TabId;
  return LEGACY_TABS[value] ?? "hoje";
}

/**
 * Sala de Comando — Redesign 2026, enxugada para as 4 áreas que o
 * gestor acompanha: Hoje · Faturamento · Agenda · Estoque · Prontuário.
 * Cada aba abre com os insights daquela área (o "porquê", em frases) e
 * só depois os números e listas de apoio. Comparativo, Simulador,
 * Capital, ROI, demografia e aniversariantes saíram (decisão de produto:
 * sujeira na tela do gestor); CRM virou "Pacientes a reativar" na Agenda,
 * Oportunidades e Rentabilidade foram para Faturamento e Agenda.
 */
export function ExecutiveOverviewPage() {
  const { windowDays, setWindowDays, dateFrom, dateTo } = useDateWindow(30);
  const { data: profile } = useCurrentUserProfile();
  // Deep-link de aba a partir de fora da Sala de Comando: "?tab=" válido
  // manda; aba antiga cai onde o conteúdo foi parar (LEGACY_TABS);
  // ausente ou inválido abre em "Hoje" (nunca quebra por link velho).
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>(() => normalizeCommandCenterTab(searchParams.get("tab")));
  const navigateTab = (id: string) => setActiveTab(normalizeCommandCenterTab(id));
  // Foco de agenda (ver AgendaFocus, lib/types.ts) — disparado pelos
  // botões de ação dos insights de queda de agenda/agenda ociosa (ver
  // DECISÃO em SmartInsightsFeed.tsx::InsightActionButton). Mora aqui
  // (não dentro de ExecutiveAgendaSummary) porque quem dispara é um
  // componente IRMÃO (SmartInsightsFeed), mais acima na árvore.
  const [agendaFocus, setAgendaFocus] = useState<AgendaFocus | null>(() => {
    const weekday = searchParams.get("weekday");
    const professionalId = searchParams.get("professional");
    if (weekday !== null) return { type: "weekday", weekday: Number(weekday) };
    if (professionalId !== null) return { type: "professional", professionalId };
    return null;
  });

  // Rola até a seção certa quando um link manda pra cá com `?tab=` e
  // `?scrollTo=` (ex.: alerta "material usado e não cobrado" →
  // ?tab=estoque&scrollTo=nao-cobrado). Reage também quando a URL muda
  // com a Sala de Comando já aberta (um botão de insight dentro dela).
  // A seção só existe depois de a aba renderizar, então tenta algumas vezes.
  const tabParam = searchParams.get("tab");
  const scrollParam = searchParams.get("scrollTo");
  useEffect(() => {
    if (tabParam) setActiveTab(normalizeCommandCenterTab(tabParam));
  }, [tabParam]);
  useEffect(() => {
    if (!scrollParam) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      const target = document.getElementById(scrollParam);
      attempts += 1;
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (target || attempts >= 10) window.clearInterval(timer);
    }, 120);
    return () => window.clearInterval(timer);
  }, [scrollParam, tabParam]);

  // A fila "Hoje" pode disparar um foco de agenda (#weekday:/#professional:)
  // de FORA da aba Diagnóstico, onde a seção agenda-resumo (destino do
  // scroll em InsightActionButton) só existe no DOM depois da troca de
  // aba — sem isso, o clique de dentro de "Hoje" focava o paciente certo
  // mas nunca rolava a tela, porque o elemento ainda não tinha montado.
  function handleFocusAgendaFromQueue(focus: AgendaFocus) {
    setActiveTab("agenda");
    setAgendaFocus(focus);
    requestAnimationFrame(() => {
      document.getElementById("agenda-resumo")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ["analytics", "executive-summary", dateFrom, dateTo],
    queryFn: () => apiClient.get<ExecutiveSummary>(`/api/v1/analytics/executive-summary?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sala de Comando"
        subtitle="Onde estamos perdendo dinheiro hoje — e o que fazer primeiro."
        greeting={profile ? `${timeOfDayGreeting()}, ${firstNameFrom(profile.full_name)}.` : undefined}
        action={
          <>
            <PeriodWindowSelect windowDays={windowDays} onChange={setWindowDays} />
            <button
              type="button"
              onClick={() => summary && exportCommandCenterCsv(summary, dateFrom, dateTo)}
              disabled={!summary}
              aria-label="Exportar relatório"
              title="Exportar relatório (CSV)"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border border-border-hairline bg-canvas-raised/40 text-ink transition-colors hover:bg-canvas-raised/70 disabled:opacity-50"
            >
              <Upload aria-hidden size={15} />
            </button>
          </>
        }
      />

      <ExecutiveNarrativeBanner />
      {/* Achado do Dossiê Insighta RCM — sempre visível, fora das abas
          (a pergunta "esse número é de hoje?" vale para qualquer aba
          que o gestor esteja olhando, não só Diagnóstico). */}
      <DataFreshnessBanner />

      <Tabs
        groupId={TABS_GROUP}
        active={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
        items={[
          { id: "hoje", label: "Hoje", icon: ListChecks },
          { id: "faturamento", label: "Faturamento", icon: Receipt },
          { id: "agenda", label: "Agenda", icon: CalendarCheck2 },
          { id: "estoque", label: "Estoque", icon: Package },
          { id: "prontuario", label: "Prontuário", icon: ClipboardList },
        ]}
      />

      {activeTab === "hoje" && (
        <TabPanel id="hoje" groupId={TABS_GROUP}>
          <CommandCenterToday
            dateFrom={dateFrom}
            dateTo={dateTo}
            summary={summary}
            onNavigateTab={navigateTab}
            onFocusAgenda={handleFocusAgendaFromQueue}
          />
        </TabPanel>
      )}

      {activeTab === "faturamento" && (
        <TabPanel id="faturamento" groupId={TABS_GROUP}>
          <div className="space-y-6">
            {/* Faturamento = glosa, buraco financeiro, funil de contas e
                oportunidades de preço. Os insights vêm primeiro (o
                "porquê"), os números logo abaixo, para conferência. */}
            <SmartInsightsFeed dateFrom={dateFrom} dateTo={dateTo} categories={["faturamento", "estrategia"]} onNavigateTab={navigateTab} onFocusAgenda={setAgendaFocus} />
            <HealthScoreWidget />

            {isLoading && <LoadingState variant="cards" rows={6} />}
            {error && <ErrorState message={getApiErrorMessage(error)} />}
            {summary && (
              <section>
                <h2 className="mb-3 text-2xs font-medium uppercase tracking-wide text-ink-faint">Números do período — para conferência</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-12">
                  <KpiCard size="compact" colSpan={2} label="Total faturado" value={formatCurrency(summary.total_billed.value)} numericValue={summary.total_billed.value} format={formatCurrency} tone="revenue" trend={trendFrom(summary.total_billed)} />
                  <KpiCard size="compact" colSpan={2} label="Buraco financeiro" value={formatCurrency(summary.financial_hole.value)} numericValue={summary.financial_hole.value} format={formatCurrency} tone="denied" gradient trend={trendFrom(summary.financial_hole, { invert: true })} />
                  <KpiCard size="compact" colSpan={2} label="Caixa protegido" value={formatCurrency(summary.total_value_saved.value)} numericValue={summary.total_value_saved.value} format={formatCurrency} tone="revenue" gradient trend={trendFrom(summary.total_value_saved)} />
                  <KpiCard
                    size="compact"
                    colSpan={2}
                    label="Você faturou do que podia"
                    value={summary.margin_vs_contracted_pct !== null ? `${summary.margin_vs_contracted_pct.toFixed(1)}%` : "—"}
                    numericValue={summary.margin_vs_contracted_pct ?? undefined}
                    format={summary.margin_vs_contracted_pct !== null ? (n) => `${n.toFixed(1)}%` : undefined}
                    tone="neutral"
                  />
                  <KpiCard
                    size="compact"
                    colSpan={2}
                    label="Faturamentos travados por risco"
                    value={String(summary.high_risk_pending_count)}
                    numericValue={summary.high_risk_pending_count}
                    format={(n) => String(Math.round(n))}
                    tone={summary.high_risk_pending_count > 0 ? "pending" : "neutral"}
                  />
                  <KpiCard
                    size="compact"
                    colSpan={2}
                    label="Prazo médio de recebimento"
                    value={summary.avg_days_to_receive ? `${summary.avg_days_to_receive.value.toFixed(0)} dias` : "—"}
                    numericValue={summary.avg_days_to_receive ? summary.avg_days_to_receive.value : undefined}
                    format={summary.avg_days_to_receive ? (n) => `${n.toFixed(0)} dias` : undefined}
                    tone={summary.avg_days_to_receive && summary.avg_days_to_receive.value >= 60 ? "pending" : "neutral"}
                    trend={summary.avg_days_to_receive ? trendFrom(summary.avg_days_to_receive, { invert: true }) : undefined}
                  />
                </div>
              </section>
            )}

            {/* Destino do action_href="#tab:faturamento" do insight de conta
                parada em auditoria. Sempre "estado agora". */}
            <ContaStatusFunnelPanel />

            {/* id="buraco-financeiro" — destino do botão "Ver contas abaixo do combinado". */}
            <section id="buraco-financeiro">
              <h2 className="mb-3 text-sm font-medium text-ink">Contas abaixo do combinado</h2>
              <FinancialHoleBillingsPanel dateFrom={dateFrom} dateTo={dateTo} />
            </section>

            {/* Antiga aba Oportunidades: contratos com preço abaixo da
                mediana de clínicas parecidas — argumento de renegociação. */}
            <section id="oportunidades">
              <h2 className="mb-3 text-sm font-medium text-ink">Contratos para renegociar</h2>
              <OportunidadesPanel />
            </section>

            <section id="origem-receita" className="space-y-4">
              <h2 className="text-sm font-medium text-ink">De onde vem a receita</h2>
              <AverageTicketPanel dateFrom={dateFrom} dateTo={dateTo} />
              <MarketingChannelsPanel dateFrom={dateFrom} dateTo={dateTo} />
              <PatientRevenueParetoPanel dateFrom={dateFrom} dateTo={dateTo} />
            </section>
          </div>
        </TabPanel>
      )}

      {activeTab === "agenda" && (
        <TabPanel id="agenda" groupId={TABS_GROUP}>
          <div className="space-y-6">
            <SmartInsightsFeed dateFrom={dateFrom} dateTo={dateTo} categories={["agenda"]} onNavigateTab={navigateTab} onFocusAgenda={setAgendaFocus} />

            {summary?.avg_capacity_utilization && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-12">
                <KpiCard
                  size="compact"
                  colSpan={3}
                  label="Agenda ocupada"
                  value={formatPct(summary.avg_capacity_utilization.value)}
                  numericValue={summary.avg_capacity_utilization.value * 100}
                  format={(n) => `${n.toFixed(1)}%`}
                  tone="neutral"
                  trend={trendFrom(summary.avg_capacity_utilization)}
                />
              </div>
            )}

            {/* id="agenda-resumo" — destino dos botões dos insights de agenda
                ("Ver ocupação por profissional", "Ver quem está em risco"…). */}
            <section id="agenda-resumo">
              <h2 className="mb-3 text-sm font-medium text-ink">Ocupação e faltas</h2>
              <ExecutiveAgendaSummary dateFrom={dateFrom} dateTo={dateTo} focus={agendaFocus} onClearFocus={() => setAgendaFocus(null)} />
            </section>

            <AgendaPlanPriorityPanel dateFrom={dateFrom} dateTo={dateTo} />

            {/* Antiga aba Rentabilidade: receita por hora de agenda ocupada. */}
            <section id="rentabilidade">
              <h2 className="mb-3 text-sm font-medium text-ink">Rentabilidade por hora de agenda</h2>
              <ProfitabilityPanel dateFrom={dateFrom} dateTo={dateTo} />
            </section>

            <SatisfactionSummaryWidget />

            {/* id="carteira-inativa" — pacientes a reativar (antigo CRM),
                em estágios: quem já sumiu, quem está indo, quem vale mais. */}
            <section id="carteira-inativa" className="space-y-4">
              <h2 className="text-sm font-medium text-ink">Pacientes a reativar</h2>
              <InactivePatientsPanel />
              <EarlyChurnRiskPanel />
              <PatientRfmPanel />
              <UpsellFunnelPanel dateFrom={dateFrom} dateTo={dateTo} />
            </section>
          </div>
        </TabPanel>
      )}

      {activeTab === "estoque" && (
        <TabPanel id="estoque" groupId={TABS_GROUP}>
          <div className="space-y-6">
            <SmartInsightsFeed dateFrom={dateFrom} dateTo={dateTo} categories={["estoque"]} onNavigateTab={navigateTab} onFocusAgenda={setAgendaFocus} />
            <EstoquePanel dateFrom={dateFrom} dateTo={dateTo} />
          </div>
        </TabPanel>
      )}

      {activeTab === "prontuario" && (
        <TabPanel id="prontuario" groupId={TABS_GROUP}>
          <div className="space-y-6">
            <SmartInsightsFeed dateFrom={dateFrom} dateTo={dateTo} categories={["prontuario"]} onNavigateTab={navigateTab} onFocusAgenda={setAgendaFocus} />
            <PepConformidadePanel dateFrom={dateFrom} dateTo={dateTo} />
          </div>
        </TabPanel>
      )}
    </div>
  );
}
