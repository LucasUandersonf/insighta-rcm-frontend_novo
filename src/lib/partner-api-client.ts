/**
 * src/lib/partner-api-client.ts — Insighta Partner (v1.1).
 *
 * O escritório parceiro (contador, consultoria) tem login próprio, com
 * token próprio (escopo "partner", sem clínica), como o painel interno em
 * platform-api-client.ts. "Abrir a clínica" troca esse token por um token
 * normal da clínica (30 min, sem refresh), guardado no mesmo lugar do login
 * de clínica: todo o resto do app funciona sem saber que é um parceiro. O
 * token do parceiro continua guardado para voltar à carteira ou trocar de
 * clínica sem entrar de novo.
 */
import { API_BASE_URL, ApiError, clearStoredRefreshToken, clearStoredToken, storeToken } from "./api-client";
import type { ApiErrorBody } from "./types";

const PARTNER_TOKEN_KEY = "insighta_partner_token";
const PARTNER_CLINIC_KEY = "insighta_partner_clinic";

export interface PartnerClinicSession {
  tenant_id: string;
  trade_name: string;
  role: string;
  partner_name: string;
  expires_at: number;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getStoredPartnerToken(): string | null {
  return read(PARTNER_TOKEN_KEY);
}

export function storePartnerToken(token: string): void {
  localStorage.setItem(PARTNER_TOKEN_KEY, token);
}

export function clearPartnerSession(): void {
  localStorage.removeItem(PARTNER_TOKEN_KEY);
  localStorage.removeItem(PARTNER_CLINIC_KEY);
}

/** Clínica aberta pelo parceiro nesta aba (ou null fora do modo parceiro). */
export function getPartnerClinic(): PartnerClinicSession | null {
  const raw = read(PARTNER_CLINIC_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PartnerClinicSession;
  } catch {
    return null;
  }
}

/** Entra na clínica: o token da clínica vira a sessão do app. */
export function enterClinic(session: PartnerSessionResponse, partnerName: string): void {
  clearStoredRefreshToken();
  storeToken(session.access_token);
  const clinic: PartnerClinicSession = {
    tenant_id: session.tenant_id,
    trade_name: session.trade_name,
    role: session.role,
    partner_name: partnerName,
    expires_at: Date.now() + session.expires_in * 1000,
  };
  localStorage.setItem(PARTNER_CLINIC_KEY, JSON.stringify(clinic));
  window.location.assign("/");
}

/** Sai da clínica e volta para a carteira (o login do parceiro continua). */
export function leaveClinic(): void {
  clearStoredToken();
  localStorage.removeItem(PARTNER_CLINIC_KEY);
  window.location.assign("/parceiro");
}

async function partnerRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.auth) {
    const token = getStoredPartnerToken();
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
      errorBody = { error_code: "erro_desconhecido", message: "Não foi possível se conectar ao servidor.", request_id: "-" };
    }
    throw new ApiError(response.status, errorBody);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface PartnerLoginResponse {
  access_token: string | null;
  mfa_required: boolean;
  mfa_setup_required: boolean;
  mfa_token: string | null;
  otpauth_uri: string | null;
  mfa_secret: string | null;
  must_change_password: boolean;
}

export interface PartnerMe {
  user_id: string;
  email: string;
  full_name: string;
  role: "partner_admin" | "analyst";
  partner_id: string;
  partner_name: string;
  must_change_password: boolean;
}

export interface PortfolioClinic {
  tenant_id: string;
  trade_name: string;
  acting_role: string;
  granted_at: string;
  last_session_at: string | null;
  snapshot_date: string | null;
  billed_30d: number | null;
  recovered_month: number | null;
  recovered_cumulative: number | null;
  recoverable: number | null;
  due_7_days: number | null;
  open_demands: number | null;
  stalled_demands: number | null;
  stale_level: number | null;
  oldest_load_days: number | null;
  health_score: number | null;
  attention: string[];
}

export interface Portfolio {
  partner_name: string;
  clinics: PortfolioClinic[];
  total_recoverable: number;
  total_recovered_month: number;
  clinics_needing_attention: number;
}

export interface PartnerSessionResponse {
  access_token: string;
  expires_in: number;
  tenant_id: string;
  trade_name: string;
  role: string;
}

export interface Commission {
  month: string;
  commission_pct: number;
  lines: { tenant_id: string; trade_name: string; subscription_paid: number; commission: number }[];
  total_paid: number;
  total_commission: number;
}

export const partnerApiClient = {
  login: (email: string, password: string) =>
    partnerRequest<PartnerLoginResponse>("/api/v1/partner/login", { method: "POST", body: { email, password } }),
  loginMfa: (mfaToken: string, code: string) =>
    partnerRequest<PartnerLoginResponse>("/api/v1/partner/login/mfa", { method: "POST", body: { mfa_token: mfaToken, code } }),
  changePassword: (currentPassword: string, newPassword: string) =>
    partnerRequest<PartnerLoginResponse>("/api/v1/partner/me/change-password", {
      method: "POST",
      auth: true,
      body: { current_password: currentPassword, new_password: newPassword },
    }),
  me: () => partnerRequest<PartnerMe>("/api/v1/partner/me", { auth: true }),
  portfolio: () => partnerRequest<Portfolio>("/api/v1/partner/portfolio", { auth: true }),
  openClinic: (tenantId: string) =>
    partnerRequest<PartnerSessionResponse>(`/api/v1/partner/clinics/${tenantId}/session`, { method: "POST", auth: true }),
  commission: (month?: string) =>
    partnerRequest<Commission>(`/api/v1/partner/commission${month ? `?month=${month}` : ""}`, { auth: true }),
  logout: () => partnerRequest<void>("/api/v1/partner/logout", { method: "POST", auth: true }),
};
