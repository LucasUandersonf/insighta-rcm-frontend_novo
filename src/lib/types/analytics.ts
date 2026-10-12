import type { NoShowRiskLevel } from "./clinic";
import type { InsurancePlanType } from "./contracts";

// --- Dashboards de Decisão (app/schemas/analytics.py) ---
export interface PeriodKpi {
  value: number;
  previous_value: number;
  delta_pct: number | null;
}

export interface ExecutiveSummary {
  period_start: string;
  period_end: string;
  total_billed: PeriodKpi;
  total_value_saved: PeriodKpi;
  // "Divergência de Cobrança": cobrado abaixo do contratado.
  financial_hole: PeriodKpi;
  // "Divergência de Recebimento": pago pela operadora abaixo do
  // contratado (só billings já conciliados via /billing/{id}/settle).
  payment_gap: PeriodKpi;
  margin_vs_contracted_pct: number | null;
  avg_capacity_utilization: PeriodKpi | null;
  high_risk_pending_count: number;
  // Recursos de glosa (Recurso de Glosa / conformidade ANS) com prazo
  // vencendo em breve ou já vencido — estado "agora", não do período.
  appeals_due_soon_count: number;
  // % do valor faturado no período com denial_risk_level medium/high, e
  // o valor em R$ correspondente — número de apoio do insight "risco de
  // até X% de glosas nas contas atuais". null quando não há faturamento
  // no período (% sobre base zero é indefinida).
  denial_risk_pct: number | null;
  denial_at_risk_value: number;
  // PMR (Prazo Médio de Recebimento) — achado da auditoria "Veredito do
  // Gestor Clínico": billing.created_at/settled_at sempre existiram no
  // banco, mas nenhum indicador calculava essa diferença até esta
  // rodada. null quando não há nenhum billing conciliado no período
  // (amostra vazia, nunca "0 dias").
  avg_days_to_receive: PeriodKpi | null;
}

export interface ProfessionalCapacityMetric {
  professional_id: string;
  full_name: string;
  utilization_rate: number;
  no_show_rate: number;
  available_minutes: number;
  booked_minutes: number;
  total_appointments: number;
}

export interface PeakHourBucket {
  hour: number;
  appointment_count: number;
}

export interface NoShowRiskBucket {
  level: NoShowRiskLevel | "indeterminado";
  count: number;
}

// 0=domingo .. 6=sábado — mesma convenção usada em todo o backend
// (ver capacity_service.py, no_show_risk_engine.py).
export interface WeekdayBucket {
  weekday: number;
  appointment_count: number;
}

// Taxa de falta por dia da semana — diferente de WeekdayBucket (volume
// bruto), responde diretamente "quinta tem taxa de falta X%". Só conta
// atendimentos RESOLVIDOS (completed/no_show), nunca 'scheduled'.
// no_show_rate é null quando total_appointments é 0 ("sem amostra",
// nunca 0%) — ver AnalyticsRepository.weekday_no_show_rate_breakdown.
export interface WeekdayNoShowRateBucket {
  weekday: number;
  no_show_count: number;
  total_appointments: number;
  no_show_rate: number | null;
}

// Achado do Dossiê Insighta RCM — mesmo espírito de
// WeekdayNoShowRateBucket, agora para cancelamento. Denominador =
// desfecho TERMINAL (completed/no_show/cancelled) — 'scheduled' nunca
// entra. cancellation_rate é null quando total_appointments é 0.
export interface WeekdayCancellationRateBucket {
  weekday: number;
  cancellation_count: number;
  total_appointments: number;
  cancellation_rate: number | null;
}

// Onda 5 do Plano de Ação, item 15 — em quais dias da semana a agenda
// mais recebe encaixe (Appointment.is_squeeze_in). Denominador = só
// agendamentos com is_squeeze_in INFORMADO (não null) — ver DECISÃO em
// AnalyticsRepository.weekday_squeeze_in_breakdown no backend.
export interface WeekdaySqueezeInBucket {
  weekday: number;
  squeeze_in_count: number;
  total_informed: number;
  squeeze_in_rate: number | null;
}

// "Lista vermelha" — ranking de pacientes por taxa de falta no período
// (ver AnalyticsRepository.top_no_show_patients no backend). Só entram
// pacientes com amostra mínima e pelo menos 1 falta.
export interface PatientNoShowRankingItem {
  patient_id: string;
  full_name: string;
  no_show_count: number;
  total_appointments: number;
  no_show_rate: number;
}

// Card "Risco de falta — próximos dias" da Sala de Comando — lista
// NOMINAL de agendamentos futuros em risco médio/alto, mais próximo
// primeiro (ver AnalyticsRepository.upcoming_risk_appointments no
// backend). Diferente de patient_no_show_ranking (histórico passado),
// isto é sobre o que ainda vai acontecer.
export interface UpcomingRiskAppointment {
  appointment_id: string;
  patient_full_name: string;
  scheduled_at: string;
  risk_level: "medio" | "alto";
  // Tela "Agenda de risco" (GET /analytics/upcoming-risk-appointments) —
  // null no card resumido de agenda-metrics (que não busca isso), sempre
  // presente (podendo ser null) na versão paginada.
  professional_name?: string | null;
  // Ficha do Paciente (Fase 4) — idem professional_name: null no card
  // resumido, presente na versão paginada, pra linkar cada linha pra
  // /pacientes?patient_id=....
  patient_id?: string | null;
}

export interface AgendaMetrics {
  period_start: string;
  period_end: string;
  professionals: ProfessionalCapacityMetric[];
  peak_hours: PeakHourBucket[];
  // Número/gráfico de apoio do insight textual de queda de agenda por
  // dia da semana (ver SmartInsightsFeed) — evidência, não o elemento
  // principal da tela.
  weekday_histogram: WeekdayBucket[];
  weekday_no_show_rates: WeekdayNoShowRateBucket[];
  weekday_cancellation_rates: WeekdayCancellationRateBucket[];
  weekday_squeeze_in_rates: WeekdaySqueezeInBucket[];
  no_show_risk_breakdown: NoShowRiskBucket[];
  estimated_revenue_at_risk: number;
  patient_no_show_ranking: PatientNoShowRankingItem[];
  upcoming_risk_appointments: UpcomingRiskAppointment[];
  // Minutos disponíveis (grade semanal) menos minutos agendados, somado
  // entre profissionais com grade cadastrada, e a tradução em R$ dessa
  // ociosidade — o "outro lado" do problema de agenda em relação ao
  // no-show (ver DECISÃO em capacity_service.estimate_idle_capacity_revenue_lost
  // no backend). Mesma natureza de estimativa que estimated_revenue_at_risk.
  total_idle_minutes: number;
  estimated_revenue_lost_to_idle_capacity: number;
  // Quantos profissionais ATIVOS ainda não têm grade semanal cadastrada
  // — todo profissional auto-criado por upload de arquivo (Faturamento
  // OU Agenda) nasce sem grade, o que deixa total_idle_minutes/
  // estimated_revenue_lost_to_idle_capacity incompletos para eles (ver
  // DECISÃO no backend, AgendaMetricsResponse).
  professionals_without_availability_count: number;
}

