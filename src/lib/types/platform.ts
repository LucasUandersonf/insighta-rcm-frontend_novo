import type { PlanTier } from "./account";

// --- Painel interno de Customer Success (/plataforma) — nunca acessível
// por um usuário de clínica, só pela equipe que opera a Insighta (ver
// DECISÃO em app/sql/026_platform_customer_success.sql no backend). ---
export type TenantEngagementStatus =
  | "engajado"
  | "atencao"
  | "risco"
  | "novo"
  | "inativo";

// Mesmas 6 chaves de app/sql/030_platform_feature_usage.sql, sempre
// presentes (mesmo zeradas) — mede MUTAÇÃO (ação real de escrita), não
// navegação/leitura de tela (ver DECISÃO no arquivo SQL).
export type FeatureUsageKey =
  | "pacientes"
  | "agenda"
  | "faturamento"
  | "recurso_de_glosa"
  | "contratos"
  | "usuarios";

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

export type BillingStatus =
  | "pending_payment"
  | "active"
  | "past_due"
  | "canceling"
  | "canceled";

export interface SubscriptionStatus {
  plan_tier: PlanTier;
  pending_checkout_id: string | null;
  /** false = o sistema não exige pagamento (BILLING_REQUIRED desligado no backend). */
  billing_required: boolean;
  billing_status: BillingStatus;
  access_allowed: boolean;
  overdue_since: string | null;
  grace_days: number;
  founders_member: boolean;
  price_locked_until: string | null;
  current_price_cents: number | null;
  provider: "asaas" | "stripe" | "mock";
  /** Cancelamento pelo cliente: pedido em / acesso até (fim do período pago). */
  cancel_requested_at?: string | null;
  access_until?: string | null;
}

export interface SubscriptionCancelResponse {
  status: BillingStatus;
  access_until: string | null;
  provider_confirmed: boolean | null;
  message: string;
}

/** Oferta vigente para quem vai assinar agora (GET /api/v1/subscription/offer). */
export interface SubscriptionOffer {
  available: boolean;
  plan_tier: PlanTier | null;
  price_cents: number | null;
  founders: boolean;
  founders_slots_total: number;
  founders_slots_remaining: number;
  founders_lock_months: number;
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
  /** UX2-26: link para a tela quando a pergunta é "onde fica". */
  action_label?: string | null;
  action_href?: string | null;
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
  /** UX2-04: false = IA desligada; a tela não mostra cota de perguntas à IA. */
  ai_enabled?: boolean;
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
  /** `rows` = linhas DA PLANILHA (cabeçalho = linha 1). `action` =
   * "unknown_insurance_plan" quando a própria tela resolve (UX-06). */
  reasons: { reason: string; count: number; rows: number[]; action?: string | null; raw_value?: string | null }[];
  /** UX-01: convênios que o arquivo cadastrou. */
  created_plans?: string[];
  last_retry_at?: string | null;
}

/** GET /analytics/data-readiness — UX-04/UX-17/UX-28. */
export interface DataReadiness {
  sources: string[];
  missing: string[];
  price_table_coverage_pct: number | null;
  plans_without_price_table: string[];
  /** UX3-02: último dia com faturamento importado ("AAAA-MM-DD"). */
  last_billing_date?: string | null;
}

/** GET /ingestion/rejected/unknown-plans — UX-05. */
export interface UnknownPlanGroup {
  raw_value: string;
  count: number;
  first_row_id: number;
  last_received_at: string | null;
  data_types: string[];
  samples: { patient_name: string | null; charged_value: number | string | null }[];
  suggested_plan_id: string | null;
  suggested_plan_name: string | null;
}

export interface ResolveByNameResponse {
  raw_value: string;
  plan_id: string;
  plan_name: string;
  created_plan: boolean;
  resolved: number;
  still_rejected: number;
  message: string;
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

/** A9 — GET /platform/pilot-metrics (critérios de docs/piloto/CRITERIOS_DE_SUCESSO.md). */
export interface PilotMetrics {
  tenant_id: string;
  trade_name: string;
  tenant_created_at: string;
  first_upload_at: string | null;
  days_to_first_upload: number | null;
  upload_days_total: number;
  upload_days_after_first: number;
  active_weeks_last_4: number;
  last_login_at: string | null;
  insights_tracked: number;
  value_found: number;
  value_recovered: number;
  appeals_created: number;
  criterio_dados_em_7_dias: boolean | null;
  criterio_autonomia: boolean;
  criterio_uso_semanal: boolean;
  criterio_valor_3x_mensalidade: boolean;
  criterio_acao_tomada: boolean;
  criterios_atingidos: number;
}

export interface MfaStatus {
  enabled: boolean;
  enabled_at: string | null;
  recovery_codes_left: number;
}

/** Auditoria V1, rodada 6 (M1): exportação completa em segundo plano. */
export interface TenantExport {
  id: string;
  status: "pending" | "running" | "done" | "failed" | "expired";
  status_label: string;
  size_bytes: number | null;
  error: string | null;
  /** Rodada 7 (M2): tabelas que não puderam ser lidas (a cópia saiu sem elas). */
  missing_tables?: string[];
  /** Rodada 8 (M1): na fila ou montando com o worker parado. */
  queue_delayed?: boolean;
  queue_message?: string | null;
  created_at: string;
  finished_at: string | null;
  expires_at: string | null;
}

export interface TenantExportDownload {
  url: string;
  filename: string;
  expires_in_seconds: number;
}

/** Rodada 9 (M4): catálogo de GET /integrations/webhooks/event-types. */
export interface WebhookEventType {
  event_type: string;
  description: string;
}
