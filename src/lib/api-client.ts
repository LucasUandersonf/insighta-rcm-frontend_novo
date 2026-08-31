import type { ApiErrorBody, TokenResponse } from "./types";
import { reportError } from "./monitoring";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;
const TOKEN_STORAGE_KEY = "insighta_access_token";

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

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Requisições públicas (ex: login) não devem mandar o header Authorization. */
  skipAuth?: boolean;
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
  });

  if (!response.ok) {
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

    // Sessão expirada/inválida: dispara um evento global em vez de deixar
    // CADA tela lidar com 401 na mão. AuthContext escuta esse evento e
    // faz logout + redireciona — sem acoplar este módulo (que não é um
    // componente React) a hooks/navegação.
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
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: { skipAuth?: boolean }) =>
    request<T>(path, { method: "POST", body, skipAuth: options?.skipAuth }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /**
   * multipart/form-data — usado só pelo upload de PDF de contrato
   * (POST /contracts/upload). Fora de `request()` de propósito: FormData
   * NUNCA pode levar `Content-Type: application/json` (o fetch monta o
   * boundary do multipart sozinho a partir do FormData; um Content-Type
   * fixo aqui quebraria o parse no backend).
   */
  async upload<T>(path: string, formData: FormData): Promise<T> {
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
