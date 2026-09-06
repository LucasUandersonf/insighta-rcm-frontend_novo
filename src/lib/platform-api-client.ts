/**
 * src/lib/platform-api-client.ts
 *
 * Cliente HTTP SEPARADO do resto do app (api-client.ts) de propósito —
 * o painel interno de Customer Success (/plataforma) não é uma tela de
 * clínica: não tem tenant, não tem usuário, só a senha única da equipe
 * Insighta (ver DECISÃO completa em app/api/platform_admin_auth.py no
 * backend). Reaproveitar o AuthContext/apiClient normal misturaria dois
 * conceitos de sessão que precisam poder expirar, ser revogados e ser
 * limpos de forma totalmente independente um do outro.
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

async function platformRequest<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
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
      errorBody = { error_code: "erro_desconhecido", message: "Não foi possível se conectar ao servidor.", request_id: "-" };
    }
    throw new ApiError(response.status, errorBody);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const platformApiClient = {
  login: (password: string) => platformRequest<{ access_token: string; token_type: string }>("/api/v1/platform/login", { method: "POST", body: { password } }),
  getTenantsUsage: () => platformRequest<import("./types").TenantUsageSummary[]>("/api/v1/platform/tenants-usage", { auth: true }),
};
