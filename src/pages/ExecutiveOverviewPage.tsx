import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Upload, Award, BadgeDollarSign, ClipboardList, HeartHandshake, Landmark, LayoutDashboard, ListChecks, Package, SlidersHorizontal, Target, Users } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { ErrorState, LoadingState } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { PeriodWindowSelect } from "@/components/ui/PeriodWindowSelect";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { CrmPanel } from "@/components/dashboard/CrmPanel";
import { ContaStatusFunnelPanel } from "@/components/dashboard/ContaStatusFunnelPanel";
import { EstoquePanel } from "@/components/dashboard/EstoquePanel";
import { PepConformidadePanel } from "@/components/dashboard/PepConformidadePanel";
import { AverageTicketPanel } from "@/components/dashboard/AverageTicketPanel";
import { BirthdaysPanel } from "@/components/dashboard/BirthdaysPanel";
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
import { NetworkBenchmarkPanel } from "@/components/dashboard/NetworkBenchmarkPanel";
import { MarketingChannelsPanel } from "@/components/dashboard/MarketingChannelsPanel";
import { UpsellFunnelPanel } from "@/components/dashboard/UpsellFunnelPanel";
import { OportunidadesPanel } from "@/components/dashboard/OportunidadesPanel";
import { PatientDemographicsPanel } from "@/components/dashboard/PatientDemographicsPanel";
import { PatientRevenueParetoPanel } from "@/components/dashboard/PatientRevenueParetoPanel";
import { PatientRfmPanel } from "@/components/dashboard/PatientRfmPanel";
import { ProfitabilityPanel } from "@/components/dashboard/ProfitabilityPanel";
import { SimuladorPanel } from "@/components/dashboard/SimuladorPanel";
import { CapitalDecisionPanel } from "@/components/dashboard/CapitalDecisionPanel";
import { ProductRoiPanel } from "@/components/dashboard/ProductRoiPanel";
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
type TabId = "hoje" | "diagnostico" | "crm" | "oportunidades" | "comparativo" | "simulador" | "capital" | "rentabilidade" | "roi" | "estoque" | "clinico";
const TAB_IDS: TabId[] = [
  "hoje", "diagnostico", "crm", "oportunidades", "comparativo", "simulador", "capital", "rentabilidade", "roi", "estoque", "clinico",
];

function isTabId(value: string | null): value is TabId {
  return !!value && (TAB_IDS as string[]).includes(value);
}

/**
 * Sala de Comando 2.0 (ver Roadmap "Sala de Comando 2.0") — a mesma
 * filosofia "menos BI, mais consultor" do redesenho original, agora
 * organizada em abas: Diagnóstico continua sendo o feed de insights +
 * números de apoio (nada mudou aí, só ganhou companhia); Oportunidades/
 * Comparativo/Simulador são views novas, dedicadas, para o que não
 * cabe num card de leitura passiva (lista explorável, comparação com
 * a rede, ferramenta interativa).
 */
