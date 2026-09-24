// Tipos espelhando os schemas Pydantic do backend (app/schemas/*.py).
// Mantidos manualmente por enquanto — se o projeto crescer, vale gerar
// isso automaticamente a partir do OpenAPI (/openapi.json) que o
// FastAPI já expõe, em vez de manter os dois em sincronia na mão.

// Achado F-04 (Auditoria Go-Live): quando o mesmo e-mail existe em mais
// de um tenant (consultor multi-clínica) e a senha é válida em mais de
// um deles, o backend não emite token nenhum de cara — devolve
// requires_tenant_selection=true + a lista de clínicas para o usuário
// escolher explicitamente (ver LoginPage.tsx). Na esmagadora maioria
// dos logins (1 tenant só) o formato é idêntico ao TokenResponse de
// sempre: access_token presente, requires_tenant_selection false.
export interface TenantOption {
  tenant_id: string;
  trade_name: string;
}

export interface TokenResponse {
  access_token?: string;
  token_type: string;
  // Achado MÉDIO da Auditoria de Prontidão v1 — ver DECISÃO em
  // app/sql/059_refresh_tokens.sql (backend). Ausente/undefined nos
  // casos que não emitem token nenhum ainda (ex: requires_tenant_selection=true).
  refresh_token?: string;
  requires_tenant_selection: boolean;
  tenant_options: TenantOption[];
}

// --- Cadastro público (self-signup) / recuperação de senha
// (app/schemas/token.py::RegisterRequest/PasswordResetRequestRequest/
// PasswordResetConfirmRequest) ---
export type PlanTier = "starter" | "professional" | "enterprise";

// owner_name/email/password OU google_credential — nunca os dois juntos
// (ver DECISÃO em RegisterRequest.validate_auth_method no backend).
export interface RegisterRequest {
  trade_name: string;
  legal_name?: string | null;
  cnpj: string;
  plan_tier: PlanTier;
  owner_name?: string;
  email?: string;
  password?: string;
  google_credential?: string;
  // LGPD ("vamos chegar a 9.5") — sem default no backend
  // (RegisterRequest.terms_accepted): precisa vir true de propósito, só
  // depois do checkbox de aceite marcado em SignUpPage.tsx.
  terms_accepted: boolean;
}

// Espelha TokenResponse — POST /auth/register nunca tem ambiguidade de
// tenant (a clínica acabou de nascer), então o formato de resposta é
// sempre o "simples" (access_token + token_type), sem os campos de
// seleção de tenant que só existem em LoginResponse.
export interface RegisterResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
}

// --- Login/cadastro com Google (app/schemas/token.py::GoogleCredentialRequest/GoogleAuthResponse) ---
export interface GoogleAuthResponse {
  access_token?: string;
  token_type: string;
  refresh_token?: string;
  requires_tenant_selection: boolean;
  tenant_options: TenantOption[];
  needs_registration: boolean;
  email?: string;
  suggested_owner_name?: string;
}

// Envelope de paginação usado por todo endpoint de listagem robusta
// (ver app/schemas/pagination.py — PaginatedResponse genérico no backend).
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// --- Gestão de Contatos para Relatórios (app/schemas/report_recipient.py) ---
export interface ReportRecipient {
  id: string;
  name: string;
  phone_whatsapp: string | null;
  email: string | null;
  report_types: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Central de Upload / Ingestão de Dados (app/schemas/ingestion.py) ---
export type IngestionFileFormat = "csv" | "xml" | "json";
// Espelha os valores reais gravados por IngestionRepository (claim_file
// -> "processing", mark_processed -> "processed", mark_failed ->
// "failed") — "processed" com error_row_count > 0 significa "processado,
// mas algumas linhas foram rejeitadas" (ver RejectedRowResponse/tela de
// Setup), não é um status separado.
export type IngestionFileStatus = "processing" | "processed" | "failed";

export interface IngestionFileEntry {
  id: string;
  original_filename: string | null;
  file_format: IngestionFileFormat;
  // Template de integração que o arquivo segue — "faturamento", "agenda"
  // ou "atendimento" (ver app/sql/075_atendimento_operational_timing.sql).
  data_type: string;
  status: IngestionFileStatus;
  row_count: number;
  error_row_count: number;
  error_message: string | null;
  received_at: string;
  processed_at: string | null;
}

export interface UploadIngestionFileResponse {
  id: string;
  file_format: IngestionFileFormat;
  data_type: string;
  status: IngestionFileStatus;
  row_count: number;
  error_row_count: number;
  received_at: string;
  already_processed: boolean;
  message: string | null;
}

// --- Tela de Setup: linhas de importação rejeitadas (app/schemas/ingestion.py) ---
// `reason` só tem um valor ACIONÁVEL hoje — "unknown_insurance_plan" (a
// Etapa 2/normalização não reconheceu o texto do convênio) — resolvível
// nesta tela via ResolveInsurancePlanRequest. Qualquer outro valor (hoje
// só "validation_error", ver _to_response no backend) é falha
// ESTRUTURAL da Etapa 1 (data/moeda/campo obrigatório malformado no
// arquivo de origem) — não tem mapeamento possível, só corrigir o
// arquivo e reenviar; `payload` vem vazio ({}) nesse caso porque a linha
// nunca chegou a virar um RawBillingRow válido.
export type RejectedRowReason = "unknown_insurance_plan" | "validation_error" | string;

export interface RejectedRow {
  id: number;
  ingestion_file_id: string;
  row_number: number;
  payload: Record<string, unknown>;
  reason: RejectedRowReason | null;
  raw_value: string | null;
  created_at: string;
}

export interface ResolveInsurancePlanRequest {
  insurance_plan_id: string;
}

export interface ResolveInsurancePlanResponse {
  row_id: number;
  resolved: boolean;
  additionally_resolved_count: number;
}

// --- Logs de Auditoria (app/schemas/audit_log.py) ---
export interface AuditLogEntry {
  id: number;
  actor_user_id: string | null;
  // null quando a ação não teve usuário logado (job de sistema) ou o
  // usuário já foi removido — a UI mostra "Sistema" nesse caso.
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  diff: Record<string, unknown> | null;
  created_at: string;
}

export type UserRole = "owner" | "admin" | "financeiro" | "atendimento" | "auditor";

export interface CurrentUser {
  tenant_id: string;
  role: UserRole;
  sub: string; // user_id
}

// --- Gestão de Usuários (app/schemas/user.py) ---
export interface PlatformUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  // Tour de boas-vindas guiado (ver OnboardingTour.tsx) — null = o
  // AppShell ainda deve mostrar o tour nesta sessão.
  onboarding_completed_at: string | null;
}