// Ranking de perda financeira por convênio (GET /analytics/plan-loss-ranking)
// — as mesmas 3 fontes de perda do ExecutiveSummary, só que quebradas
// por operadora em vez de somadas no tenant inteiro.
export interface PlanLossItem {
  plan_name: string;
  // Achado da Onda 3 do Plano de Ação ("particular como cidadão de
  // primeira classe") — ver DECISÃO em PaymentLagByPlanItem.plan_type
  // abaixo.
  plan_type: InsurancePlanType;
  financial_hole: number;
  payment_gap: number;
  denial_risk_value: number;
  total_loss: number;
}

export interface PlanLossRanking {
  period_start: string;
  period_end: string;
  plans: PlanLossItem[];
}

// Ranking de PMR por convênio (GET /analytics/payment-lag-by-plan) —
// achado da auditoria "Veredito do Gestor Clínico": pior prazo primeiro,
// pra apontar QUAL operadora está de fato travando o caixa.
export interface PaymentLagByPlanItem {
  insurance_plan_id: string;
  insurance_plan_name: string;
  // Achado da Onda 3 do Plano de Ação ("particular como cidadão de
  // primeira classe") — "convenio" ou "particular". PMR só tem o
  // sentido de "prazo de operadora" pra convênio de verdade; particular
  // aparece aqui por transparência, nunca escondido.
  plan_type: InsurancePlanType;
  avg_days_to_receive: number;
  billings_settled_count: number;
}

export interface PaymentLagByPlan {
  period_start: string;
  period_end: string;
  // Agregado do tenant inteiro — mesmo número de
  // ExecutiveSummary.avg_days_to_receive.value. null quando não há
  // nenhum billing conciliado no período.
  avg_days_to_receive: number | null;
  billings_settled_count: number;
  items: PaymentLagByPlanItem[]; // ordenado por avg_days_to_receive desc, pior primeiro
}

// Recomendação de priorização de agenda por convênio (GET
// /analytics/agenda-plan-priority) — Onda 4 do Plano de Ação, item 14:
// evolução do PMR acima. Só convênio de verdade entra (nunca
// particular) — ver DECISÃO em AnalyticsService.get_agenda_plan_priority
// (backend) sobre a combinação por ranking (não fórmula ponderada).
export interface AgendaPlanPriorityItem {
  insurance_plan_id: string;
  insurance_plan_name: string;
  avg_days_to_receive: number;
  total_loss: number;
  priority_rank: number; // 1 = prioridade máxima pra encaixar
}

export interface AgendaPlanPriority {
  period_start: string;
  period_end: string;
  items: AgendaPlanPriorityItem[]; // ordenado por priority_rank crescente
}

// Previsão de receita futura da agenda (GET /analytics/agenda-revenue-forecast)
// — pedido direto do usuário: "a receita da agenda... conseguimos tirar
// metade do faturamento futuro da clínica". Período FUTURO por padrão
// (diferente de todo o resto deste arquivo, que olha pra trás). Ver
// DECISÃO completa em AnalyticsRepository.agenda_revenue_forecast
// (backend): 3 baldes separados, nunca um único "valor esperado" que
// esconderia a incerteza real do dado.
export interface AgendaRevenueForecast {
  period_start: string;
  period_end: string;
  total_scheduled_count: number;
  // Soma bruta de agreed_price de todo agendamento com preço de contrato
  // encontrado (known_risk_value + unrated_value).
  total_scheduled_value: number;
  // Subset com no_show_risk_score CALCULADO — expected_value é o
  // ajustado por (1 - risco de falta), known_risk_value é o bruto.
  known_risk_count: number;
  known_risk_value: number;
  expected_value: number;
  // Preço encontrado, mas paciente "indeterminado" (sem histórico ainda)
  // — de propósito FORA do ajuste de risco, nunca somado a expected_value.
  unrated_count: number;
  unrated_value: number;
  // Sem convênio/procedimento definido ainda, ou sem contrato vigente —
  // nem entra em total_scheduled_value.
  unpriced_count: number;
}

// Resumo executivo narrado por IA (GET /analytics/executive-narrative)
// — "o Jarvis pegando os cálculos e transformando em texto explicativo"
// (pedido direto do usuário). `narrative` é null quando a IA não está
// configurada ou a geração falhou (degradação graciosa — ver DECISÃO em
// AnalyticsService.get_executive_narrative, backend). Sem
// period_start/period_end no filtro: a janela é sempre fixa (últimos 7
// dias fechados), independente do seletor de período da tela.
//
// `top_priorities` — Home estilo Jarvis (Roadmap "Rumo à Nota 9", Fase 1):
// até 3 insights já ranqueados por prioridade (ver generate_insights,
// backend), presentes mesmo quando `narrative` é null. É o que alimenta
// os cards de prioridade da Home — nunca a lista completa (isso continua
// vivendo na Sala de Comando, via SmartInsightsFeed).
export interface ExecutiveNarrative {
  period_start: string;
  period_end: string;
  narrative: string | null;
  generated_at: string | null;
  top_priorities: SmartInsight[];
  // Memória contínua dia-a-dia (Fase 3) — títulos resolvidos HOJE,
  // presentes mesmo quando `narrative` é null (Avaliação Home/Sala de
  // Comando, Achado 3): não depende do texto da IA mencionar.
  recently_resolved: string[];
  /** Jornal da manhã escrito pela IA com os números do sistema (null = edição do dia não pronta). */
  edition?: MorningEdition | null;
}

export interface MorningEdition {
  headline: string;
  lead: string;
  /** Só os cards aprovados pela checagem de números: faturado, recebimento, agenda, saude. */
  cards: Partial<
    Record<"faturado" | "recebimento" | "agenda" | "saude", string>
  >;
}

