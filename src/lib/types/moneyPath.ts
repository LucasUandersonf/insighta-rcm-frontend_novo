// Caminho do dinheiro (app/schemas/money_path.py): Conferência antes do
// envio, Caixa 13 semanas e Central de Recuperação.

export interface PreSubmissionItem {
  billing_id: string;
  service_date: string | null;
  patient: string | null;
  procedure: string | null;
  value: number;
}

export interface PreSubmissionIssue {
  code: string;
  label: string;
  what_to_do: string;
  blocking: boolean;
  kind: "perda" | "ganho";
  count: number;
  value: number;
  items: PreSubmissionItem[];
}

export interface PreSubmissionGroup {
  key: string;
  plan_id: string;
  plan_name: string;
  lote_label: string;
  lote_kind: "lote" | "erp" | "sem";
  verdict: "pronto" | "revisar";
  items: number;
  total_value: number;
  blocking_items: number;
  blocking_value: number;
  gain_value: number;
  expected_denial: number | null;
  denial_rate: number | null;
  oldest_service_date: string | null;
  issues: PreSubmissionIssue[];
}

export interface PreSubmissionOverview {
  groups: PreSubmissionGroup[];
  total_items: number;
  total_value: number;
  blocking_value: number;
  gain_value: number;
  ready_groups: number;
  review_groups: number;
  truncated: boolean;
}

export interface CashWeek {
  start: string;
  end: string;
  gross: number;
  net: number;
  count: number;
  top_plans: [string, number][];
}

export interface CashPlan {
  plan_name: string;
  lag_days: number;
  lag_source: "historico" | "clinica" | "padrao";
  denial_rate: number;
  /** Retenção na fonte confirmada do convênio (fração), 0 sem confirmação. */
  withholding_rate?: number;
  open_gross: number;
  overdue: number;
}

export interface CashForecast {
  today: string;
  week_start: string;
  weeks: CashWeek[];
  expected_net: number;
  expected_denial: number;
  /** Retenção na fonte descontada do esperado (só convênios confirmados). */
  expected_withholding?: number;
  overdue_submitted: number;
  overdue_unsent: number;
  later: number;
  open_gross: number;
  history: { start: string; received: number }[];
  plans: CashPlan[];
}

export interface RecoveryItem {
  billing_id: string;
  plan_name: string;
  patient: string | null;
  service_date: string | null;
  value: number;
  reason: string | null;
  deadline: string | null;
  days_left: number | null;
  appeal_id: string | null;
  status: string | null;
  denied_at: string | null;
  charged_at?: string | null;
}

export type RecoveryAction = "abrir_recurso" | "ver_recurso" | "cobrar_convenio" | "cobrar_paciente";

export interface RecoveryFront {
  code: string;
  label: string;
  what_to_do: string;
  action: RecoveryAction;
  count: number;
  value: number;
  items: RecoveryItem[];
}

export interface RecoveryCenter {
  recoverable: number;
  in_appeal: number;
  due_7_days: number;
  fronts: RecoveryFront[];
  results: {
    days: number;
    recovered: number;
    recovered_count: number;
    denied: number;
    denied_count: number;
    lost_deadline: number;
    lost_deadline_count: number;
    success_rate: number | null;
  };
}

export interface WithholdingRates {
  irrf: number;
  pis: number;
  cofins: number;
  csll: number;
  iss: number;
}

export interface PlanWithholding {
  plan_id: string;
  plan_name: string;
  billed_90d: number;
  confirmed: WithholdingRates | null;
  confirmed_at: string | null;
  total_pct: number | null;
  /** Quanto o convênio de fato reteve nas contas pagas (%), quando há histórico. */
  observed_pct: number | null;
  observed_count: number;
  suggested: WithholdingRates;
  suggestion_source: "historico" | "padrao";
}

export interface WithholdingOverview {
  plans: PlanWithholding[];
  legal_default: WithholdingRates;
}

export interface BillingBridge {
  date_from: string;
  date_to: string;
  billed: number;
  denied: number;
  open: number;
  withholding: number;
  received: number;
  unexplained: number;
  confirmed_plans: number;
  plans_with_billing: number;
}

// --- Simulador de convênio ---------------------------------------------
export interface SimulatorPlan {
  plan_id: string;
  plan_name: string;
  billed_12m: number;
  accounts_12m: number;
}

export interface SimulatorProcedure {
  tuss_code: string;
  procedure_name: string | null;
  volume: number;
  your_price: number | null;
  your_median_paid: number | null;
  network_contract_median: number | null;
  network_paid_median: number | null;
  network_cohort: number | null;
  paid_gap_per_unit: number | null;
}

export type SimulatorVerdict =
  | "prejuizo"
  | "abaixo_da_clinica"
  | "abaixo_da_clinica_e_rede"
  | "abaixo_da_rede"
  | "saudavel";

export interface PayerSimulation {
  plan_id: string;
  plan_name: string;
  date_from: string;
  date_to: string;
  accounts: number;
  billed: number;
  received: number;
  denial_rate: number | null;
  lag_days: number | null;
  withholding_pct: number | null;
  direct_cost: number;
  contribution: number;
  hours: number | null;
  contribution_per_hour: number | null;
  clinic_contribution_per_hour: number | null;
  readjust_pct: number;
  readjust_gain: number;
  leave_contribution_lost: number;
  leave_breakeven_share: number | null;
  network_gap: number | null;
  verdict: SimulatorVerdict;
  procedures: SimulatorProcedure[];
}

// --- Diagnóstico de variação -------------------------------------------
export interface VarianceMover {
  name: string;
  before: number;
  after: number;
  delta: number;
}

export interface VarianceDiagnosis {
  date_from: string;
  date_to: string;
  prev_from: string;
  prev_to: string;
  billed_before: number;
  billed_after: number;
  delta: number;
  delta_pct: number | null;
  accounts_before: number;
  accounts_after: number;
  volume_effect: number;
  mix_effect: number;
  price_effect: number;
  no_shows_before: number;
  no_shows_after: number;
  no_show_cost: number;
  denied_before: number;
  denied_after: number;
  received_before: number;
  received_after: number;
  headline: string | null;
  plan_movers: VarianceMover[];
  professional_movers: VarianceMover[];
}

// --- Placar de acerto ----------------------------------------------------
export interface EventScore {
  ready: boolean;
  /** Alguma previsão marcou risco; sem isso, a taxa não mede acerto. */
  scored?: boolean;
  events: number;
  flagged: number;
  hit_rate: number | null;
  high_rate: number | null;
  low_rate: number | null;
}

export interface Scoreboard {
  window_days: number;
  min_events: number;
  no_show: EventScore;
  denial: EventScore;
  cash_weeks: { week_start: string; predicted: number; actual: number }[];
  cash_accuracy: number | null;
}

// --- Ações para aprovar ------------------------------------------------
export interface RiskySlot {
  appointment_id: string;
  at: string;
  patient: string;
  professional: string | null;
  procedure: string | null;
  candidates: { waitlist_id: string; patient: string; waiting_since: string }[];
}

export interface ApprovalPlan {
  day: string;
  slots: RiskySlot[];
  appeals: { billing_id: string; plan_name: string; patient: string | null; value: number; reason: string | null; deadline: string; days_left: number }[];
  appeals_value: number;
  confirm_demand_id: string | null;
}