export function ExecutiveOverviewPage() {
  const { windowDays, setWindowDays, dateFrom, dateTo } = useDateWindow(30);
  const { data: profile } = useCurrentUserProfile();
  // Deep-link de aba/foco a partir de fora da Sala de Comando (Avaliação
  // Home/Sala de Comando, Achado 2) — "?tab=" explícito e válido manda
  // (ex: clique em um card da Home que aponta pra "?tab=crm"); "?tab="
  // ausente vira "hoje" (Épico F1.1 do Plano Diretor: a fila única já
  // chega ordenada por impacto, o gestor não escolhe mais aba antes de
  // saber o que fazer); "?tab=" presente mas inválido cai no fallback
  // antigo "diagnostico" (nunca quebra a tela por um link velho/errado).
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const tab = searchParams.get("tab");
    if (tab === null) return "hoje";
    return isTabId(tab) ? tab : "diagnostico";
  });
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

  // Mesmo achado do Achado 2 — rola até a seção certa quando a Home
  // manda pra cá com `?scrollTo=` (ex: "#agenda-resumo"/"#buraco-financeiro",
  // os mesmos anchors que o InsightActionButton já resolve localmente
  // dentro da própria Sala de Comando). Só na montagem, uma vez.
  useEffect(() => {
    const scrollTo = searchParams.get("scrollTo");
    if (scrollTo) {
      document.getElementById(scrollTo)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A fila "Hoje" pode disparar um foco de agenda (#weekday:/#professional:)
  // de FORA da aba Diagnóstico, onde a seção agenda-resumo (destino do
  // scroll em InsightActionButton) só existe no DOM depois da troca de
  // aba — sem isso, o clique de dentro de "Hoje" focava o paciente certo
  // mas nunca rolava a tela, porque o elemento ainda não tinha montado.
  function handleFocusAgendaFromQueue(focus: AgendaFocus) {
    setActiveTab("diagnostico");
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
            {(activeTab === "hoje" || activeTab === "diagnostico" || activeTab === "rentabilidade" || activeTab === "estoque" || activeTab === "clinico") && (
              <PeriodWindowSelect windowDays={windowDays} onChange={setWindowDays} />
            )}
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
          { id: "diagnostico", label: "Diagnóstico", icon: LayoutDashboard },
          { id: "crm", label: "CRM", icon: HeartHandshake },
          { id: "oportunidades", label: "Oportunidades", icon: Target },
          { id: "comparativo", label: "Comparativo", icon: Users },
          { id: "rentabilidade", label: "Rentabilidade", icon: BadgeDollarSign },
          { id: "simulador", label: "Simulador", icon: SlidersHorizontal },
          { id: "capital", label: "Capital", icon: Landmark },
          { id: "roi", label: "ROI", icon: Award },
          { id: "estoque", label: "Estoque", icon: Package },
          { id: "clinico", label: "Clínico", icon: ClipboardList },
        ]}
      />

      {activeTab === "hoje" && (
        <TabPanel id="hoje" groupId={TABS_GROUP}>
          <CommandCenterToday
            dateFrom={dateFrom}
            dateTo={dateTo}
            summary={summary}
            onNavigateTab={(id) => setActiveTab(id as TabId)}
            onFocusAgenda={handleFocusAgendaFromQueue}
          />
        </TabPanel>
      )}

      {activeTab === "diagnostico" && (
        <TabPanel id="diagnostico" groupId={TABS_GROUP}>
          <div className="space-y-6">
            {/* Nota de saúde financeira — widget PERSISTENTE, diferente do
                feed abaixo (que troca de manchete conforme o que dói mais
                na semana): é um estado que se acompanha ao longo do tempo. */}
            <HealthScoreWidget />

            {/* "Equilíbrio Insighta" (Balanced Scorecard, perna Cliente) —
                mesmo espírito de widget persistente do HealthScoreWidget
                acima, só que olhando satisfação do paciente em vez de
                saúde financeira. */}
            <SatisfactionSummaryWidget />

            {/* Redesenho "menos BI, mais consultor": o diagnóstico em texto
                vem PRIMEIRO — é a resposta direta à pergunta "onde estamos
                perdendo dinheiro hoje?". Os números continuam existindo
                logo abaixo, como evidência de apoio para quem quer
                conferir, não como o elemento principal da tela. */}
            <SmartInsightsFeed
              dateFrom={dateFrom}
              dateTo={dateTo}
              onNavigateTab={(id) => setActiveTab(id as TabId)}
              onFocusAgenda={setAgendaFocus}
            />

            {isLoading && <LoadingState variant="cards" rows={6} />}
            {error && <ErrorState message={getApiErrorMessage(error)} />}

            {summary && (
              <section>
                <h2 className="mb-3 text-2xs font-medium uppercase tracking-wide text-ink-faint">Números do período — para conferência</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-12">
                  <KpiCard
                    size="compact"
                    colSpan={2}
                    label="Buraco financeiro"
                    value={formatCurrency(summary.financial_hole.value)}
                    numericValue={summary.financial_hole.value}
                    format={formatCurrency}
                    tone="denied"
                    gradient
                    trend={trendFrom(summary.financial_hole, { invert: true })}
                  />
                  <KpiCard
                    size="compact"
                    colSpan={2}
                    label="Caixa protegido"
                    value={formatCurrency(summary.total_value_saved.value)}
                    numericValue={summary.total_value_saved.value}
                    format={formatCurrency}
                    tone="revenue"
                    gradient
                    trend={trendFrom(summary.total_value_saved)}
                  />
                  <KpiCard
                    size="compact"
                    colSpan={2}
                    label="Você faturou do que podia"
                    value={summary.margin_vs_contracted_pct !== null ? `${summary.margin_vs_contracted_pct.toFixed(1)}%` : "—"}
                    numericValue={summary.margin_vs_contracted_pct ?? undefined}
                    format={summary.margin_vs_contracted_pct !== null ? (n) => `${n.toFixed(1)}%` : undefined}
                    tone="neutral"
                  />
                  {/* DECISÃO — rótulo corrigido (era "Faturamento retido", dando
                      a entender que era um valor em R$; o número por baixo
                      sempre foi uma CONTAGEM de faturamentos travados
                      esperando revisão de risco, nunca dinheiro — ver
                      high_risk_pending_count em app/repositories/reporting_repository.py,
                      backend). O rótulo agora descreve o que o número
                      realmente é. */}
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
                    label="Total faturado"
                    value={formatCurrency(summary.total_billed.value)}
                    numericValue={summary.total_billed.value}
                    format={formatCurrency}
                    tone="revenue"
                    trend={trendFrom(summary.total_billed)}
                  />
                  <KpiCard
                    size="compact"
                    colSpan={2}
                    label="Agenda ocupada"
                    value={summary.avg_capacity_utilization ? formatPct(summary.avg_capacity_utilization.value) : "—"}
                    numericValue={summary.avg_capacity_utilization ? summary.avg_capacity_utilization.value * 100 : undefined}
                    format={summary.avg_capacity_utilization ? (n) => `${n.toFixed(1)}%` : undefined}
                    tone="neutral"
                    trend={summary.avg_capacity_utilization ? trendFrom(summary.avg_capacity_utilization) : undefined}
                  />
                  {/* Achado 2 da auditoria "Veredito do Gestor Clínico": PMR
                      (Prazo Médio de Recebimento) — billing.created_at/
                      settled_at sempre existiram no banco, mas nenhum
                      indicador calculava essa diferença. null quando não
                      há billing conciliado no período. */}
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

            {/* Bloco "Contas" (core.contas, migração 076) — primeira
                superfície analítica agregada dessa camada, que até aqui só
                existia como dado bruto no banco e na visão por paciente da
                Ficha. É o destino do action_href="#tab:diagnostico" do
                insight de conta parada em auditoria (ver DECISÃO em
                smart_insights_engine.py::_conta_stale_em_auditoria_insight).
                Sempre "estado agora" — não usa dateFrom/dateTo, igual ao
                CrmSummary/CrmPanel acima. */}
            <ContaStatusFunnelPanel />

            {/* id="buraco-financeiro" — destino do botão "Ver contas abaixo
                do combinado" do insight de cobrança abaixo do contrato (ver
                DECISÃO em smart_insights_engine.py::_financial_hole_insight).
                Mesmo período do resto do Diagnóstico (dateFrom/dateTo) —
                diferente de Carteira de Inativos/Candidatos a recontato, que
                são sempre "agora". */}
            <section id="buraco-financeiro">
              <h2 className="mb-3 text-sm font-medium text-ink">Contas abaixo do combinado</h2>
              <FinancialHoleBillingsPanel dateFrom={dateFrom} dateTo={dateTo} />
            </section>

            {/* id="agenda-resumo" — destino dos botões "Ver ocupação por
                profissional"/"Ver quem está em risco"/"Ver volume de
                consultas" dos insights de agenda acima (ver DECISÃO em
                InsightActionButton, SmartInsightsFeed.tsx): rola até aqui
                em vez de deixar o usuário procurar sozinho. */}
            <section id="agenda-resumo">
              <h2 className="mb-3 text-sm font-medium text-ink">Agenda & Capacidade Operacional</h2>
              <ExecutiveAgendaSummary
                dateFrom={dateFrom}
                dateTo={dateTo}
                focus={agendaFocus}
                onClearFocus={() => setAgendaFocus(null)}
              />
            </section>

            {/* id="carteira-inativa" — destino do botão "Ver quem não
                voltou" do insight de meta anual atrasada (ver DECISÃO em
                smart_insights_engine.py::_annual_goal_insight). Sem
                janela de período (mesmo espírito da Nota de Saúde): é
                sempre "quem não volta há mais de 1 ano a partir de
                hoje", não um recorte dos últimos 7 dias. */}
            <section id="carteira-inativa" className="space-y-4">
              <InactivePatientsPanel />
              {/* Raio-X da Receita, frente "Prevendo movimentos" — alerta
                  ANTECIPADO, mesma âncora: as duas listas respondem "quem
                  está indo embora", em estágios diferentes (ver DECISÃO
                  em smart_insights_engine.py::_early_churn_insight). */}
              <EarlyChurnRiskPanel />
              {/* Gaps Dossiê Insighta RCM, item 4 — RFM completo. Mesma
                  âncora das duas listas acima (quem precisa de
                  reativação), agora com a dimensão de Valor combinada:
                  não é só "quem sumiu", é "quem sumiu E valia mais a
                  pena reativar primeiro". */}
              <PatientRfmPanel />
            </section>

            {/* Achado do Dossiê Insighta RCM — mesma seção de
                relacionamento com o paciente das duas listas acima,
                só que olhando pra quem fica (retenção proativa), não
                pra quem já foi embora. */}
            <section id="aniversariantes" className="space-y-4">
              <div>
                <h2 className="mb-3 text-sm font-medium text-ink">Aniversariantes do mês</h2>
                <BirthdaysPanel />
              </div>
              {/* Achado do Dossiê Insighta RCM — mesma seção de "quem são
                  nossos pacientes", complementando aniversário com o
                  perfil etário da carteira ativa. */}
              <PatientDemographicsPanel dateFrom={dateFrom} dateTo={dateTo} />
            </section>
          </div>
        </TabPanel>
      )}

      {activeTab === "crm" && (
        <TabPanel id="crm" groupId={TABS_GROUP}>
          <CrmPanel />
        </TabPanel>
      )}

      {activeTab === "oportunidades" && (
        <TabPanel id="oportunidades" groupId={TABS_GROUP}>
          <OportunidadesPanel />
        </TabPanel>
      )}

      {activeTab === "comparativo" && (
        <TabPanel id="comparativo" groupId={TABS_GROUP}>
          <NetworkBenchmarkPanel />
        </TabPanel>
      )}

      {activeTab === "rentabilidade" && (
        <TabPanel id="rentabilidade" groupId={TABS_GROUP}>
          <div className="space-y-4">
            <ProfitabilityPanel dateFrom={dateFrom} dateTo={dateTo} />
            {/* Achado do Dossiê Insighta RCM — cálculo simples sobre
                Billing.charged_value, nenhuma agregação existia. */}
            <AverageTicketPanel dateFrom={dateFrom} dateTo={dateTo} />
            <MarketingChannelsPanel dateFrom={dateFrom} dateTo={dateTo} />
            {/* "Equilíbrio Insighta" (Balanced Scorecard, perna Cliente) —
                complementa o CAC/LTV acima (aquisição) com expansão de
                receita em paciente já conquistado. */}
            <UpsellFunnelPanel dateFrom={dateFrom} dateTo={dateTo} />
            {/* Achado do Dossiê Insighta RCM — dimensão de concentração
                de receita diferente da que já existe por convênio. */}
            <PatientRevenueParetoPanel dateFrom={dateFrom} dateTo={dateTo} />
          </div>
        </TabPanel>
      )}

      {activeTab === "simulador" && (
        <TabPanel id="simulador" groupId={TABS_GROUP}>
          <SimuladorPanel />
        </TabPanel>
      )}

      {activeTab === "capital" && (
        <TabPanel id="capital" groupId={TABS_GROUP}>
          <CapitalDecisionPanel />
        </TabPanel>
      )}

      {activeTab === "roi" && (
        <TabPanel id="roi" groupId={TABS_GROUP}>
          <ProductRoiPanel />
        </TabPanel>
      )}

      {/* Achado do Comitê de Liderança Tecnológica ("5 pernas", Sala de
          Comando 3.0) — os 3 insights de BI mais profundos de Estoque
          (curva ABC, desvio de consumo por médico, margem de
          contribuição real) que só existiam no dicionário de dados,
          nunca em tela. Ruptura/vencimento continuam no feed da aba
          Diagnóstico (ver DECISÃO em _stock_stockout_risk_insight/
          _stock_expiring_lot_value_insight, backend). */}
      {activeTab === "estoque" && (
        <TabPanel id="estoque" groupId={TABS_GROUP}>
          <EstoquePanel dateFrom={dateFrom} dateTo={dateTo} />
        </TabPanel>
      )}

      {/* Primeira aba dedicada ao PEP (Prontuário Eletrônico do
          Paciente) — antes só existia por paciente, na Ficha (ver
          DECISÃO em _pep_documentation_gap_insight/
          _pep_cid_completeness_insight, backend). */}
      {activeTab === "clinico" && (
        <TabPanel id="clinico" groupId={TABS_GROUP}>
          <PepConformidadePanel dateFrom={dateFrom} dateTo={dateTo} />
        </TabPanel>
      )}
    </div>
  );
}