export interface UserCreateRequest {
  email: string;
  full_name: string;
  role: UserRole;
}

export interface UserUpdateRequest {
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface PasswordResetResponse {
  temporary_password: string;
  must_change_password: boolean;
}

// --- Painel do Administrador da Empresa (app/schemas/tenant.py) ---
export interface Tenant {
  id: string;
  legal_name: string;
  trade_name: string;
  cnpj: string;
  plan_tier: string;
  is_active: boolean;
  created_at: string;
  // Meta manual de faturamento anual — null quando ainda não configurada
  // (nunca calculada automaticamente, ver DECISÃO no backend). Alimenta
  // o insight de desempenho anual da Sala de Comando.
  annual_revenue_goal: number | null;
  // Limiares de risco de falta (frações 0-1, ex: 0.10 = 10%) — null usa
  // o default do motor (10%/30%, ver no_show_risk_engine.py). Achado do
  // usuário: cada especialidade tem um perfil de falta diferente, os
  // cortes do MVP eram um chute de partida, não uma calibração validada.
  no_show_low_threshold: number | null;
  no_show_medium_threshold: number | null;
  // Épico F2.1 do Plano Diretor ("Calibração por especialidade/porte") —
  // mesmo padrão acima. `specialty` é texto livre curto e descritivo
  // (usado hoje só para contexto, não seleciona uma tabela de benchmark
  // por especialidade que não existe). Limiares de risco de glosa são
  // PERCENTUAIS (0-100, não frações); tetos da Nota de Saúde Financeira
  // são frações 0-1 (mesma escala de no_show_*_threshold).
  specialty: string | null;
  denial_risk_warning_threshold: number | null;
  denial_risk_critical_threshold: number | null;
  health_score_denial_ceiling: number | null;
  health_score_no_show_ceiling: number | null;
}

export interface TenantUpdateRequest {
  legal_name?: string;
  trade_name?: string;
  annual_revenue_goal?: number;
  no_show_low_threshold?: number;
  no_show_medium_threshold?: number;
  specialty?: string;
  denial_risk_warning_threshold?: number;
  denial_risk_critical_threshold?: number;
  health_score_denial_ceiling?: number;
  health_score_no_show_ceiling?: number;
}

// GET /tenant/no-show-thresholds/suggested — calculado a partir do
// histórico REAL de faltas por paciente desta clínica (mediana/P85), não
// um valor genérico. Campos null = ainda não há histórico suficiente
// (menos de 10 pacientes qualificados) para uma sugestão confiável.
export interface NoShowThresholdSuggestion {
  low_threshold: number | null;
  medium_threshold: number | null;
  sample_size: number;
}

// GET /tenant/denial-risk-thresholds/suggested — mesmo raciocínio acima,
// aplicado ao histórico MENSAL de risco de glosa desta clínica (Épico
// F2.1 do Plano Diretor). Campos null = menos de 6 meses fechados de
// histórico.
export interface DenialRiskThresholdSuggestion {
  warning_threshold: number | null;
  critical_threshold: number | null;
  sample_size: number;
}

// GET /tenant/health-score-ceilings/suggested — mesmo raciocínio, para os
// DOIS tetos da Nota de Saúde Financeira. Cada teto tem sua própria
// amostra (podem divergir).
export interface HealthScoreCeilingSuggestion {
  denial_ceiling: number | null;
  denial_ceiling_sample_size: number;
  no_show_ceiling: number | null;
  no_show_ceiling_sample_size: number;
}

// --- Mapeador Automático de Coluna (app/schemas/ingestion.py) — escopo:
// só CSV de Faturamento por ora (ver DECISÃO no backend). ---
export interface ColumnMappingPreview {
  raw_headers: string[];
  suggested_mapping: Record<string, string>; // cabeçalho do arquivo -> campo canônico
  unresolved_required_fields: string[];
}

export interface ColumnAlias {
  id: string;
  data_type: string;
  source_header: string;
  canonical_field: string;
  created_at: string;
}

// --- Disparo sob demanda do relatório semanal (app/schemas/report.py) ---
export interface WeeklyReportRequest {
  period_start?: string;
  period_end?: string;
}

export interface WeeklyReportResponse {
  period_start: string;
  period_end: string;
  sent_via_whatsapp: boolean;
  // Detalhamento por destinatário — core.report_recipients suporta N
  // contatos por tenant (ver DECISÃO no backend, report_send_service.py).
  recipients_checked: number;
  sent: number;
  failed: number;
  detail: string;
}

// POST /reports/risk-alert/send — irmão de WeeklyReportResponse, sem
// period_start/period_end (o alerta é sempre "próximas 24h a partir de
// agora", ver DECISÃO em app/worker/daily_alert_job.py no backend).
export interface RiskAlertSendResponse {
  sent_via_whatsapp: boolean;
  recipients_checked: number;
  high_risk_appointments: number;
  sent: number;
  failed: number;
  detail: string;
}

// --- Central de Integrações & Webhooks (app/schemas/integration.py) ---
export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface ApiKeyCreated extends ApiKey {
  api_key: string;
}

// --- Webhooks OUTBOUND (sentido inverso da chave de API acima: a
// plataforma AVISA o Slack/CRM/planilha do cliente — ver
// app/services/webhook_dispatch_service.py) ---
export interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  event_types: string[];
  active: boolean;
  created_at: string;
}

