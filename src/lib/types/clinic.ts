// --- Pacientes (app/schemas/patient.py) ---
export type PreferredTimeWindow = "manha" | "tarde" | "noite";

export interface Patient {
  id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  anonymized_at?: string | null;
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
  // Rodada 5 (A3): correção de cadastro (LGPD art. 18, III).
  full_name?: string;
  cpf?: string | null;
  birth_date?: string | null;
  confirm_returning_patient?: boolean;
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
  // Auditoria V1, rodada 17 (A1): o financeiro vê só o CID.
  cid_principal?: string | null;
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
  // Auditoria V1, rodada 17 (A1): "completo" (dono/admin), "cid" (financeiro) ou "restrito".
  clinical_access?: "completo" | "cid" | "restrito";
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
  /** Rodada 9 (M3): só na resposta do cadastro. */
  appointments_in_period?: number | null;
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
  allow_overlap?: boolean;
  status?: string | null;
  procedure_code?: string | null;
  cid_code?: string | null;
  visit_intent_tag?: VisitIntentTag | null;
  addon_offered_procedure?: string | null;
  addon_declined?: boolean | null;
  is_squeeze_in?: boolean | null;
  /** Remarcar (horário de Brasília, sem fuso) — só atendimento agendado e sem cobrança. */
  scheduled_at?: string | null;
  professional_id?: string | null;
  insurance_plan_id?: string | null;
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
