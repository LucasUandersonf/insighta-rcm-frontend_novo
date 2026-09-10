import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, SlidersHorizontal, Target, Users } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { ErrorState, LoadingState } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { PeriodWindowSelect } from "@/components/ui/PeriodWindowSelect";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { ExecutiveAgendaSummary } from "@/components/dashboard/ExecutiveAgendaSummary";
import { FinancialHoleBillingsPanel } from "@/components/dashboard/FinancialHoleBillingsPanel";
import { InactivePatientsPanel } from "@/components/dashboard/InactivePatientsPanel";
import { SmartInsightsFeed } from "@/components/dashboard/SmartInsightsFeed";
import { HealthScoreWidget } from "@/components/dashboard/HealthScoreWidget";
import { NetworkBenchmarkPanel } from "@/components/dashboard/NetworkBenchmarkPanel";
import { OportunidadesPanel } from "@/components/dashboard/OportunidadesPanel";
import { SimuladorPanel } from "@/components/dashboard/SimuladorPanel";
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

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const TABS_GROUP = "sala-de-comando";
type TabId = "diagnostico" | "oportunidades" | "comparativo" | "simulador";

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
  const { windowDays, setWindowDays, dateFrom, dateTo } = useDateWindow(7);
  const { data: profile } = useCurrentUserProfile();
  const [activeTab, setActiveTab] = useState<TabId>("diagnostico");
  // Foco de agenda (ver AgendaFocus, lib/types.ts) — disparado pelos
  // botões de ação dos insights de queda de agenda/agenda ociosa (ver
  // DECISÃO em SmartInsightsFeed.tsx::InsightActionButton). Mora aqui
  // (não dentro de ExecutiveAgendaSummary) porque quem dispara é um
  // componente IRMÃO (SmartInsightsFeed), mais acima na árvore.
  const [agendaFocus, setAgendaFocus] = useState<AgendaFocus | null>(null);

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ["analytics", "executive-summary", dateFrom, dateTo],
    queryFn: () => apiClient.get<ExecutiveSummary>(`/api/v1/analytics/executive-summary?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sala de Comando"
        subtitle="Onde estamos perdendo dinheiro hoje?"
        greeting={profile ? `${timeOfDayGreeting()}, ${firstNameFrom(profile.full_name)}.` : undefined}
        action={activeTab === "diagnostico" ? <PeriodWindowSelect windowDays={windowDays} onChange={setWindowDays} /> : undefined}
      />

      <Tabs
        groupId={TABS_GROUP}
        active={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
        items={[
          { id: "diagnostico", label: "Diagnóstico", icon: LayoutDashboard },
          { id: "oportunidades", label: "Oportunidades", icon: Target },
          { id: "comparativo", label: "Comparativo", icon: Users },
          { id: "simulador", label: "Simulador", icon: SlidersHorizontal },
        ]}
      />

      {activeTab === "diagnostico" && (
        <TabPanel id="diagnostico" groupId={TABS_GROUP}>
          <div className="space-y-6">
            {/* Nota de saúde financeira — widget PERSISTENTE, diferente do
                feed abaixo (que troca de manchete conforme o que dói mais
                na semana): é um estado que se acompanha ao longo do tempo. */}
            <HealthScoreWidget />

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
                </div>
              </section>
            )}

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
            <section id="carteira-inativa">
              <InactivePatientsPanel />
            </section>
          </div>
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

      {activeTab === "simulador" && (
        <TabPanel id="simulador" groupId={TABS_GROUP}>
          <SimuladorPanel />
        </TabPanel>
      )}
    </div>
  );
}
