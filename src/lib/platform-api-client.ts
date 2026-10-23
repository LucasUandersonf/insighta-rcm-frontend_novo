/**
 * src/lib/platform-api-client.ts
 *
 * Cliente HTTP SEPARADO do resto do app (api-client.ts) de propósito —
 * o painel interno de Customer Success (/plataforma) não é uma tela de
 * clínica: login individual da equipe Insighta (core.platform_users —
 * ver DECISÃO completa em app/sql/029_platform_users.sql e
 * app/api/platform_admin_auth.py no backend), sem tenant nenhum.
 * Reaproveitar o AuthContext/apiClient normal misturaria dois conceitos
 * de sessão que precisam poder expirar, ser revogados e ser limpos de
 * forma totalmente independente um do outro.
 */
import { API_BASE_URL, ApiError } from "./api-client";
import type { ApiErrorBody } from "./types";

const PLATFORM_TOKEN_STORAGE_KEY = "insighta_platform_admin_token";

export function getStoredPlatformToken(): string | null {
  return localStorage.getItem(PLATFORM_TOKEN_STORAGE_KEY);
}

export function storePlatformToken(token: string): void {
  localStorage.setItem(PLATFORM_TOKEN_STORAGE_KEY, token);
}

export function clearStoredPlatformToken(): void {
  localStorage.removeItem(PLATFORM_TOKEN_STORAGE_KEY);
}

async function platformRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.auth) {
    const token = getStoredPlatformToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let errorBody: ApiErrorBody;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = {
        error_code: "erro_desconhecido",
        message: "Não foi possível se conectar ao servidor.",
        request_id: "-",
      };
    }
    throw new ApiError(response.status, errorBody);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface PlatformLoginResponse {
  access_token: string | null;
  token_type: string;
  mfa_required: boolean;
  mfa_setup_required: boolean;
  mfa_token: string | null;
  otpauth_uri: string | null;
  mfa_secret: string | null;
}

export interface PlatformPartner {
  id: string;
  legal_name: string;
  cnpj: string;
  kind: string;
  commission_pct: number;
  is_active: boolean;
  active_clinics: number;
  users: number;
  created_at: string;
}

export interface PlatformPartnerCreate {
  legal_name: string;
  cnpj: string;
  kind: "contabilidade" | "consultoria" | "outro";
  commission_pct: number;
  admin_email: string;
  admin_name: string;
}

export interface RetentionRow {
  tenant_id: string;
  trade_name: string;
  plan_tier: string | null;
  billing_status: string | null;
  tenant_age_days: number;
  snapshot_date: string | null;
  oldest_load_days: number | null;
  stale_level: number | null;
  manager_active_days_7d: number | null;
  stalled_demands: number | null;
  open_demands: number | null;
  roi_multiple: number | null;
  recovered_cumulative: number | null;
  risks: string[];
}

export interface SourceProfile {
  id: string;
  vendor: string;
  report_name: string;
  data_type: string;
  status: "rascunho" | "validado" | "aposentado";
  samples: number;
  columns: number;
  created_at: string;
  validated_at: string | null;
}

export interface SourceProfileCreate {
  vendor: string;
  report_name: string;
  data_type: string;
  headers: string[];
  column_map: Record<string, string>;
  export_steps: string | null;
}

export const platformApiClient = {
  login: (email: string, password: string) =>
    platformRequest<PlatformLoginResponse>("/api/v1/platform/login", {
      method: "POST",
      body: { email, password },
    }),
  // Segundo passo (MFA obrigatório em produção — auditoria V1, rodada 4, A1).
  loginMfa: (mfaToken: string, code: string) =>
    platformRequest<PlatformLoginResponse>("/api/v1/platform/login/mfa", {
      method: "POST",
      body: { mfa_token: mfaToken, code },
    }),
  logout: () =>
    platformRequest<void>("/api/v1/platform/logout", {
      method: "POST",
      auth: true,
    }),
  getTenantsUsage: () =>
    platformRequest<import("./types").TenantUsageSummary[]>(
      "/api/v1/platform/tenants-usage",
      { auth: true },
    ),
  // Pedidos da Central de Ajuda de todas as clínicas (abertos por padrão):
  // funcionam mesmo sem SMTP, que só manda um aviso a mais.
  getSupportRequests: () =>
    platformRequest<import("./types").PlatformSupportRequest[]>("/api/v1/platform/support-requests", { auth: true }),
  markSupportAnswered: (id: string) =>
    platformRequest<void>(`/api/v1/platform/support-requests/${id}/answered`, { method: "POST", auth: true }),
  getPilotMetrics: () =>
    platformRequest<import("./types").PilotMetrics[]>(
      "/api/v1/platform/pilot-metrics",
      { auth: true },
    ),
  // Disparo manual dos alertas proativos (ver POST /platform/alerts/run
  // no backend) — útil para checar agora em vez de esperar o agendador
  // externo (mesmo espírito do botão "Enviar agora" do relatório
  // semanal em ReportRecipientsPage.tsx).
  runAlerts: () =>
    platformRequest<import("./types").PlatformAlertRunResult>(
      "/api/v1/platform/alerts/run",
      { method: "POST", auth: true },
    ),
  // Insighta Partner (v1.1): escritórios parceiros e o primeiro acesso de cada um.
  getPartners: () => platformRequest<PlatformPartner[]>("/api/v1/platform/partners", { auth: true }),
  createPartner: (body: PlatformPartnerCreate) =>
    platformRequest<{ partner_id: string; admin_email: string; temporary_password: string }>("/api/v1/platform/partners", {
      method: "POST",
      auth: true,
      body,
    }),
  // v1.1: painel de retenção e perfis de relatório de origem.
  getRetention: () => platformRequest<RetentionRow[]>("/api/v1/platform/retention", { auth: true }),
  getSourceProfiles: () => platformRequest<SourceProfile[]>("/api/v1/platform/source-profiles", { auth: true }),
  createSourceProfile: (body: SourceProfileCreate) =>
    platformRequest<SourceProfile[]>("/api/v1/platform/source-profiles", { method: "POST", auth: true, body }),
  addSourceProfileSample: (id: string, headers: string[]) =>
    platformRequest<SourceProfile[]>(`/api/v1/platform/source-profiles/${id}/samples`, { method: "POST", auth: true, body: { headers } }),
  validateSourceProfile: (id: string) =>
    platformRequest<SourceProfile[]>(`/api/v1/platform/source-profiles/${id}/validate`, { method: "POST", auth: true }),
  // "Histórico de quem fez o quê" (ver GET /platform/audit-log no backend).
  getAuditLog: () =>
    platformRequest<import("./types").PlatformAuditLogEntry[]>(
      "/api/v1/platform/audit-log",
      { auth: true },
    ),
};