// Taxa de confirmação real do motor de risco de glosa (GET
// /analytics/denial-reason-confirmation) — Camada 2 do plano de IA
// preditiva: as regras fixas do motor anti-glosa (denial_risk_engine.py,
// backend) de fato preveem glosa real? Sem period_start/period_end de
// propósito (olha todo o histórico já resolvido, não uma janela).
export interface DenialReasonConfirmationItem {
  reason_code: string;
  reason_label: string;
  sample_size: number;
  confirmed_denial_rate: number; // fração 0.0-1.0
}

// GET /analytics/product-roi (Épico F4.4 do Plano Diretor — "Prova de
// ROI do próprio produto") — três componentes independentes e
// CUMULATIVOS desde que a clínica começou a usar o produto (nunca uma
// janela de período).
export interface ProductRoi {
  protected_from_denial_value: number;
  recovered_appeals_value: number;
  recovered_appeals_count: number;
  realized_insight_outcomes_value: number;
  realized_insight_outcomes_count: number;
  total_roi_value: number;
  tracking_since: string | null; // null quando a clínica ainda não tem faturamento nenhum
}

// GET /analytics/capital-decision-base-data (Épico F3.4 do Plano
// Diretor — "Decisões de capital: contratar/expandir"). Dado-base real
// pra simulação de payback feita NESTA tela (CapitalDecisionPanel) —
// nunca a decisão pronta, ver DECISÃO completa no schema do backend.
export interface CapitalDecisionBaseData {
  window_days: number;
  period_start: string;
  period_end: string;

  available_specialties: string[];
  specialty_requested: string | null;
  used_fallback_clinic_wide: boolean;
  sample_size: number;
  min_sample: number;
  avg_revenue_per_hour: number | null;
  has_cost_data: boolean;
  avg_margin_per_hour: number | null;

  belongs_to_organization: boolean;
  sibling_units_count: number;
  avg_monthly_revenue_per_unit: number | null;
}

export interface DenialReasonConfirmation {
  baseline_sample_size: number;
  // null quando ainda não há nenhum faturamento "sem motivo sinalizado"
  // resolvido — base zero, percentual indefinido.
  baseline_denial_rate: number | null;
  items: DenialReasonConfirmationItem[]; // ordenado do mais confirmado pro menos, amostra mínima já aplicada
  min_sample: number;
}

// Utilização de contrato (GET /analytics/contract-utilization) — dos
// procedimentos negociados num contrato, quantos foram de fato
// faturados no período. idle_catalog_value é o valor de TABELA dos
// itens parados, não uma estimativa de receita perdida (ver DECISÃO em
// AnalyticsRepository.contract_utilization no backend).
export interface ContractUtilizationItem {
  contract_id: string;
  plan_name: string;
  // Achado da Onda 3 do Plano de Ação — ver DECISÃO em
  // PaymentLagByPlanItem.plan_type acima.
  plan_type: InsurancePlanType;
  valid_from: string;
  valid_until: string | null;
  total_items: number;
  items_billed: number;
  utilization_pct: number;
  idle_catalog_value: number;
}

export interface ContractUtilization {
  period_start: string;
  period_end: string;
  contracts: ContractUtilizationItem[];
}

// Donut "Distribuição de risco de glosa" (GET /analytics/denial-risk-distribution)
// — carrega contagem E valor em R$ por nível (achado do Parecer Técnico
// "Boletim Insighta": eliminou a tela duplicada que só mostrava valor
// agregado, sem abrir por nível de risco).
export interface DenialRiskDistributionItem {
  level: "low" | "medium" | "high";
  count: number;
  value: number;
}

export interface DenialRiskDistribution {
  period_start: string;
  period_end: string;
  items: DenialRiskDistributionItem[];
  total_reviewed: number;
  total_value_reviewed: number;
}

// GET /analytics/data-quality (Épico F2.2 do Plano Diretor — "Qualidade
// de dado na origem") — taxa de atendimento lançado já completo (CID +
// procedimento) por atendente, ordenado do pior pro melhor. `items` só
// traz atendente com amostra >= min_sample.
export interface DataQualityByUserItem {
  user_id: string;
  full_name: string;
  complete_count: number;
  total_count: number;
  completion_rate: number; // fração 0.0-1.0
}

export interface DataQuality {
  items: DataQualityByUserItem[];
  overall_completion_rate: number | null; // null sem nenhum atendente com amostra suficiente
  total_considered: number;
  min_sample: number;
}

// "comparativo" — Comparativo entre clínicas como manchete do feed (Sala
// de Comando 2.0, Nível 1) — ver build_network_comparativo_insight no
// backend. Visualmente distinto de crítico/atenção/positivo (tom violeta,
// não semântico de "bom"/"ruim") porque não é um veredito sobre a
// clínica, é uma comparação.
export type InsightSeverity =
  | "critical"
  | "warning"
  | "positive"
  | "comparativo";

// "faturamento" | "agenda" — área do card, usada por SmartInsightsFeed.tsx
// pra agrupar o feed em seções em vez de uma lista única misturando
// cobrança/glosa com ocupação de agenda (ver DECISÃO em
// app/services/insights.Insight.category, backend). "estrategia" só
// aparece em itens sintéticos da fila (PriorityQueueItem, ver abaixo) —
// nunca emitido por generate_insights(), então SmartInsightsFeed.tsx
// nunca precisa saber desse terceiro valor.
export type InsightCategory =
  | "faturamento"
  | "agenda"
  | "estoque"
  | "prontuario"
  | "estrategia";

export interface SmartInsight {
  severity: InsightSeverity;
  category: InsightCategory;
  title: string;
  message: string;
  financial_impact: number | null;
  // Marca insights de recursos lançados na Sala de Comando 2.0 (Radar de
  // Profissional, Comparativo) — vira a pílula "Novo" no card. Default
  // false no backend para respostas antigas.
  is_new?: boolean;
  // Botão de ação real do card — o rótulo do botão e o destino, em 3
  // formatos que ExecutiveOverviewPage/SmartInsightsFeed interpretam:
  // "/rota" (navega pra outra página), "#tab:id" (troca de aba dentro da
  // própria Sala de Comando) ou "#id" (rola até aquele elemento na
  // mesma tela). Ambos null quando o insight não tem uma tela/seção
  // específica de destino.
  action_label?: string | null;
  action_href?: string | null;
  // Redesign 2026 — orientação do card "O que atacar primeiro" (ver
  // app/services/insight_guidance.py no backend). Opcionais para não
  // quebrar respostas antigas.
  estimated_minutes?: number | null;
  detected_days_ago?: number | null;
  why_now?: string | null;
  what_to_do?: string | null;
  if_ignored?: string | null;
  // "Nota 9" do motor (ver finalize_insights no backend).
  rule_id?: string | null;
  /** Chave estável da situação (regra + sujeito) — usada ao atribuir/resolver. */
  fact_key?: string | null;
  /** Quem/onde: convênio, profissional, dia, material. */
  subject?: string | null;
  /** "perda" ordena a fila; "referencia" é tamanho de algo; "ganho" é dinheiro protegido. */
  impact_kind?: "perda" | "referencia" | "ganho";
  /** Base do número ("Baseado em 42 atendimentos"). */
  evidence?: string | null;
  /** "Como calculamos": fonte, período e fórmula em uma linha (Bloco 2). */
  method?: string | null;
  /** Histórico de acerto desta regra nesta clínica. */
  track_record?: string | null;
  /** Passos concretos, na ordem. */
  playbook?: string[];
  demoted?: boolean;
}

