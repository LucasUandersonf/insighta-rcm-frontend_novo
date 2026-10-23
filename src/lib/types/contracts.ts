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
export type AppealStatus =
  | "aberto"
  | "protocolado"
  | "deferido"
  | "indeferido"
  | "nip_aberta";

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

// Homologação fácil (app/services/contract_assist.py): itens vindos da
// planilha da tabela ou do histórico de pagamentos do convênio.
export interface AssistedContractItem {
  tuss_code: string;
  procedure_name: string | null;
  agreed_price: number;
  warning: string | null;
  source: "pago" | "cobrado" | null;
  count: number | null;
}

export interface PriceTableParse {
  items: AssistedContractItem[];
  warnings: string[];
  rejected: number;
}

export interface ContractSuggestion {
  items: AssistedContractItem[];
  billed_codes: number;
  without_price: number;
}
