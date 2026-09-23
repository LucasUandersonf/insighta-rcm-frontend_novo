import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

/**
 * Equipe (Redesign 2026 — canvas "Atribuir", "Equipe" e "Coordenador"):
 * o gestor enxerga e atribui, o coordenador do setor resolve. Espelha
 * app/schemas/team.py do backend.
 *
 * Perfil ≠ papel: o papel (owner/admin/financeiro/atendimento/auditor)
 * continua controlando o acesso a dados; o perfil da equipe decide a
 * experiência — gestor (owner/admin), gestor somente leitura (auditor)
 * e coordenador (quem está em core.team_sectors).
 */
export type TeamSector = "agendamento" | "faturamento" | "estoque" | "assistencial" | "gestao";
export type TeamProfile = "gestor" | "gestor_leitura" | "coordenador" | "sem_setor";
export type ReturnReason = "outro_setor" | "mais_prazo" | "falta_informacao" | "outro";

export interface PersonRef {
  id: string;
  full_name: string;
}

export interface SectorInfo {
  sector: TeamSector;
  label: string;
  coordinator: PersonRef | null;
  is_mine: boolean;
}

export interface TeamMe {
  profile: TeamProfile;
  sectors: SectorInfo[];
}

export interface Demand {
  id: string;
  title: string;
  message: string;
  category: string;
  severity: string;
  financial_impact: number | null;
  sector: TeamSector | null;
  sector_label: string | null;
  status: "pendente" | "em_andamento" | "resolvido" | "devolvido" | "ignorado";
  status_label: string;
  is_overdue: boolean;
  coordinator: PersonRef | null;
  assigned_by: PersonRef | null;
  manager_note: string | null;
  due_date: string | null;
  created_at: string;
  started_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  returned_reason: ReturnReason | null;
  returned_reason_label: string | null;
  returned_note: string | null;
  returned_at: string | null;
  last_update_note: string | null;
  last_update_at: string | null;
  nudged_at: string | null;
  confirmation: "aguardando" | "confirmado" | "voltou" | null;
}

export interface DemandCreate {
  source: "insight" | "raiox";
  category: string;
  severity: string;
  title: string;
  message: string;
  financial_impact: number | null;
  rule_id?: string | null;
  fact_key?: string | null;
  sector: TeamSector;
  due_date: string | null;
  manager_note: string | null;
}

export interface CoordinatorScore {
  coordinator: PersonRef;
  sectors: string[];
  open_count: number;
  overdue_count: number;
  resolved_count: number;
  on_time_pct: number | null;
  confirmed_count: number;
  evaluated_count: number;
  avg_days_to_resolve: number | null;
  recovered_value: number;
}

export interface TeamUpdate {
  demand_id: string;
  kind: "resolvido" | "devolvido" | "confirmado" | "voltou";
  text: string;
  at: string;
}

export interface TeamOverview {
  open_count: number;
  overdue_count: number;
  resolved_month: number;
  returned_count: number;
  recovered_month: number;
  open_by_sector: Record<string, number>;
  scoreboard: CoordinatorScore[];
  updates: TeamUpdate[];
}

export interface RadarItem {
  title: string;
  message: string;
  severity: string;
  financial_impact: number | null;
}

export interface CoordinatorSummary {
  profile: TeamProfile;
  sectors: SectorInfo[];
  open_count: number;
  due_today_count: number;
  in_progress_count: number;
  awaiting_confirmation_count: number;
  score: CoordinatorScore | null;
  radar: RadarItem[];
}

/** Área do insight -> setor dono (mesma tabela de CATEGORY_TO_SECTOR no backend). */
export const CATEGORY_TO_SECTOR: Record<string, TeamSector> = {
  agenda: "agendamento",
  faturamento: "faturamento",
  estoque: "estoque",
  prontuario: "assistencial",
  estrategia: "gestao",
};

export const CATEGORY_LABELS: Record<string, string> = {
  agenda: "Agenda",
  faturamento: "Faturamento",
  estoque: "Estoque",
  prontuario: "Prontuário",
  estrategia: "Estratégia",
};

/** Setores que recebem demanda. "Gestão" fica com o próprio gestor. */
export const ASSIGNABLE_SECTORS: TeamSector[] = ["agendamento", "faturamento", "estoque", "assistencial"];

export const RETURN_REASONS: { id: ReturnReason; label: string }[] = [
  { id: "outro_setor", label: "Não é do meu setor" },
  { id: "mais_prazo", label: "Preciso de mais prazo" },
  { id: "falta_informacao", label: "Falta informação" },
  { id: "outro", label: "Outro motivo" },
];

const MANAGER_ROLES = new Set(["owner", "admin"]);

/** Perfil da equipe. owner/admin/auditor saem direto do papel (sem esperar
 * a rede); financeiro/atendimento dependem de coordenar um setor. */
