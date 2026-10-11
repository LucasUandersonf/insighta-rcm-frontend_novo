import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, clearStoredToken } from "@/lib/api-client";

// UX2-22: clique duplo em "Salvar meta" mandava 2 PATCH e mostrava 2 avisos.
// Escrita idêntica em andamento é reaproveitada; escrita diferente, não.
function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("api-client — escrita repetida em andamento", () => {
  beforeEach(() => {
    clearStoredToken();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ ok: true }))));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dois PATCH iguais ao mesmo tempo viram uma requisição só", async () => {
    const [a, b] = await Promise.all([
      apiClient.patch("/api/v1/tenant", { annual_revenue_goal: "2400000.00" }),
      apiClient.patch("/api/v1/tenant", { annual_revenue_goal: "2400000.00" }),
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it("corpo diferente ou nova escrita depois da primeira terminar vão ao servidor", async () => {
    await Promise.all([
      apiClient.patch("/api/v1/tenant", { annual_revenue_goal: "1.00" }),
      apiClient.patch("/api/v1/tenant", { annual_revenue_goal: "2.00" }),
    ]);
    await apiClient.patch("/api/v1/tenant", { annual_revenue_goal: "1.00" });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("GET não é afetado", async () => {
    await Promise.all([apiClient.get("/api/v1/tenant"), apiClient.get("/api/v1/tenant")]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
