import type {
  ApiErrorBody,
  GoogleAuthResponse,
  PublicSatisfactionStatusResponse,
  RegisterRequest,
  RegisterResponse,
  TokenResponse,
} from "./types";
import { reportError } from "./monitoring";

// Exportado para src/lib/platform-api-client.ts reaproveitar a mesma
// URL base sem duplicar a leitura de import.meta.env.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;
const TOKEN_STORAGE_KEY = "insighta_access_token";
// Achado MÉDIO da Auditoria de Prontidão v1 — ver DECISÃO em
// app/sql/059_refresh_tokens.sql (backend).
const REFRESH_TOKEN_STORAGE_KEY = "insighta_refresh_token";

// DECISÃO — nunca "throw" na carga do módulo por configuração ausente
// -------------------------------------------------------------------------
// Uma exceção lançada aqui (nível de módulo) acontece ANTES do React
// conseguir montar qualquer coisa — o resultado visual é uma tela em
// branco/cor de fundo, sem nenhuma mensagem, exatamente o que aconteceu
// em produção (VITE_API_BASE_URL não estava configurada no Railway).
// Em vez disso, exportamos um booleano que App.tsx verifica e usa para
// mostrar uma tela de erro REAL, legível, com o nome exato da variável
// que falta — nunca mais uma tela preta muda.
export const isApiConfigured = Boolean(API_BASE_URL);

/** Refresh token em cookie httpOnly (backend REFRESH_TOKEN_COOKIE_ENABLED).
 * Ligar só com domínio próprio: app e API no mesmo site. Nesse modo o
 * refresh token nunca passa pelo JavaScript nem pelo localStorage. */
export const REFRESH_COOKIE_MODE = import.meta.env.VITE_REFRESH_TOKEN_COOKIE === "true";

/**
 * Erro tipado que carrega o envelope de erro do backend
 * ({error_code, message, request_id, ...}) — permite à UI mostrar
 * `message` (já em português, amigável) e, se precisar, tomar decisão
 * por `error_code` sem depender de parsear string.
 */
export class ApiError extends Error {
  errorCode: string;
  requestId: string;
  status: number;
  campos?: { campo: string; problema: string }[];

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.errorCode = body.error_code;
    this.requestId = body.request_id;
    this.campos = body.campos;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
}

export function storeRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
}