export function useTeamProfile(): { profile: TeamProfile | undefined; sectors: SectorInfo[]; isLoading: boolean } {
  const { user } = useAuth();
  const fromRole: TeamProfile | undefined = !user
    ? undefined
    : MANAGER_ROLES.has(user.role)
      ? "gestor"
      : user.role === "auditor"
        ? "gestor_leitura"
        : undefined;
  const { data, isLoading } = useQuery({
    queryKey: ["team", "me"],
    queryFn: () => apiClient.get<TeamMe>("/api/v1/team/me"),
    enabled: !!user,
    staleTime: 60 * 1000,
    retry: false,
  });
  const profile = fromRole ?? data?.profile ?? (isLoading ? undefined : "sem_setor");
  return { profile, sectors: data?.sectors ?? [], isLoading: !fromRole && isLoading };
}

export function isManagerProfile(profile: TeamProfile | undefined): boolean {
  return profile === "gestor" || profile === "gestor_leitura";
}

export function useTeamSectors(enabled = true) {
  return useQuery({
    queryKey: ["team", "sectors"],
    queryFn: () => apiClient.get<SectorInfo[]>("/api/v1/team/sectors"),
    enabled,
  });
}

export function useTeamOverview(enabled = true) {
  return useQuery({
    queryKey: ["team", "overview"],
    queryFn: () => apiClient.get<TeamOverview>("/api/v1/team/overview"),
    enabled,
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  });
}

export function useDemands(enabled = true) {
  return useQuery({
    queryKey: ["team", "demands"],
    queryFn: () => apiClient.get<Demand[]>("/api/v1/team/demands"),
    enabled,
  });
}

export function useCoordinatorSummary(enabled = true) {
  return useQuery({
    queryKey: ["team", "my-summary"],
    queryFn: () => apiClient.get<CoordinatorSummary>("/api/v1/team/my-summary"),
    enabled,
  });
}

type DemandAction =
  | { kind: "start"; id: string }
  | { kind: "update"; id: string; note: string }
  | { kind: "resolve"; id: string; note: string }
  | { kind: "return"; id: string; reason: ReturnReason; note: string }
  | { kind: "reassign"; id: string; sector?: TeamSector; due_date?: string | null; manager_note?: string | null }
  | { kind: "close"; id: string }
  | { kind: "nudge"; id: string };

/** Todas as ações sobre uma demanda passam por aqui — e todas invalidam o
 * mesmo prefixo ["team"], então Home, Equipe e placar andam juntos. */
export function useDemandAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: DemandAction) => {
      const base = `/api/v1/team/demands/${action.id}`;
      switch (action.kind) {
        case "start":
          return apiClient.post<Demand>(`${base}/start`);
        case "update":
          return apiClient.post<Demand>(`${base}/update`, { note: action.note });
        case "resolve":
          return apiClient.post<Demand>(`${base}/resolve`, { note: action.note });
        case "return":
          return apiClient.post<Demand>(`${base}/return`, { reason: action.reason, note: action.note });
        case "reassign":
          return apiClient.post<Demand>(`${base}/reassign`, {
            sector: action.sector,
            due_date: action.due_date,
            manager_note: action.manager_note,
          });
        case "close":
          return apiClient.post<Demand>(`${base}/close`);
        case "nudge":
          return apiClient.post<Demand>(`${base}/nudge`);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });
}

export function useAcknowledgeUpdates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<{ acknowledged: number }>("/api/v1/team/updates/ack"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });
}

// ---------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------
const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function ddmm(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "Hoje", "Amanhã", "Ontem (22/09)", "Sexta (26/09)". */
export function dueLabel(value: string | null, now = new Date()): string {
  if (!value) return "Sem prazo";
  const due = parseIsoDate(value);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return `Ontem (${ddmm(due)})`;
  const weekday = WEEKDAYS[due.getDay()]!;
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} (${ddmm(due)})`;
}

/** Chips de prazo do canvas: Hoje · Amanhã · próxima sexta · Escolher data. */
export function deadlineOptions(now = new Date()): { label: string; value: string | null }[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const friday = new Date(today);
  friday.setDate(today.getDate() + (((5 - today.getDay() + 7) % 7) || 7));
  if (friday.getTime() <= tomorrow.getTime()) friday.setDate(friday.getDate() + 7);
  return [
    { label: "Hoje", value: isoDate(today) },
    { label: "Amanhã", value: isoDate(tomorrow) },
    { label: `Sexta (${ddmm(friday)})`, value: isoDate(friday) },
    { label: "Escolher data", value: null },
  ];
}

export function relativeFromNow(value: string, now = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

export function shortDate(value: string): string {
  return ddmm(new Date(value));
}

export function brlWhole(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