export interface SmartInsights {
  period_start: string;
  period_end: string;
  insights: SmartInsight[];
}

// GET /analytics/priority-queue — épico F1.1 do Plano Diretor ("Fila
// única de ação priorizada"). Mesmo shape de SmartInsight + `source`:
// "insight" (veio do feed que já existe) ou "raiox" (extraído na hora
// de um painel do Raio-X que nunca virou card de feed sozinho — ver
// DECISÃO em AnalyticsService.get_priority_queue, backend). Nunca
// esconde a proveniência — o mesmo motivo de `category` nunca ser
// escondido no feed normal.
export interface PriorityQueueItem extends SmartInsight {
  source: "insight" | "raiox";
}

export interface PriorityQueue {
  period_start: string;
  period_end: string;
  items: PriorityQueueItem[];
  // Quantos itens existiam ANTES do corte por limit — mostra "3 de 14"
  // em vez de fingir que a fila é só o que coube.
  total_considered: number;
}

// Épicos F1.2 (ciclo fechado de insight) + F1.3 (atribuição/workflow)
// do Plano Diretor — ver DECISÃO completa em
// app/sql/038_insight_outcomes.sql no backend.
export type InsightOutcomeStatus =
  | "pendente"
  | "em_andamento"
  | "resolvido"
  | "ignorado";

