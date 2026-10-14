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
  /** MFA ligado: sem tokens ainda; pedir o código em /auth/mfa/verify. */
  mfa_required?: boolean;
  mfa_token?: string | null;
}

// --- Cadastro público (self-signup) / recuperação de senha
// (app/schemas/token.py::RegisterRequest/PasswordResetRequestRequest/
// PasswordResetConfirmRequest) ---
/** Planos (app/services/plans.py no backend). "founders" = Pro com o preço
 * Founders (só no checkout). Os valores antigos podem aparecer em dado antigo. */
export type PlanTier = "basic" | "pro" | "redes" | "founders" | "starter" | "professional" | "enterprise";
export type PlanKey = "basic" | "pro" | "redes";
export type BillingCycle = "monthly" | "yearly";

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
  mfa_required?: boolean;
  mfa_token?: string | null;
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
  /** Último envio (WhatsApp e/ou e-mail): "ok" ou "falhou" com o motivo. */
  last_delivery_at?: string | null;
  last_delivery_status?: "ok" | "falhou" | null;
  last_delivery_error?: string | null;
  /** Rodada 8 (A2): e-mail de fora da equipe só recebe depois de confirmar. */
  email_confirmed_at?: string | null;
  email_confirmation_sent_at?: string | null;
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
  /** Importação desfeita (POST /ingestion/files/{id}/undo). */
  undone_at?: string | null;
}

/** Prévia (GET .../undo-preview) ou resultado (POST .../undo). */
export interface IngestionUndoResponse {
  ingestion_file_id: string;
  deleted: Record<string, number>;
  restored: number;
  appeals_removed: number;
  message: string;
  /** Registros que mudaram depois da importação: bloqueiam o desfazer. */
  conflicts?: number;
  /** Registros criados pela importação e editados depois: o desfazer apaga. */
  edited_after_import?: number;
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
  /** UX-02: reenvio que tentou de novo as linhas rejeitadas. */
  retried?: boolean;
  message: string | null;
  /** Colunas do arquivo fora do modelo, que não foram importadas. */
  ignored_columns?: string[];
  /** UX-01: convênios cadastrados a partir do arquivo. */
  created_plans?: string[];
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
export type RejectedRowReason =
  | "unknown_insurance_plan"
  | "validation_error"
  | string;

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

export type UserRole =
  | "owner"
  | "admin"
  | "financeiro"
  | "atendimento"
  | "auditor";

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
  /** Verificação em duas etapas ligada (null = desligada). */
  mfa_enabled_at?: string | null;
  /** E-mail confirmado pelo link do cadastro (null = ainda não). */
  email_verified_at?: string | null;
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
  /** UX-09: primeiros valores de cada coluna e avisos por coluna. */
  samples?: Record<string, string[]>;
  warnings?: Record<string, string>;
  /** UX-10: mapeamento já salvo que vale para este arquivo (coluna -> campo). */
  saved_mapping?: Record<string, string>;
  /** UX-21: modelo que o cabeçalho completa, quando não é o escolhido. */
  detected_data_type?: string | null;
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
