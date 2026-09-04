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
}

// Espelha TokenResponse — POST /auth/register nunca tem ambiguidade de
// tenant (a clínica acabou de nascer), então o formato de resposta é
// sempre o "simples" (access_token + token_type), sem os campos de
// seleção de tenant que só existem em LoginResponse.
export interface RegisterResponse {
  access_token: string;
  token_type: string;
}

// --- Login/cadastro com Google (app/schemas/token.py::GoogleCredentialRequest/GoogleAuthResponse) ---
export interface GoogleAuthResponse {
  access_token?: string;
  token_type: string;
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
}

export interface TenantUpdateRequest {
  legal_name?: string;
  trade_name?: string;
  annual_revenue_goal?: number;
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
}

// Ranking de perda financeira por convênio (GET /analytics/plan-loss-ranking)
// — as mesmas 3 fontes de perda do ExecutiveSummary, só que quebradas
// por operadora em vez de somadas no tenant inteiro.
export interface PlanLossItem {
  plan_name: string;
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

// Utilização de contrato (GET /analytics/contract-utilization) — dos
// procedimentos negociados num contrato, quantos foram de fato
// faturados no período. idle_catalog_value é o valor de TABELA dos
// itens parados, não uma estimativa de receita perdida (ver DECISÃO em
// AnalyticsRepository.contract_utilization no backend).
export interface ContractUtilizationItem {
  contract_id: string;
  plan_name: string;
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
export interface DenialRiskDistributionItem {
  level: "low" | "medium" | "high";
  count: number;
}

export interface DenialRiskDistribution {
  period_start: string;
  period_end: string;
  items: DenialRiskDistributionItem[];
  total_reviewed: number;
}

export type InsightSeverity = "critical" | "warning" | "positive";

export interface SmartInsight {
  severity: InsightSeverity;
  title: string;
  message: string;
  financial_impact: number | null;
}

export interface SmartInsights {
  period_start: string;
  period_end: string;
  insights: SmartInsight[];
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
}

export interface BillingSettleRequest {
  received_value: number;
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
export interface Patient {
  id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  acquisition_source: string | null;
  created_at: string;
}

export interface PatientCreateRequest {
  full_name: string;
  cpf?: string | null;
  birth_date?: string | null;
}

// --- Profissionais (app/schemas/professional.py) ---
export interface AvailabilityBlock {
  weekday: number; // 0=domingo .. 6=sábado
  start_time: string; // "HH:MM:SS"
  end_time: string;
}

export interface Professional {
  id: string;
  full_name: string;
  professional_registry: string | null;
  specialty: string | null;
  is_active: boolean;
  availability: AvailabilityBlock[];
}

export interface ProfessionalCreateRequest {
  full_name: string;
  professional_registry?: string | null;
  specialty?: string | null;
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
}

export interface AppointmentCreateRequest {
  patient_id: string;
  professional_id?: string | null;
  scheduled_at: string; // ISO 8601
  duration_minutes?: number | null;
  procedure_code?: string | null;
  cid_code?: string | null;
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
  created_at: string;
}

export interface InsuranceCompanyCreateRequest {
  name: string;
  ans_registry?: string | null;
  default_appeal_deadline_days?: number | null;
}

export interface InsuranceCompanyUpdateRequest {
  default_appeal_deadline_days?: number | null;
}

// --- Planos (app/schemas/insurance_plan.py) ---
export interface InsurancePlan {
  id: string;
  insurance_company_id: string | null;
  display_name: string;
  normalized_key: string;
  ans_registry: string | null;
  created_at: string;
}

export interface InsurancePlanCreateRequest {
  insurance_company_id: string;
  display_name: string;
  ans_registry?: string | null;
}

// --- Contratos & Itens (app/schemas/contract.py) ---
export type ContractStatus = "rascunho" | "em_revisao" | "homologado";

export interface ContractItem {
  id: string;
  tuss_code: string;
  procedure_name: string | null;
  agreed_price: number;
}

export interface ContractItemInput {
  tuss_code: string;
  procedure_name?: string | null;
  agreed_price: number;
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
}

export interface ExtractionPreview {
  contract_id: string;
  status: ContractStatus;
  items: ExtractedItem[];
  warnings: string[];
}

export interface HomologateRequest {
  items: ContractItemInput[];
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