export interface InsightOutcome {
  id: string;
  insight_key: string;
  source: "insight" | "raiox";
  category: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  financial_impact_snapshot: number | null;
  status: InsightOutcomeStatus;
  assigned_to: string | null;
  due_date: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  resolved_metric_value: number | null;
  reevaluated_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InsightOutcomeCreateRequest {
  source: "insight" | "raiox";
  category: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  financial_impact?: number | null;
  rule_id?: string | null;
  fact_key?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
}

export interface InsightOutcomeUpdateRequest {
  status?: InsightOutcomeStatus;
  assigned_to?: string | null;
  due_date?: string | null;
  resolution_note?: string | null;
}

export interface InsightOutcomesRealizedSummary {
  total_resolved_and_reevaluated: number;
  total_delta_realized: number;
  items: InsightOutcome[];
}

// Nota de Saúde Financeira (GET /analytics/health-score) — Sala de Comando 2.0
export interface HealthScoreComponent {
  key: string; // "denial" | "no_show" | "appeal"
  label: string;
  rate: number; // 0.0-1.0
  sub_score: number; // 0-100
  weight: number; // peso efetivo, soma 1.0 entre os componentes presentes
}

export interface HealthScoreTrend {
  reference_score: number;
  reference_month: string; // YYYY-MM-01
  delta: number; // score atual - reference_score; positivo = melhorou
}

export interface HealthScore {
  score: number | null; // null = amostra insuficiente em todos os componentes ainda
  components: HealthScoreComponent[];
  window_days: number;
  trend: HealthScoreTrend | null; // null = ainda não há fotografia de referência (base nova)
  /** UX2-01: áreas fora da nota por falta de dado. Nota só com 2 de 3 áreas. */
  missing_components?: { key: string; label: string; reason: string }[];
  /** UX2-01: título do alerta crítico que limita a nota a 89. */
  capped_by_alert?: string | null;
}

// "Equilíbrio Insighta" (Balanced Scorecard, perna Cliente) — resumo de
// NPS/satisfação pós-atendimento (GET /analytics/satisfaction-summary).
export interface SatisfactionSummary {
  average_score: PeriodKpi | null; // null = nenhuma avaliação recebida ainda no período
  response_count: number;
  distribution: Record<string, number>; // {"1": n, "2": n, "3": n, "4": n, "5": n}
  window_days: number;
}

// Achado do Dossiê Insighta RCM ("Como o dado entra no sistema") —
// GET /analytics/data-freshness. `items` só lista data_type que já
// tiveram pelo menos 1 ingestão com sucesso (nunca uma data inventada
// para um tipo nunca importado); `stalest_at` é o PIOR caso entre os
// tipos já importados, null quando `items` está vazio.
export interface DataFreshnessItem {
  data_type: string;
  last_ingested_at: string;
}

export interface DataFreshness {
  items: DataFreshnessItem[];
  stalest_at: string | null;
}

// Achado do Dossiê Insighta RCM — taxa de retorno de pacientes
// (GET /analytics/return-rate), a partir de Appointment.visit_type.
export interface ReturnRate {
  period_start: string;
  period_end: string;
  return_rate: PeriodKpi | null; // null = nenhum atendimento com visit_type informado no período
  return_count: number;
  first_visit_count: number;
  untagged_count: number; // concluídos sem visit_type informado — nunca soma no denominador da taxa
}

// Achado do Dossiê Insighta RCM — ticket médio (GET /analytics/average-ticket)
export interface AverageTicketChannelItem {
  channel: string;
  billing_count: number;
  average_ticket: number;
}

export interface AverageTicketProcedureItem {
  procedure_code: string;
  procedure_name: string | null;
  billing_count: number;
  average_ticket: number;
}

export interface AverageTicket {
  period_start: string;
  period_end: string;
  overall: PeriodKpi | null; // null = billing_count == 0
  billing_count: number;
  by_channel: AverageTicketChannelItem[];
  by_procedure: AverageTicketProcedureItem[];
}

// Achado do Dossiê Insighta RCM — Pareto de receita por paciente
// (GET /analytics/patient-revenue-pareto), dimensão diferente da
// concentração por convênio que já existe no motor de insights.
export interface PatientRevenueItem {
  patient_id: string;
  full_name: string;
  revenue: number;
  share_pct: number;
  cumulative_share_pct: number;
}

export interface PatientRevenuePareto {
  period_start: string;
  period_end: string;
  total_billed: number;
  items: PatientRevenueItem[]; // top N por receita, maior primeiro
  top_n_share_pct: number | null; // null quando total_billed <= 0
}

// Achado do Dossiê Insighta RCM — faixa etária/demografia
// (GET /analytics/patient-demographics), a partir de Patient.birth_date.
export interface AgeBucketItem {
  label: string; // "0-17" | "18-30" | "31-45" | "46-60" | "60+"
  patient_count: number;
}

export interface PatientDemographics {
  period_start: string;
  period_end: string;
  buckets: AgeBucketItem[]; // sempre as 5 faixas, mesmo com contagem 0
  unknown_age_count: number;
}

// Resumo diário narrado (GET /analytics/daily-summary) — Onda 6 do
// Plano de Ação, item 18. Não é uma fonte de dado nova: compõe em texto
// corrido o que já existe espalhado em telas diferentes, sempre para
// HOJE. Ver DECISÃO completa em AnalyticsService.get_daily_summary
// (backend).
export interface DailySummary {
  date: string;
  headline: string;
  sentences: string[];
}

// Carteira de pacientes inativos (GET /analytics/inactive-patients) — Sala de Comando
export interface InactivePatientItem {
  patient_id: string;
  full_name: string;
  last_appointment_at: string;
  days_since_last_appointment: number;
  // Onda 4 do Plano de Ação, item 12 ("CRM de verdade") — null =
  // ninguém tentou reativar este paciente ainda.
  last_outreach_at: string | null;
  last_outreach_outcome: PatientOutreachOutcome | null;
}

// Registro de contato de reativação (POST/GET
// /patients/{id}/outreach-log) — Onda 4 do Plano de Ação, item 12.
export type PatientOutreachChannel =
  | "telefone"
  | "whatsapp"
  | "sms"
  | "email"
  | "presencial";
export type PatientOutreachOutcome =
  | "contatado"
  | "sem_resposta"
  | "agendou"
  | "recusou";

export interface PatientOutreachLogCreateRequest {
  channel: PatientOutreachChannel;
  outcome: PatientOutreachOutcome;
  notes?: string | null;
}

export interface PatientOutreachLogEntry {
  id: string;
  patient_id: string;
  channel: PatientOutreachChannel;
  outcome: PatientOutreachOutcome;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface InactivePatients {
  items: InactivePatientItem[];
  total_count: number; // pode ser maior que items.length — a lista é sempre truncada
  inactive_after_days: number;
}

// Aba CRM (GET /analytics/crm-summary) — Roadmap "Rumo à Nota 9", Fase 5.
export interface CrmSummary {
  avg_patient_age_years: number | null;
  avg_days_since_last_visit: number | null;
  return_rate: number | null;
  return_rate_sample_size: number;
}

// Aba Diagnóstico (GET /analytics/conta-status-funnel) — Sala de Comando
// 3.0, achado do Comitê de Liderança Tecnológica ("5 pernas"). Sempre os
// 7 status, mesmo quando 0 (nunca omite uma etapa do funil).
export interface ContaStatusFunnel {
  aberta: number;
  pre_faturada: number;
  faturada: number;
  em_auditoria: number;
  glosada_parcial: number;
  fechada: number;
  cancelada: number;
  stale_em_auditoria_count: number;
  oldest_em_auditoria_age_days: number | null;
}

// Aba Estoque dedicada (GET /analytics/estoque-abc-curve) — Sala de
// Comando 3.0, achado do Comitê de Liderança Tecnológica ("5 pernas").
// Curva ABC de farmácia por valor de consumo no período.
export interface AbcCurveItem {
  material_id: string;
  nome: string;
  valor_consumido: number;
  classe: "A" | "B" | "C";
}

export interface AbcCurve {
  period_start: string;
  period_end: string;
  items: AbcCurveItem[];
}

// Aba Estoque dedicada (GET /analytics/estoque-consumo-por-medico) —
// custo de material consumido por profissional solicitante.
export interface ConsumptionByProfessionalItem {
  professional_id: string;
  professional_name: string;
  custo_total: number;
  atendimentos_count: number;
  custo_medio_por_atendimento: number;
}

export interface ConsumptionByProfessional {
  period_start: string;
  period_end: string;
  items: ConsumptionByProfessionalItem[];
}

// Aba Estoque dedicada (GET /analytics/margem-contribuicao-por-procedimento)
// — margem de contribuição real (receita - custo de material) por
// procedimento, só atendimentos de procedimento único.
export interface ContributionMarginItem {
  procedure_code: string;
  total_revenue: number;
  total_cost: number;
  margin_pct: number | null;
  sample_count: number;
}

export interface ContributionMargin {
  period_start: string;
  period_end: string;
  items: ContributionMarginItem[];
}

// Aba Clínico dedicada (GET /analytics/pep-conformidade) — conformidade
// assistencial do PEP como números agregados diretos.
export interface PepConformidade {
  period_start: string;
  period_end: string;
  missing_documentation_count: number;
  completed_encounters_count: number;
  missing_documentation_pct: number | null;
  missing_cid_count: number;
  evolutions_count: number;
  missing_cid_pct: number | null;
}

// RFM completo (GET /analytics/patient-rfm) — Gaps Dossiê Insighta RCM,
// item 4. Recência e Frequência já existiam espalhadas (InactivePatients,
// score VIP); Valor era a dimensão que faltava pra virar RFM de verdade.
// Ver DECISÃO completa em app/services/rfm_engine.py (backend).
export type RfmSegment =
  | "campeoes"
  | "fieis"
  | "nao_pode_perder"
  | "em_risco"
  | "novos"
  | "hibernando"
  | "precisa_atencao";

export interface RfmSegmentCount {
  segment: RfmSegment;
  patient_count: number;
}

export interface RfmPatientItem {
  patient_id: string;
  full_name: string;
  days_since_last_appointment: number;
  visit_count: number;
  total_revenue: number;
  recency_score: number;
  frequency_score: number;
  monetary_score: number;
  segment: RfmSegment;
  // Onda 4 do Plano de Ação, item 12 ("CRM de verdade") — null =
  // ninguém tentou reativar este paciente ainda.
  last_outreach_at: string | null;
  last_outreach_outcome: PatientOutreachOutcome | null;
}

export interface RfmResponse {
  as_of: string;
  total_patients: number;
  // Sempre os 7 segmentos, mesmo com contagem 0 — taxonomia fixa.
  segment_counts: RfmSegmentCount[];
  // Só quem precisa de ação agora (nao_pode_perder/em_risco), maior
  // receita histórica primeiro — nunca a base inteira.
  action_items: RfmPatientItem[];
}

// Raio-X da Receita, frente "Prevendo movimentos" — risco de abandono
// ANTECIPADO (GET /analytics/early-churn-risk), antes do piso fixo de 1
// ano que vira InactivePatientItem. Diferente dele, o limiar é o
// PRÓPRIO ritmo do paciente: avg_interval_days é o intervalo médio
// histórico entre as consultas dele, days_since_last já ultrapassa isso
// em pelo menos gap_multiplier vezes.
export interface EarlyChurnRiskItem {
  patient_id: string;
  full_name: string;
  last_appointment_at: string;
  avg_interval_days: number;
  days_since_last: number;
}

export interface EarlyChurnRisk {
  items: EarlyChurnRiskItem[];
  total_count: number;
  gap_multiplier: number;
  inactive_after_days: number;
}

// Raio-X da Receita, frente "Gestão eficiente" — rentabilidade por
// profissional e mix de receita por procedimento (GET /analytics/profitability).
export interface ProfessionalProfitabilityItem {
  professional_id: string;
  full_name: string;
  revenue: number;
  booked_minutes: number;
  revenue_per_hour: number | null; // null quando não há agenda ocupada no período
  // Épico F3.1 do Plano Diretor ("Módulo de custos e margem real") —
  // todos null quando Profitability.has_cost_data é false (nenhum
  // custo lançado ainda), nunca 0.
  allocated_cost: number | null;
  net_margin: number | null;
  margin_per_hour: number | null;
}

export interface ProcedureProfitabilityItem {
  procedure_code: string;
  procedure_name: string | null;
  revenue: number;
  billing_count: number;
  share_pct: number;
}

export interface Profitability {
  period_start: string;
  period_end: string;
  total_billed: number;
  by_professional: ProfessionalProfitabilityItem[]; // ordenado por receita/hora, maior primeiro
  by_procedure: ProcedureProfitabilityItem[]; // ordenado por receita, maior primeiro
  has_cost_data: boolean;
  total_costs: number | null;
  net_margin: number | null;
  // "Junta Técnica Insighta" — 2 referências externas de mercado (ver
  // DECISÃO em AnalyticsService.get_profitability, backend): margem
  // líquida saudável 15-30%; custo fixo saudável até 60% da receita.
  // Ambos null sem dado/amostra suficiente. Um terceiro benchmark do
  // relatório (convênio × particular) ficou de fora — o produto não
  // modela uma cobrança genuinamente sem convênio hoje (ver DECISÃO
  // completa no schema do backend).
  net_margin_pct: number | null;
  fixed_cost_pct: number | null;
}

// Épico F3.1 do Plano Diretor — ver DECISÃO completa em
// app/sql/039_cost_entries.sql no backend.
export type CostEntryCategory =
  | "folha_fixa"
  | "comissao_repasse"
  | "aluguel"
  | "insumo"
  | "outros";

export interface CostEntry {
  id: string;
  category: CostEntryCategory;
  description: string | null;
  amount: number;
  period_month: string;
  professional_id: string | null;
  created_by: string;
  created_at: string;
}

export interface CostEntryCreateRequest {
  category: CostEntryCategory;
  description?: string | null;
  amount: number;
  period_month: string;
  professional_id?: string | null;
}

// Achado do Dossiê Insighta RCM — Onda 2 do Plano de Ação: fecha o
// pipeline de escrita de core.marketing_spend (POST /marketing-spend).
// Mesmo vocabulário fechado do CHECK constraint no backend (a tabela
// nasceu pensada pra webhook/ETL do Meta/Google Ads; Instagram/Facebook
// entram como "meta_ads", é o mesmo anunciante).
export type MarketingSpendSource = "meta_ads" | "google_ads";

export interface MarketingSpend {
  id: string;
  source: MarketingSpendSource;
  campaign_id: string;
  campaign_name: string | null;
  spend_date: string;
  amount_spent: number;
  impressions: number | null;
  clicks: number | null;
  created_at: string;
}

export interface MarketingSpendCreateRequest {
  source: MarketingSpendSource;
  campaign_id: string;
  campaign_name?: string | null;
  spend_date: string;
  amount_spent: number;
  impressions?: number | null;
  clicks?: number | null;
}

// Raio-X da Receita, frente "Gestão eficiente" — CAC e receita média por
// paciente (proxy de LTV), por campanha/canal de marketing (GET
// /analytics/marketing-channels). `cac` usa o período do dashboard;
// `avg_revenue_per_patient` usa o histórico TOTAL dos pacientes
// atribuídos à campanha, não só o período.
export interface MarketingChannelItem {
  source: string;
  campaign_id: string;
  campaign_name: string | null;
  spend: number;
  patients_acquired: number;
  cac: number | null;
  lifetime_patients: number;
  lifetime_revenue: number;
  avg_revenue_per_patient: number | null;
}

export interface MarketingChannels {
  period_start: string;
  period_end: string;
  total_spend: number;
  items: MarketingChannelItem[]; // ordenado por gasto, maior primeiro
}

// "Equilíbrio Insighta" (Balanced Scorecard, perna Cliente) — funil de
// upsell (GET /analytics/upsell-funnel). Complementa MarketingChannels
// (aquisição) olhando expansão de receita em paciente já conquistado.
export interface UpsellFunnelItem {
  procedure_name: string;
  offered_count: number;
  accepted_count: number;
  acceptance_rate: number | null;
}

export interface UpsellFunnel {
  period_start: string;
  period_end: string;
  total_offered: number;
  total_accepted: number;
  overall_acceptance_rate: number | null;
  items: UpsellFunnelItem[]; // ordenado por offered_count, maior primeiro
}

// Candidatos a recontato (GET /analytics/recall-candidates) — a lista
// real por trás dos botões de ação dos insights de agenda que apontam
// pra um dia da semana ou um profissional específico (ver DECISÃO em
// app/services/insights (backend)::_weekday_drop_insight/_weekday_no_show_rate_insight/
// _capacity_drop_insight, backend). Diferente de InactivePatientItem
// (piso fixo de 365 dias): aqui days_since_last_appointment pode ser
// bem menor — o critério é só "sem retorno futuro marcado".
export interface RecallCandidateItem {
  patient_id: string;
  full_name: string;
  last_appointment_at: string;
  days_since_last_appointment: number;
  last_professional_name: string | null;
}

export interface RecallCandidates {
  items: RecallCandidateItem[];
  total_count: number;
  weekday: number | null;
  professional_id: string | null;
  professional_name: string | null;
}

// Contas de "Divergência de Cobrança" (GET /analytics/financial-hole-billings)
// — a lista real por trás do insight "Você está cobrando menos do que
// devia de alguns convênios" (ver DECISÃO em
// app/services/insights (backend)::_financial_hole_insight, backend).
// `agreed_price` é sempre > `charged_value` (nunca uma linha "certa" ou
// cobrada a mais aparece aqui).
export interface FinancialHoleBillingItem {
  billing_id: string;
  patient_full_name: string;
  procedure_label: string;
  insurance_plan_name: string;
  charged_value: number;
  agreed_price: number;
  hole_value: number;
}

export interface FinancialHoleBillings {
  period_start: string;
  period_end: string;
  items: FinancialHoleBillingItem[];
  total_count: number; // sempre TODAS as contas do período, não só as da página atual
  total_hole_value: number; // mesmo número que o insight cita — soma de TODAS, não só da página
  // Achado do usuário direto na tela: a lista era fixa em `limit` linhas
  // sem jeito de ver o resto quando total_count era maior. Agora
  // paginável de verdade (mesmo formato de PaginatedResponse) — ver
  // DECISÃO em app/schemas/analytics.py::FinancialHoleBillingsResponse.
  limit: number;
  offset: number;
}

// Foco de agenda — estado compartilhado entre SmartInsightsFeed (dispara
// via o botão de ação dos insights de agenda), ExecutiveOverviewPage
// (guarda o estado) e ExecutiveAgendaSummary (busca e mostra os
// candidatos a recontato correspondentes). Ver DECISÃO em
// InsightActionButton (SmartInsightsFeed.tsx) sobre os formatos
// "#weekday:<n>"/"#professional:<id>" que originam este estado.
export type AgendaFocus =
  | { type: "weekday"; weekday: number }
  | { type: "professional"; professionalId: string };

// Comparativo entre clínicas (GET /analytics/network-benchmark) — Sala de Comando 2.0
export interface NetworkBenchmarkMetric {
  key: string; // "denial" | "no_show" | "churn" ("Equilíbrio Insighta" — Balanced Scorecard, perna Cliente)
  label: string;
  your_rate: number | null;
  your_sample: number;
  network_median: number | null; // null = amostra de clínicas na base ainda insuficiente
  cohort_size: number;
  // "Mapa de Dados Insighta" — pilar Comparativo & rede: True quando o
  // cohort foi filtrado pela MESMA especialidade da clínica. Ver
  // DECISÃO em 048_network_benchmark_specialty_segment.sql (backend).
  cohort_is_segmented_by_specialty: boolean;
}

export interface NetworkBenchmark {
  metrics: NetworkBenchmarkMetric[];
  window_days: number;
}

// GET /analytics/organization-summary (Épico F3.2 do Plano Diretor —
// "Consolidação multi-unidade") — dashboard consolidado comparando as
// unidades do MESMO grupo lado a lado. AO CONTRÁRIO do Comparativo
// entre Clínicas, NÃO é anonimizado (unidades do mesmo dono).
// `belongs_to_organization: false` é o estado NORMAL da maioria das
// clínicas (avulsas), nunca um erro.
export interface OrganizationUnitSummary {
  tenant_id: string;
  trade_name: string;
  is_requesting_tenant: boolean;
  total_billed: number;
  denial_risk_pct: number | null; // null = sem faturamento no período
  appointment_count: number;
  no_show_rate: number | null; // null = sem atendimento resolvido no período
}

export interface OrganizationSummary {
  belongs_to_organization: boolean;
  organization_name: string | null;
  window_days: number;
  units: OrganizationUnitSummary[];
  consolidated_total_billed: number;
  consolidated_denial_risk_pct: number | null;
  consolidated_no_show_rate: number | null;
}

// POST /tenant/organization/invite + POST /tenant/organization/join —
// Achado da Auditoria Estratégica ("vinculação self-service de
// unidades multi-tenant"). O código só existe nesta resposta, uma vez
// (mesmo princípio de um segredo de posse única) — repassar por fora
// do produto (WhatsApp, e-mail) é responsabilidade de quem gerou.
export interface OrganizationInviteResponse {
  code: string;
  organization_name: string;
  expires_at: string;
}

export interface OrganizationJoinResponse {
  organization_name: string;
}

// GET /tenant/annual-goal/suggested (Épico F3.3 do Plano Diretor —
// "Metas e cenários orientados a dados") — duas sugestões
// independentes (crescimento histórico próprio vs. ritmo/percentil de
// rede), nunca uma média escondida entre elas. Campos de sugestão são
// null quando a base necessária (período anterior próprio / cohort de
// rede) ainda não existe.
export interface AnnualGoalSuggestion {
  trailing_12_months_total: number;
  own_growth_rate: number | null;
  own_trend_suggested_goal: number | null;
  network_growth_median: number | null;
  network_pace_suggested_goal: number | null;
  network_cohort_size: number;
}

// Oportunidades (GET /analytics/oportunidades) — Sala de Comando 2.0
export interface OportunidadeItem {
  insurance_plan_id: string;
  plan_display_name: string;
  tuss_code: string;
  procedure_name: string | null;
  your_price: number;
  network_median_price: number;
  network_cohort_size: number;
  monthly_volume: number;
  gap_value: number;
  gap_pct: number;
  estimated_monthly_opportunity: number;
  // "Junta Técnica Insighta" — contagem regressiva de preparação para
  // renovação (120 dias), só presente quando este convênio tem um
  // contrato vencendo sem sucessor cadastrado.
  days_until_contract_renewal: number | null;
  contract_valid_until: string | null;
}

export interface Oportunidades {
  items: OportunidadeItem[];
  window_days: number;
}

export interface BillingResponse {
  id: string;
  appointment_id: string;
  charged_value: number;
  status:
    | "pending"
    | "held_for_review"
    | "submitted"
    | "paid"
    | "denied"
    | "reversed";
  denial_risk_level: "low" | "medium" | "high";
  denial_reasons: string[];
  value_saved_by_correction: number;
  received_value: number | null;
  settled_at: string | null;
  created_at: string;
  // Achado 12 da Auditoria de Templates e Insights (médio) — campos
  // novos do Dicionário de Dados, espelhando app/schemas/billing.py
  // (backend): existiam na escrita desde a Rodada 1, mas nenhuma
  // resposta de leitura os devolvia até esta correção.
  quantity: number;
  member_card_number: string | null;
  item_type: string | null;
  coparticipation_value: number | null;
  // Épico F4.2 do Plano Diretor ("Fechar lacunas operacionais") — NULL
  // = ainda não confirmado (estado inicial da maioria), nunca um false
  // inventado (ver DECISÃO em 043_coparticipation_confirmation.sql).
  coparticipation_received: boolean | null;
  coparticipation_confirmed_at: string | null;
  // Épico F2.3 do Plano Diretor ("Auditoria documental leve —
  // prontuário × conta") — NULL = ainda não conferido (estado inicial
  // da maioria), nunca um false inventado (ver DECISÃO em
  // 044_opme_documentation_confirmation.sql).
  clinical_documentation_confirmed: boolean | null;
  // "Mapa de Dados Insighta" — Domínio Financeiro particular (Onda 1).
  // Ver DECISÃO em 049_billing_payment_method.sql (backend).
  payment_method: PaymentMethod | null;
  installments: number | null;
}

export type PaymentMethod =
  | "dinheiro"
  | "pix"
  | "cartao_debito"
  | "cartao_credito"
  | "boleto";

export interface BillingSettleRequest {
  received_value: number;
}

// Resultado de GET /billing/search — busca por nome/CPF do paciente,
// usada pelo autocomplete de "registrar pagamento recebido" e do
// Recurso de Glosa (ver DECISÃO em BillingRepository.search, backend).
/** Glosa registrada numa cobrança (GET /glosas?billing_id=). Rodada 14 (M3). */
export interface Glosa {
  id: string;
  billing_id: string;
  codigo_motivo: string | null;
  descricao_motivo: string | null;
  valor_glosado: number;
  data_recebimento: string;
  created_at: string;
  /** Veio de arquivo importado: corrige-se desfazendo a importação. */
  imported: boolean;
}

export interface BillingSearchItem {
  id: string;
  patient_name: string;
  procedure_code: string | null;
  insurance_plan_name: string;
  charged_value: number;
  received_value?: number | null;
  status: BillingResponse["status"];
  denial_risk_level: BillingResponse["denial_risk_level"];
  created_at: string;
  // Achado 12 da Auditoria (médio) — mesmo motivo de BillingResponse.
  item_type: string | null;
  member_card_number: string | null;
  // Épico F4.2 — mesmo motivo de BillingResponse acima.
  coparticipation_value: number | null;
  coparticipation_received: boolean | null;
  // Épico F2.3 — mesmo motivo de BillingResponse acima.
  clinical_documentation_confirmed: boolean | null;
  // "Mapa de Dados Insighta" — a tela de confirmação de coparticipação
  // usa o MESMO BillingSearchPicker das outras; mostra a forma de
  // pagamento já registrada, quando houver.
  payment_method: PaymentMethod | null;
}

// GET /billing/{id}/status-history — Achado 1.6 / Pilar 2 da Auditoria
// Implacável ("transparência de acesso", padrão Singapura/NEHR): ledger
// estruturado de toda transição de status deste faturamento, mais
// recente primeiro. `changed_by_name` é null quando a transição veio de
// importação automática (nenhum usuário humano específico por trás).
export interface BillingStatusHistoryEntry {
  from_status: string | null;
  to_status: string;
  source: string;
  reason: string | null;
  changed_by_name: string | null;
  created_at: string;
}

// Guia (TISS) — ver app/models/guia.py no backend. Fase 1 do plano de
// adequação ao fluxo real de mercado; já é preenchida automaticamente
// pela ingestão de Faturamento (colunas guia_tipo/guia_numero/guia_senha)
// e também pode ser cadastrada manualmente aqui.
export type GuiaTipo = "consulta" | "sadt" | "resumo_internacao" | "honorario";

export interface Guia {
  id: string;
  insurance_plan_id: string;
  tipo: GuiaTipo;
  numero: string | null;
  senha: string | null;
  senha_validade: string | null;
  tabela_procedimento: string | null;
  lote_id: string | null;
  created_at: string;
}

export interface GuiaCreateRequest {
  insurance_plan_id: string;
  tipo: GuiaTipo;
  numero?: string | null;
  senha?: string | null;
  senha_validade?: string | null;
  tabela_procedimento?: string | null;
}

// Lote — ver app/models/lote.py e app/schemas/lote.py no backend. Fase 2
// do plano de adequação ao fluxo real de mercado: agrupa Guias do MESMO
// convênio + tipo (aberto -> fechado -> faturado, este último setado
// por FaturaService.create_from_lotes, fora do alcance desta tela).
export type LoteStatus = "aberto" | "fechado" | "faturado";

export interface Lote {
  id: string;
  insurance_plan_id: string;
  tipo: GuiaTipo;
  status: LoteStatus;
  fatura_id: string | null;
  closed_at: string | null;
  created_at: string;
  guias_count: number;
}

export interface LoteCreateRequest {
  insurance_plan_id: string;
  tipo: GuiaTipo;
}

// Fatura — ver app/schemas/fatura.py no backend. Auditoria V1, rodada 10
// (A1): o ciclo lote → fatura → recebimento ganhou tela. A baixa total paga
// as cobranças das guias; cancelar devolve os lotes para "fechado".
export type FaturaStatus = "emitida" | "paga" | "parcialmente_paga" | "cancelada";

export interface Fatura {
  id: string;
  insurance_plan_id: string;
  serie: string | null;
  numero: string | null;
  status: FaturaStatus;
  data_emissao: string;
  valor_recebido: number | null;
  data_recebimento: string | null;
  created_at: string;
  valor_total: number | null;
  cobrancas: number;
  cobrancas_pendentes: number;
  // Rodada 11 (B2): cobranças negadas ficam fora de valor_total.
  valor_negado: number;
}

// Rodada 11 (M1): faturas em aberto e recebido em baixas parciais.
export interface FaturaSummary {
  emitidas: number;
  emitidas_valor: number;
  parciais: number;
  parciais_recebido: number;
  parciais_a_receber: number;
}

export interface FaturaCreateRequest {
  lote_ids: string[];
  serie?: string | null;
  numero?: string | null;
}

export interface FaturaSettleRequest {
  valor_recebido: number;
  is_partial?: boolean;
  correction?: boolean;
  confirm_overpayment?: boolean;
  confirm_underpayment?: boolean;
}

// Formato de erro único que app/main.py devolve para TODO erro da API
// (ver DECISÃO em app/main.py — o mesmo mecanismo serve o frontend e o
// usuário final).
export interface ApiErrorBody {
  error_code: string;
  message: string;
  request_id: string;
  detail?: unknown;
  campos?: { campo: string; problema: string }[];
  /** 409 que se resolve confirmando (rodada 5): reenviar com este campo = true. */
  confirm_field?: string;
}