export function clearStoredRefreshToken(): void {
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

interface RefreshTokenApiResponse {
  access_token: string;
  refresh_token?: string;
}

// Dedup: se várias chamadas em paralelo tomam 401 ao mesmo tempo (ex:
// a Home dispara 2-3 queries simultâneas), só uma tentativa real de
// refresh acontece — as outras esperam a MESMA promise, em vez de cada
// uma rotacionar o token e invalidar a rotação das outras.
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Tenta renovar a sessão silenciosamente usando o refresh token
 * guardado — ver DECISÃO completa em app/sql/059_refresh_tokens.sql
 * (backend) e POST /auth/refresh. Nunca lança: retorna false em
 * qualquer falha (sem refresh token guardado, token expirado/revogado,
 * rede fora do ar), deixando quem chamou decidir o que fazer (aqui,
 * `request()` cai no fluxo antigo de "auth:unauthorized").
 */
async function attemptSilentRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getStoredRefreshToken();
    if ((!refreshToken && !REFRESH_COOKIE_MODE) || !API_BASE_URL) return false;
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(REFRESH_COOKIE_MODE ? {} : { refresh_token: refreshToken }),
        credentials: REFRESH_COOKIE_MODE ? "include" : "same-origin",
      });
      if (!response.ok) return false;
      const body: RefreshTokenApiResponse = await response.json();
      storeToken(body.access_token);
      if (body.refresh_token) storeRefreshToken(body.refresh_token);
      return true;
    } catch {
      return false;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Requisições públicas (ex: login) não devem mandar o header Authorization. */
  skipAuth?: boolean;
  /** Uso interno — marca que esta chamada já é uma RETENTATIVA pós-refresh,
   * pra nunca entrar num loop (refresh -> 401 de novo -> refresh -> ...). */
  _isRetryAfterRefresh?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    // Não deveria ser alcançável na prática (App.tsx bloqueia a
    // renderização das rotas quando isApiConfigured é false), mas é uma
    // rede de segurança de tipos — melhor um erro claro aqui do que
    // `fetch("undefined/api/v1/...")` silencioso.
    throw new ApiError(0, {
      error_code: "configuracao_ausente",
      message: "VITE_API_BASE_URL não configurada neste ambiente.",
      request_id: "-",
    });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (!options.skipAuth) {
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    // Modo cookie: login/cadastro/Google/MFA recebem o cookie do refresh token.
    ...(REFRESH_COOKIE_MODE && path.startsWith("/api/v1/auth") ? { credentials: "include" as const } : {}),
  });

  if (!response.ok) {
    // Achado MÉDIO da Auditoria de Prontidão v1 — antes de desistir e
    // derrubar a sessão, tenta renovar silenciosamente com o refresh
    // token guardado (ver DECISÃO em attemptSilentRefresh). Só UMA
    // retentativa (via _isRetryAfterRefresh) — nunca um loop.
    if (response.status === 401 && !options.skipAuth && !options._isRetryAfterRefresh) {
      const refreshed = await attemptSilentRefresh();
      if (refreshed) {
        return request<T>(path, { ...options, _isRetryAfterRefresh: true });
      }
    }

    let errorBody: ApiErrorBody;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = {
        error_code: "erro_desconhecido",
        message: "Não foi possível se conectar ao servidor. Tente novamente em instantes.",
        request_id: "-",
      };
    }

    // Sessão expirada/inválida (e o refresh acima não resolveu, ou nem
    // se aplicava): dispara um evento global em vez de deixar CADA tela
    // lidar com 401 na mão. AuthContext escuta esse evento e faz logout
    // + redireciona — sem acoplar este módulo (que não é um componente
    // React) a hooks/navegação.
    if (response.status === 401 && !options.skipAuth) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }

    // Só 5xx (falha real do backend) vai para o Sentry — 4xx é
    // validação normal do usuário (dado inválido, permissão, etc.) e
    // inundaria o monitoramento com eventos não-acionáveis.
    if (response.status >= 500) {
      reportError(new ApiError(response.status, errorBody), { path, method: options.method ?? "GET" });
    }

    throw new ApiError(response.status, errorBody);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string, options?: { skipAuth?: boolean }) => request<T>(path, { method: "GET", skipAuth: options?.skipAuth }),
  post: <T>(path: string, body?: unknown, options?: { skipAuth?: boolean }) =>
    request<T>(path, { method: "POST", body, skipAuth: options?.skipAuth }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /**
   * GET que devolve um arquivo binário (hoje só o PDF do recurso de
   * glosa, GET /denial-appeals/{id}/document) em vez de JSON — fora de
   * `request()` de propósito: `response.json()` quebraria num corpo que
   * não é JSON. Devolve o Blob pronto para `URL.createObjectURL`.
   */
  async getBlob(path: string, _isRetryAfterRefresh = false): Promise<Blob> {
    if (!API_BASE_URL) {
      throw new ApiError(0, {
        error_code: "configuracao_ausente",
        message: "VITE_API_BASE_URL não configurada neste ambiente.",
        request_id: "-",
      });
    }
    const headers: Record<string, string> = {};
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}${path}`, { method: "GET", headers });

    if (!response.ok) {
      if (response.status === 401 && !_isRetryAfterRefresh && (await attemptSilentRefresh())) {
        return apiClient.getBlob(path, true);
      }
      let errorBody: ApiErrorBody;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = {
          error_code: "erro_desconhecido",
          message: "Não foi possível se conectar ao servidor. Tente novamente em instantes.",
          request_id: "-",
        };
      }
      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      }
      if (response.status >= 500) {
        reportError(new ApiError(response.status, errorBody), { path, method: "GET (blob)" });
      }
      throw new ApiError(response.status, errorBody);
    }
    return response.blob();
  },
  /**
   * multipart/form-data — usado só pelo upload de PDF de contrato
   * (POST /contracts/upload). Fora de `request()` de propósito: FormData
   * NUNCA pode levar `Content-Type: application/json` (o fetch monta o
   * boundary do multipart sozinho a partir do FormData; um Content-Type
   * fixo aqui quebraria o parse no backend).
   */
  async upload<T>(path: string, formData: FormData, _isRetryAfterRefresh = false): Promise<T> {
    if (!API_BASE_URL) {
      throw new ApiError(0, {
        error_code: "configuracao_ausente",
        message: "VITE_API_BASE_URL não configurada neste ambiente.",
        request_id: "-",
      });
    }
    const headers: Record<string, string> = {};
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 401 && !_isRetryAfterRefresh && (await attemptSilentRefresh())) {
        return apiClient.upload<T>(path, formData, true);
      }
      let errorBody: ApiErrorBody;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = {
          error_code: "erro_desconhecido",
          message: "Não foi possível se conectar ao servidor. Tente novamente em instantes.",
          request_id: "-",
        };
      }
      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      }
      if (response.status >= 500) {
        reportError(new ApiError(response.status, errorBody), { path, method: "POST (upload)" });
      }
      throw new ApiError(response.status, errorBody);
    }
    return response.json() as Promise<T>;
  },
};

// tenantId opcional (achado F-04): só é enviado na segunda chamada,
// depois que o usuário escolhe a clínica numa lista que o próprio
// backend retornou (ver AuthContext.tsx / LoginPage.tsx).
export async function login(email: string, password: string, tenantId?: string): Promise<TokenResponse> {
  return apiClient.post<TokenResponse>(
    "/api/v1/auth/login",
    { email, password, tenant_id: tenantId ?? null },
    { skipAuth: true }
  );
}

/** Cadastro público (self-signup) — ver POST /auth/register no backend. */
export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  return apiClient.post<RegisterResponse>("/api/v1/auth/register", data, { skipAuth: true });
}

/** "Continuar com Google" — `credential` é o ID token entregue pelo
 * Google Identity Services no callback do botão (ver GoogleSignInButton.tsx).
 * `tenantId` só é reenviado depois que o usuário escolhe a clínica numa
 * lista que o próprio backend retornou (mesmo padrão de login/tenant_id). */
export async function googleAuth(credential: string, tenantId?: string): Promise<GoogleAuthResponse> {
  return apiClient.post<GoogleAuthResponse>(
    "/api/v1/auth/google",
    { credential, tenant_id: tenantId ?? null },
    { skipAuth: true }
  );
}

/** Sempre resolve (nunca lança) para uma chamada bem-sucedida — o
 * backend devolve 202 sem corpo, exista ou não o e-mail (anti-
 * enumeração, ver DECISÃO em AuthService.request_password_reset). */
export async function requestPasswordReset(email: string): Promise<void> {
  return apiClient.post<void>("/api/v1/auth/password-reset/request", { email }, { skipAuth: true });
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  return apiClient.post<void>(
    "/api/v1/auth/password-reset/confirm",
    { token, new_password: newPassword },
    { skipAuth: true }
  );
}

/** Achado da Auditoria Estratégica: até aqui, "Sair" só limpava o
 * armazenamento local — o refresh_token continuava válido no backend
 * por até 30 dias, sem forma de revogar. `skipAuth: true` porque isto
 * precisa funcionar mesmo com o access_token já expirado (é
 * frequentemente o caso quando o usuário finalmente clica "Sair"), e o
 * backend não exige Authorization para este endpoint (ver DECISÃO em
 * POST /auth/logout, que espelha /auth/refresh no mesmo critério). */
export async function logoutRequest(refreshToken: string | null): Promise<void> {
  return apiClient.post<void>("/api/v1/auth/logout", refreshToken ? { refresh_token: refreshToken } : {}, { skipAuth: true });
}

/** Segunda etapa do login com MFA: token curto do login + código do app. */
export async function verifyMfaRequest(mfaToken: string, code: string): Promise<TokenResponse> {
  return apiClient.post<TokenResponse>("/api/v1/auth/mfa/verify", { mfa_token: mfaToken, code }, { skipAuth: true });
}

/** "Encerrar todas as sessões" — de um dispositivo em que o usuário
 * AINDA está autenticado, revoga toda sessão deste usuário (incluindo a
 * de um dispositivo perdido/roubado que ele não tem mais em mãos). Ao
 * contrário de logoutRequest acima, exige o access_token válido — por
 * isso sem skipAuth. */
export async function logoutAllSessionsRequest(): Promise<{ revoked_count: number }> {
  return apiClient.post<{ revoked_count: number }>("/api/v1/auth/logout-all-sessions");
}

/** Lado público (sem autenticação) do link de avaliação de satisfação
 * pós-atendimento — ver DECISÃO em 052_appointment_satisfaction.sql
 * (backend). O paciente abre `/satisfacao/:token` sem estar logado. */
export async function getSatisfactionStatus(token: string): Promise<PublicSatisfactionStatusResponse> {
  return apiClient.get<PublicSatisfactionStatusResponse>(`/api/v1/public/satisfaction/${encodeURIComponent(token)}`, {
    skipAuth: true,
  });
}

export async function submitSatisfactionScore(token: string, score: number): Promise<void> {
  return apiClient.post<void>(`/api/v1/public/satisfaction/${encodeURIComponent(token)}`, { score }, { skipAuth: true });
}
