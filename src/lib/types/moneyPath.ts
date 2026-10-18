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
  open_gross: number;
  overdue: number;
}

export interface CashForecast {
  today: string;
  week_start: string;
  weeks: CashWeek[];
  expected_net: number;
  expected_denial: number;
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
