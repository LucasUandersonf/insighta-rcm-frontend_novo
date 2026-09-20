import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiClient,
  ApiError,
  getStoredToken,
  getStoredRefreshToken,
  storeToken,
  storeRefreshToken,
  clearStoredToken,
  clearStoredRefreshToken,
} from "@/lib/api-client";

// Achado MÉDIO da Auditoria de Prontidão v1 ("sem refresh token") — o
// mecanismo de renovação SILENCIOSA vive dentro de request()/getBlob()/
// upload() em api-client.ts, abaixo da camada que o resto dos testes do
// projeto mocka (`vi.mock("@/lib/api-client")`). Por isso este arquivo,
// sozinho, mocka `global.fetch` diretamente — é o único jeito de
// exercitar o fluxo real de "401 -> tenta refresh -> repete a chamada
// original" sem reimplementar a lógica no teste.
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("api-client — renovação silenciosa de sessão (refresh token)", () => {
  beforeEach(() => {
    clearStoredToken();
    clearStoredRefreshToken();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("em 401, renova com o refresh token guardado e repete a chamada original com sucesso", async () => {
    storeToken("access-velho");
    storeRefreshToken("refresh-valido");

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(401, { error_code: "token_expirado", message: "Token expirado.", request_id: "r1" }))
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "access-novo", refresh_token: "refresh-novo" }))
      .mockResolvedValueOnce(jsonResponse(200, { trade_name: "Clínica Teste" }));

    const result = await apiClient.get<{ trade_name: string }>("/api/v1/tenant");

    expect(result).toEqual({ trade_name: "Clínica Teste" });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe("http://localhost:9999/api/v1/auth/refresh");
    // A retentativa usa o NOVO access_token, não o antigo.
    const retryHeaders = vi.mocked(fetch).mock.calls[2][1]?.headers as Record<string, string>;
    expect(retryHeaders["Authorization"]).toBe("Bearer access-novo");
    // Os dois tokens novos ficam guardados pra próxima chamada.
    expect(getStoredToken()).toBe("access-novo");
    expect(getStoredRefreshToken()).toBe("refresh-novo");
  });

  it("sem refresh token guardado, dispara auth:unauthorized direto (sem tentar renovar)", async () => {
    storeToken("access-velho");
    // clearStoredRefreshToken() já rodou no beforeEach — nenhum refresh token.
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(401, { error_code: "token_expirado", message: "Token expirado.", request_id: "r1" }));
    const unauthorizedHandler = vi.fn();
    window.addEventListener("auth:unauthorized", unauthorizedHandler);

    await expect(apiClient.get("/api/v1/tenant")).rejects.toThrow(ApiError);

    expect(fetch).toHaveBeenCalledTimes(1); // nunca tentou /auth/refresh
    expect(unauthorizedHandler).toHaveBeenCalledTimes(1);
    window.removeEventListener("auth:unauthorized", unauthorizedHandler);
  });

  it("quando o refresh também falha (refresh token expirado/revogado), derruba a sessão do jeito antigo", async () => {
    storeToken("access-velho");
    storeRefreshToken("refresh-tambem-expirado");

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(401, { error_code: "token_expirado", message: "Token expirado.", request_id: "r1" }))
      .mockResolvedValueOnce(jsonResponse(401, { error_code: "sessao_expirada", message: "Sessão expirada.", request_id: "r2" }));
    const unauthorizedHandler = vi.fn();
    window.addEventListener("auth:unauthorized", unauthorizedHandler);

    await expect(apiClient.get("/api/v1/tenant")).rejects.toThrow(ApiError);

    // Só a chamada original + a tentativa de refresh — NUNCA repete a
    // chamada original de novo (evita loop infinito de refresh).
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(unauthorizedHandler).toHaveBeenCalledTimes(1);
    window.removeEventListener("auth:unauthorized", unauthorizedHandler);
  });

  it("duas chamadas simultâneas que tomam 401 ao mesmo tempo compartilham UMA única renovação", async () => {
    storeToken("access-velho");
    storeRefreshToken("refresh-valido");

    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/v1/auth/refresh")) {
        return Promise.resolve(jsonResponse(200, { access_token: "access-novo", refresh_token: "refresh-novo" }));
      }
      const headers = init?.headers as Record<string, string> | undefined;
      if (headers?.["Authorization"] === "Bearer access-novo") {
        return Promise.resolve(jsonResponse(200, { ok: true }));
      }
      return Promise.resolve(jsonResponse(401, { error_code: "token_expirado", message: "Token expirado.", request_id: "r1" }));
    });

    const [a, b] = await Promise.all([apiClient.get("/api/v1/tenant"), apiClient.get("/api/v1/subscription")]);

    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    const refreshCalls = vi.mocked(fetch).mock.calls.filter(([input]) => String(input).endsWith("/api/v1/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
  });
});