export interface WebhookSubscriptionCreated extends WebhookSubscription {
  secret: string;
}

export interface WebhookSubscriptionCreateRequest {
  name: string;
  url: string;
  event_types: string[];
  active: boolean;
}

export interface WebhookSubscriptionUpdateRequest {
  active?: boolean;
}

// Visibilidade da fila de retentativa — GET /integrations/webhooks/deliveries
// (ver app/sql/028_webhook_delivery_queue.sql no backend).
export type WebhookDeliveryStatus = "pending" | "delivered" | "failed";

export interface WebhookDeliveryEntry {
  id: string;
  subscription_id: string;
  event_type: string;
  status: WebhookDeliveryStatus;
  attempt_count: number;
  next_attempt_at: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

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
  cards: Partial<Record<"faturado" | "recebimento" | "agenda" | "saude", string>>;
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
export type InsightSeverity = "critical" | "warning" | "positive" | "comparativo";

// "faturamento" | "agenda" — área do card, usada por SmartInsightsFeed.tsx
// pra agrupar o feed em seções em vez de uma lista única misturando
// cobrança/glosa com ocupação de agenda (ver DECISÃO em
// smart_insights_engine.Insight.category, backend). "estrategia" só
// aparece em itens sintéticos da fila (PriorityQueueItem, ver abaixo) —
// nunca emitido por generate_insights(), então SmartInsightsFeed.tsx
// nunca precisa saber desse terceiro valor.
export type InsightCategory = "faturamento" | "agenda" | "estoque" | "prontuario" | "estrategia";

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
export type InsightOutcomeStatus = "pendente" | "em_andamento" | "resolvido" | "ignorado";

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
export type PatientOutreachChannel = "telefone" | "whatsapp" | "sms" | "email" | "presencial";
export type PatientOutreachOutcome = "contatado" | "sem_resposta" | "agendou" | "recusou";

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
export type RfmSegment = "campeoes" | "fieis" | "nao_pode_perder" | "em_risco" | "novos" | "hibernando" | "precisa_atencao";

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
export type CostEntryCategory = "folha_fixa" | "comissao_repasse" | "aluguel" | "insumo" | "outros";

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
// smart_insights_engine.py::_weekday_drop_insight/_weekday_no_show_rate_insight/
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
// smart_insights_engine.py::_financial_hole_insight, backend).
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
export type AgendaFocus = { type: "weekday"; weekday: number } | { type: "professional"; professionalId: string };

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
  status: "pending" | "held_for_review" | "submitted" | "paid" | "denied" | "reversed";
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

export type PaymentMethod = "dinheiro" | "pix" | "cartao_debito" | "cartao_credito" | "boleto";

export interface BillingSettleRequest {
  received_value: number;
}

// Resultado de GET /billing/search — busca por nome/CPF do paciente,
// usada pelo autocomplete de "registrar pagamento recebido" e do
// Recurso de Glosa (ver DECISÃO em BillingRepository.search, backend).
export interface BillingSearchItem {
  id: string;
  patient_name: string;
  procedure_code: string | null;
  insurance_plan_name: string;
  charged_value: number;
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

// Formato de erro único que app/main.py devolve para TODO erro da API
// (ver DECISÃO em app/main.py — o mesmo mecanismo serve o frontend e o
// usuário final).
export interface ApiErrorBody {
  error_code: string;
  message: string;
  request_id: string;
  detail?: unknown;
  campos?: { campo: string; problema: string }[];
}

// --- Pacientes (app/schemas/patient.py) ---
export type PreferredTimeWindow = "manha" | "tarde" | "noite";

export interface Patient {
  id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  acquisition_source: string | null;
  created_at: string;
  // "Mapa de Dados Insighta" — Domínio Paciente (Onda 1): o paciente
  // relacional, não só transacional. Ver DECISÃO em
  // 045_patient_relationship_fields.sql (backend).
  referred_by_patient_id: string | null;
  communication_consent: boolean | null;
  preferred_time_window: PreferredTimeWindow | null;
  zip_code: string | null;
  // "Equilíbrio Insighta" (Balanced Scorecard, perna Cliente) — score de
  // paciente de alto valor, calculado só em GET /patients (nunca em
  // create/update, que devolvem o default False/[]).
  is_vip: boolean;
  vip_reasons: string[];
}

// Achado do Dossiê Insighta RCM — aniversariantes do mês (GET /patients/birthdays)
export interface PatientBirthdayItem {
  patient_id: string;
  full_name: string;
  birth_date: string;
  communication_consent: boolean | null;
}

export interface PatientBirthdays {
  month: number;
  items: PatientBirthdayItem[]; // ordenado por dia do mês
}

export interface PatientCreateRequest {
  full_name: string;
  cpf?: string | null;
  birth_date?: string | null;
  referred_by_patient_id?: string | null;
  communication_consent?: boolean | null;
  preferred_time_window?: PreferredTimeWindow | null;
  zip_code?: string | null;
}

// PATCH /patients/{id} — completa depois os campos relacionais que
// raramente são conhecidos no primeiro cadastro.
export interface PatientUpdateRequest {
  referred_by_patient_id?: string | null;
  communication_consent?: boolean | null;
  preferred_time_window?: PreferredTimeWindow | null;
  zip_code?: string | null;
}

// Ficha do Paciente (Roadmap "Rumo à Nota 9", Fase 4) — GET /patients/search
// e GET /patients/{id}/ficha, ver app/schemas/patient.py.
export interface PatientSearchItem {
  id: string;
  full_name: string;
  cpf: string | null;
}

export interface PatientFichaBilling {
  id: string;
  charged_value: number;
  status: string;
  denial_risk_level: "low" | "medium" | "high";
  created_at: string;
}

export interface PatientFichaStockMovement {
  id: string;
  material_name: string;
  categoria: string | null;
  tipo: string;
  quantidade: number;
  valor_total_custo: number | null;
  data_movimentacao: string;
}

export interface PatientFichaClinicalEvolution {
  id: string;
  tipo: string | null;
  professional_name: string | null;
  hipotese_diagnostica_principal: string | null;
  conduta_terapeutica_plano: string | null;
  data_evolucao: string;
}

export interface PatientFichaAppointment {
  id: string;
  scheduled_at: string;
  status: string;
  professional_name: string | null;
  insurance_plan_name: string | null;
  no_show_risk_level: NoShowRiskLevel | null;
  billings: PatientFichaBilling[];
  stock_movements: PatientFichaStockMovement[];
  clinical_evolutions: PatientFichaClinicalEvolution[];
}

export interface PatientFichaSummary {
  total_appointments: number;
  no_show_count: number;
  no_show_rate: number | null;
  total_billed: number;
  total_value_saved: number;
  last_visit_at: string | null;
}

export interface PatientFicha {
  patient: Patient;
  summary: PatientFichaSummary;
  appointments: PatientFichaAppointment[];
}

// --- Profissionais (app/schemas/professional.py) ---
export interface AvailabilityBlock {
  weekday: number; // 0=domingo .. 6=sábado
  start_time: string; // "HH:MM:SS"
  end_time: string;
}

// "Mapa de Dados Insighta" — Domínio Profissional (Onda 1): ausência
// futura planejada (férias, licença) — intervalo de datas, diferente
// da grade semanal (recorrente). Ver DECISÃO em
// 047_professional_planned_absences.sql (backend).
export interface PlannedAbsence {
  id: string;
  start_date: string; // "YYYY-MM-DD"
  end_date: string;
  reason: string | null;
  created_at: string;
}

export interface PlannedAbsenceCreateRequest {
  start_date: string;
  end_date: string;
  reason?: string | null;
}

// "Mapa de Dados Insighta" — Domínio Profissional (Onda 2): arranjos de
// contratação mais comuns entre profissionais de saúde no Brasil. Ver
// DECISÃO em 051_professional_contract_commission.sql (backend).
export type ContractType = "clt" | "pj" | "autonomo" | "cooperado";

export interface Professional {
  id: string;
  full_name: string;
  professional_registry: string | null;
  specialty: string | null;
  is_active: boolean;
  availability: AvailabilityBlock[];
  planned_absences: PlannedAbsence[];
  contract_type: ContractType | null;
  commission_rate: number | null;
}

export interface ProfessionalCreateRequest {
  full_name: string;
  professional_registry?: string | null;
  specialty?: string | null;
  contract_type?: ContractType | null;
  commission_rate?: number | null;
  availability: AvailabilityBlock[];
}

// PATCH /professionals/{id} — todo campo é opcional (payload parcial).
// availability, quando enviado, SUBSTITUI a grade inteira (omitir o
// campo mantém a grade atual intacta).
export interface ProfessionalUpdateRequest {
  full_name?: string;
  professional_registry?: string | null;
  specialty?: string | null;
  is_active?: boolean;
  contract_type?: ContractType | null;
  commission_rate?: number | null;
  availability?: AvailabilityBlock[];
}

// --- Consultas (app/schemas/appointment.py) ---
export type NoShowRiskLevel = "indeterminado" | "baixo" | "medio" | "alto";

export interface Appointment {
  id: string;
  patient_id: string;
  insurance_plan_id: string | null;
  professional_id: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  status: string;
  procedure_code: string | null;
  cid_code: string | null;
  no_show_risk_level: NoShowRiskLevel | null;
  no_show_risk_score: number | null;
  created_at: string;
  // Achado 12 da Auditoria de Templates e Insights (médio) — campos
  // novos do Dicionário de Dados, espelhando app/schemas/appointment.py
  // (backend): existiam na escrita desde a Rodada 1, mas nenhuma
  // resposta de leitura os devolvia até esta correção.
  booked_at: string | null;
  visit_type: string | null;
  cancellation_reason: string | null;
  booking_channel: string | null;
  // "Mapa de Dados Insighta" — Domínio Pós-atendimento (Onda 1): motivo
  // estruturado do agendamento (complementa visit_type). Ver DECISÃO em
  // 046_appointment_visit_intent.sql (backend).
  visit_intent_tag: VisitIntentTag | null;
  // "Mapa de Dados Insighta" — Domínio Pós-atendimento (Onda 2): funil de
  // upsell no checkout. Ver DECISÃO em 050_appointment_addon_upsell.sql
  // (backend).
  addon_offered_procedure: string | null;
  addon_declined: boolean | null;
  // "Mapa de Dados Insighta" — Domínio Pós-atendimento (Onda 2), pilar
  // Satisfação/NPS. Ver DECISÃO em 052_appointment_satisfaction.sql
  // (backend).
  visit_satisfaction_score: number | null;
  // Onda 5 do Plano de Ação, item 15. Ver DECISÃO em
  // 056_appointment_squeeze_in.sql (backend).
  is_squeeze_in: boolean | null;
}

export type VisitIntentTag = "rotina" | "retorno" | "avaliacao" | "urgencia";

export interface AppointmentCreateRequest {
  patient_id: string;
  professional_id?: string | null;
  scheduled_at: string; // ISO 8601
  duration_minutes?: number | null;
  procedure_code?: string | null;
  cid_code?: string | null;
  visit_intent_tag?: VisitIntentTag | null;
  is_squeeze_in?: boolean | null;
}

// PATCH /appointments/{id} (app/schemas/appointment.py::AppointmentUpdateRequest)
// — fecha o ciclo Agendamento -> Atendimento: status/procedimento/CID e o
// funil de upsell só são conhecidos DEPOIS da consulta.
export interface AppointmentUpdateRequest {
  status?: string | null;
  procedure_code?: string | null;
  cid_code?: string | null;
  visit_intent_tag?: VisitIntentTag | null;
  addon_offered_procedure?: string | null;
  addon_declined?: boolean | null;
  is_squeeze_in?: boolean | null;
}

// POST /appointments/{id}/satisfaction-link (app/schemas/appointment_satisfaction.py)
export interface SatisfactionLinkResponse {
  url: string;
  expires_at: string;
}

// GET /public/satisfaction/{token} — sem autenticação (o paciente acessa
// o link direto). Ver DECISÃO em 052_appointment_satisfaction.sql (backend).
export interface PublicSatisfactionStatusResponse {
  valid: boolean;
}

// Item de GET /appointments (listagem paginada por período) — espelha
// AppointmentListItem no backend (app/schemas/appointment.py). Peça que
// faltava depois do Achado 12 da Auditoria de Templates e Insights: os
// insights de canal de agendamento/motivo de cancelamento apontavam o
// problema em AGREGADO, mas não existia nenhuma tela que mostrasse QUAL
// agendamento tinha qual canal/motivo — mesmo raciocínio de
// BillingSearchItem (nome do paciente já resolvido, evita N+1).
export interface AppointmentListItem {
  id: string;
  patient_name: string;
  scheduled_at: string;
  status: string;
  procedure_code: string | null;
  visit_type: string | null;
  booking_channel: string | null;
  cancellation_reason: string | null;
}

// --- Lista de espera (app/schemas/waitlist_entry.py) — Onda 5 do Plano
// de Ação, item 16. Ver DECISÃO completa em 057_waitlist_entries.sql
// (backend): 3 estados só (aguardando/agendado/cancelado), sem canal de
// notificação automática.
export type WaitlistStatus = "aguardando" | "agendado" | "cancelado";

export interface WaitlistEntry {
  id: string;
  patient_id: string;
  patient_full_name: string;
  professional_id: string | null;
  professional_full_name: string | null;
  procedure_code: string | null;
  preferred_time_window: PreferredTimeWindow | null;
  notes: string | null;
  status: WaitlistStatus;
  resolved_appointment_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface WaitlistEntryCreateRequest {
  patient_id: string;
  professional_id?: string | null;
  procedure_code?: string | null;
  preferred_time_window?: PreferredTimeWindow | null;
  notes?: string | null;
}

// --- Parser Inteligente de Contratos: Convênios (app/schemas/insurance_company.py) ---
export interface InsuranceCompany {
  id: string;
  name: string;
  ans_registry: string | null;
  // Prazo CONTRATUAL de recurso de glosa desta operadora, em dias
  // corridos — não é uma lei federal única, é o que está escrito no
  // contrato (ver app/sql/008_denial_appeals.sql). NULL usa o fallback
  // genérico do backend.
  default_appeal_deadline_days: number | null;
  // Desativação, não exclusão — Contract/Appointment/Billing referenciam
  // planos desta operadora, apagar de verdade quebraria essas FKs (ver
  // DECISÃO em app/sql/014_insurance_is_active.sql, backend). Mesmo
  // padrão de Professional.is_active/User.is_active.
  is_active: boolean;
  created_at: string;
}

export interface InsuranceCompanyCreateRequest {
  name: string;
  ans_registry?: string | null;
  default_appeal_deadline_days?: number | null;
}

export interface InsuranceCompanyUpdateRequest {
  default_appeal_deadline_days?: number | null;
  is_active?: boolean;
}

// --- Planos (app/schemas/insurance_plan.py) ---

// Plano de Ação Insighta — Onda 3 ("particular como cidadão de primeira
// classe"): "convenio" (padrão, tem insurance_company_id) ou
// "particular" (paciente sem operadora, insurance_company_id sempre
// null) — ver DECISÃO completa em 054_insurance_plan_type.sql, backend.
export type InsurancePlanType = "convenio" | "particular";

export interface InsurancePlan {
  id: string;
  insurance_company_id: string | null;
  display_name: string;
  normalized_key: string;
  ans_registry: string | null;
  // Ver DECISÃO em InsuranceCompany.is_active acima — mesmo princípio,
  // por plano. Desativar NÃO afeta a resolução automática de convênio
  // durante a ingestão de arquivo (ver backend InsurancePlanRepository.resolve).
  is_active: boolean;
  plan_type: InsurancePlanType;
  created_at: string;
}

export interface InsurancePlanCreateRequest {
  // Obrigatório para plan_type "convenio" (padrão), proibido para
  // "particular" — o backend valida essa combinação e devolve 422 se
  // vier errada.
  insurance_company_id?: string | null;
  display_name: string;
  ans_registry?: string | null;
  plan_type?: InsurancePlanType;
}

export interface InsurancePlanUpdateRequest {
  is_active?: boolean;
  plan_type?: InsurancePlanType;
}

// --- Contratos & Itens (app/schemas/contract.py) ---
export type ContractStatus = "rascunho" | "em_revisao" | "homologado";

export interface ContractItem {
  id: string;
  tuss_code: string;
  procedure_name: string | null;
  agreed_price: number;
  // Achado da Auditoria Estratégica — custo de insumo estimado da
  // clínica (nunca o valor pago pelo convênio), opcional. Ainda sem
  // campo de captura na UI nesta rodada (só leitura/API por enquanto) —
  // ver DECISÃO em app/sql/061_contract_item_standard_cost.sql (backend).
  standard_cost: number | null;
}

export interface ContractItemInput {
  tuss_code: string;
  procedure_name?: string | null;
  agreed_price: number;
  standard_cost?: number | null;
}

export interface Contract {
  id: string;
  insurance_plan_id: string;
  valid_from: string;
  valid_until: string | null;
  status: ContractStatus;
  pdf_s3_key: string | null;
  items: ContractItem[];
  created_at: string;
}

export interface ContractCreateRequest {
  insurance_plan_id: string;
  valid_from: string;
  valid_until?: string | null;
  items: ContractItemInput[];
}

// Preview da IA — Tela de Conferência (Human-in-the-Loop). Ainda NÃO
// persistido em contract_items (só existe depois do POST .../homologate).
export interface ExtractedItem {
  tuss_code: string;
  procedure_name: string | null;
  agreed_price: number;
  warning: string | null;
  /** Página do PDF onde a linha foi lida (Frente 1). */
  source_page?: number | null;
}

export interface ExtractionPreview {
  contract_id: string;
  status: ContractStatus;
  items: ExtractedItem[];
  warnings: string[];
  pages_total?: number | null;
  /** Leitura em camadas: quantas páginas precisaram de IA. */
  pages_sent_to_ai?: number | null;
  /** Páginas que a IA não leu por inteiro — conferir à mão. */
  incomplete_pages?: number[];
}

export interface HomologateRequest {
  items: ContractItemInput[];
}

// Achado 1.7 da Auditoria Implacável: a extração de contrato e o
// rascunho de recurso de glosa saíram do caminho síncrono da
// requisição (ver DECISÃO completa em app/sql/065_ai_generation_jobs.sql
// e app/worker/ai_generation_job.py no backend). POST .../extract e
// POST .../draft-justification agora devolvem só isto — sempre
// job_id + status='pending' — e o resultado de verdade vem do polling
// em GET /ai-jobs/{job_id}.
export interface AiGenerationJobEnqueuedResponse {
  job_id: string;
  status: "pending";
}

export type AiGenerationJobStatus = "pending" | "completed" | "failed";

// `result` depende de `kind` (o chamador já sabe qual pediu):
// ExtractionPreview para contract_extraction, { draft: string } para
// denial_appeal_draft.
export interface AiGenerationJob<TResult = unknown> {
  id: string;
  kind: "contract_extraction" | "denial_appeal_draft";
  status: AiGenerationJobStatus;
  result: TResult | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

// --- Recurso de Glosa / conformidade ANS (app/schemas/denial_appeal.py) ---
export type AppealType = "tecnica" | "administrativa" | "medica";
export type AppealStatus = "aberto" | "protocolado" | "deferido" | "indeferido" | "nip_aberta";

export interface DenialAppealAttachment {
  id: string;
  filename: string;
  created_at: string;
}

export interface DenialAppeal {
  id: string;
  billing_id: string;
  appeal_type: AppealType;
  operator_denial_reason: string | null;
  denied_at: string;
  deadline_at: string;
  status: AppealStatus;
  filed_at: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  attachments: DenialAppealAttachment[];
}

export interface DenialAppealCreateRequest {
  billing_id: string;
  appeal_type: AppealType;
  operator_denial_reason?: string | null;
  denied_at: string;
  deadline_at?: string | null;
}

export interface DenialAppealFileRequest {
  filed_at?: string | null;
}

export interface DenialAppealResolveRequest {
  status: "deferido" | "indeferido" | "nip_aberta";
  resolution_notes?: string | null;
}

// Formato de AiGenerationJob["result"] quando kind === "denial_appeal_draft"
// (POST /denial-appeals/{id}/draft-justification enfileira o job — ver
// AiGenerationJob acima) — rascunho via IA, SEMPRE grounded nos fatos
// do caso (ver DECISÃO em app/services/denial_appeal_draft_service.py
// no backend). Volta como texto editável, nunca gravado sozinho.
export interface DenialAppealDraftJustificationResponse {
  draft: string;
}

// Central de Notificações (sino) — GET /announcements. Sem endpoint de
// criação: quem publica é a equipe da plataforma, via
// app/scripts/publish_announcement.py no backend (ver DECISÃO em
// app/sql/023_announcements_and_support.sql).
export interface Announcement {
  id: string;
  title: string;
  body: string;
  published_at: string;
  is_read: boolean;
}

export interface AnnouncementListResponse {
  items: Announcement[];
  unread_count: number;
}

// Central de Ajuda — POST/GET /support-requests.
export interface SupportRequestCreateRequest {
  subject: string;
  message: string;
}

export interface SupportRequest {
  id: string;
  subject: string;
  message: string;
  status: "aberto" | "respondido";
  created_at: string;
}

// --- Painel interno de Customer Success (/plataforma) — nunca acessível
// por um usuário de clínica, só pela equipe que opera a Insighta (ver
// DECISÃO em app/sql/026_platform_customer_success.sql no backend). ---
export type TenantEngagementStatus = "engajado" | "atencao" | "risco" | "novo" | "inativo";

// Mesmas 6 chaves de app/sql/030_platform_feature_usage.sql, sempre
// presentes (mesmo zeradas) — mede MUTAÇÃO (ação real de escrita), não
// navegação/leitura de tela (ver DECISÃO no arquivo SQL).
export type FeatureUsageKey = "pacientes" | "agenda" | "faturamento" | "recurso_de_glosa" | "contratos" | "usuarios";

export interface TenantUsageSummary {
  tenant_id: string;
  trade_name: string;
  plan_tier: string;
  tenant_is_active: boolean;
  tenant_created_at: string;
  active_users: number;
  last_activity_at: string | null;
  events_last_30d: number;
  patients_total: number;
  appointments_last_30d: number;
  billings_last_30d: number;
  feature_usage_last_30d: Record<FeatureUsageKey, number>;
  days_since_last_activity: number | null;
  engagement_status: TenantEngagementStatus;
}

// Resultado de POST /platform/alerts/run — nomes de clínica (não ids),
// já que quem lê isto é sempre um humano da equipe.
export interface PlatformAlertRunResult {
  new_alerts: string[];
  reminders_sent: string[];
  recovered: string[];
}

// "Histórico de quem fez o quê" — GET /platform/audit-log (ver DECISÃO
// em app/sql/029_platform_users.sql no backend).
export interface PlatformAuditLogEntry {
  id: number;
  actor_email: string;
  action: string;
  created_at: string;
}

// Achado CRÍTICO da Auditoria de Prontidão v1 ("produto não se cobra
// sozinho") — fluxo self-service de upgrade de plano, ver DECISÃO
// completa em app/services/payment_provider.py (backend).
export interface PlanCatalogEntry {
  tier: PlanTier;
  label: string;
  monthly_price_cents: number;
  self_service: boolean;
}

export interface SubscriptionStatus {
  plan_tier: PlanTier;
  pending_checkout_id: string | null;
}

export interface CheckoutSession {
  checkout_id: string;
  checkout_url: string;
  amount_cents: number;
  plan_tier: PlanTier;
}

export interface CheckoutDetail {
  id: string;
  plan_tier: PlanTier;
  status: "pending" | "completed" | "canceled";
  amount_cents: number;
  created_at: string;
}

// ---------------------------------------------------------------------
// Redesign 2026 — rotas de app/api/v1/endpoints/briefing.py (backend).
// ---------------------------------------------------------------------
export type BriefingTone = "positive" | "warning" | "critical" | "neutral";

export interface ModuleAlert {
  route: string;
  text: string;
  tone: BriefingTone;
}

export interface UrgentNotice {
  text: string;
  action_label: string;
  action_href: string;
}

export interface NavigationSummary {
  module_alerts: ModuleAlert[];
  my_open_insights: number;
  last_import_at: string | null;
  last_import_source: string | null;
  urgent: UrgentNotice | null;
}

export interface AgendaPeriodLine {
  label: string;
  text: string;
  tone: BriefingTone;
  action_label: string | null;
  action_href: string | null;
}

export interface TodayAgenda {
  date: string;
  headline: string;
  total_appointments: number;
  periods: AgendaPeriodLine[];
  waitlist_waiting: number;
}

export interface PayerOverviewRow {
  insurance_plan_id: string;
  name: string;
  plan_type: string;
  billed: number;
  share_pct: number;
  denial_pct: number;
  denied_value: number;
  avg_days_to_receive: number | null;
  awaiting_value: number;
  read: string;
  tone: "good" | "warn" | "bad" | "neutral";
}

export interface PayerVerdict {
  kind: "best" | "denials" | "slowest";
  label: string;
  name: string;
  text: string;
}

export interface PayerAttentionItem {
  tone: "warning" | "critical";
  title: string;
  text: string;
  href: string | null;
}

export interface PayerOverview {
  period_start: string;
  period_end: string;
  total_billed: number;
  total_denied: number;
  avg_days_to_receive: number | null;
  rows: PayerOverviewRow[];
  verdicts: PayerVerdict[];
  concentration_text: string | null;
  attention: PayerAttentionItem[];
}

export interface WeeklyTrendPoint {
  week_start: string;
  label: string;
  billed: number;
  denied: number;
}

export interface WeeklyTrend {
  points: WeeklyTrendPoint[];
  annotation_index: number | null;
  annotation_title: string | null;
  annotation_text: string | null;
  summary: string | null;
}

export interface RecoveredValue {
  month_start: string;
  total: number;
  resolved_count: number;
  items: { title: string; value: number | null }[];
}

export interface AskResponse {
  question: string;
  answer: string;
  sources: string;
  /** "insighta" = resposta pronta (sem IA, custo zero); "ia" = redigida pela IA. */
  answered_by?: "insighta" | "ia";
  /** "Entendi: qual convênio mais glosa." — só nas respostas prontas. */
  understood?: string | null;
}

export interface NegotiationArgument {
  plan_name: string;
  target_days: number;
  monthly_cash_released: number;
  argument: string;
}

export interface BriefingEmailResult {
  sent_to: string;
  delivered: boolean;
}

// GET /analytics/unbilled-consumption — lista por trás do alerta
// "material usado e não cobrado" (aba Estoque da Sala de Comando).
export interface UnbilledConsumptionItem {
  appointment_id: string;
  scheduled_at: string;
  patient_name: string | null;
  professional_name: string | null;
  materials: string;
  cost: number;
}

export interface UnbilledConsumption {
  period_start: string;
  period_end: string;
  total_cost: number;
  items: UnbilledConsumptionItem[];
}

/** GET /analytics/no-show-accuracy — Frente 1: acerto da previsão de falta. */
export interface NoShowLevelOutcome {
  risk_level: "baixo" | "medio" | "alto";
  appointments: number;
  no_shows: number;
  no_show_rate: number | null;
}

export interface NoShowAccuracy {
  window_days: number;
  evaluated: number;
  no_shows: number;
  flagged_no_shows: number;
  hit_rate: number | null;
  lift: number | null;
  by_level: NoShowLevelOutcome[];
  low_threshold: number;
  medium_threshold: number;
  calibration_status: "aprendendo" | "padrao" | "auto" | "manual";
  calibrated_at: string | null;
  history_days: number;
  days_until_calibration: number;
}

/** GET /analytics/denial-model-status — Frente 1: modelo de ML de glosa. */
export interface DenialModelStatus {
  status: "aprendendo" | "pronto_para_treinar" | "ativo";
  samples: number;
  denied: number;
  not_denied: number;
  min_samples: number;
  min_class_samples: number;
}

/** GET /analytics/ai-usage — Bloco 3: cota e custo de IA do mês. */
export interface AiQuotaItem {
  kind: "ask" | "appeal_draft" | "contract_extraction";
  label: string;
  used: number;
  limit: number;
}

export interface AiUsageSummary {
  month_start: string;
  renews_on: string;
  cost_usd: number;
  items: AiQuotaItem[];
}

/** GET /ingestion/templates — Bloco 2: modelo de importação por perna. */
export interface IngestionTemplateColumn {
  header: string;
  label: string;
  required: boolean;
  example: string;
  hint: string;
}

export interface IngestionTemplate {
  data_type: string;
  title: string;
  description: string;
  columns: IngestionTemplateColumn[];
}

/** GET /ingestion/files/{id}/report — o que entrou e o que ficou de fora, e por quê. */
export interface IngestionValidationReport {
  ingestion_file_id: string;
  original_filename: string | null;
  data_type: string;
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  pending_rows: number;
  reasons: { reason: string; count: number; rows: number[] }[];
}

/** GET /tenant/account-health — Bloco 2: Saúde da conta. */
export interface AccountHealthCheck {
  key: string;
  group: "dados" | "equipe" | "configuracao";
  label: string;
  status: "ok" | "atencao" | "pendente";
  detail: string;
  action_label: string | null;
  action_href: string | null;
}

export interface AccountHealth {
  ok_count: number;
  attention_count: number;
  checks: AccountHealthCheck[];
}
