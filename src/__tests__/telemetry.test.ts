import { afterEach, describe, expect, it, vi } from "vitest";
import { _pendingViews, _resetTelemetry, flushPageViews, normalizePath, trackPageView } from "@/lib/telemetry";
import * as apiClient from "@/lib/api-client";

describe("telemetria de navegação", () => {
  afterEach(() => {
    _resetTelemetry();
    vi.restoreAllMocks();
  });

  it("normaliza ids, parâmetros e segmentos fora do padrão", () => {
    expect(normalizePath("/pacientes/3f2a1b4c-1111-2222-3333-444455556666/ficha?aba=1")).toBe("/pacientes/:id/ficha");
    expect(normalizePath("/faturas/123#x")).toBe("/faturas/:id");
    expect(normalizePath("/busca/maria@email.com")).toBe("/busca/:x");
    expect(normalizePath("/")).toBe("/");
  });

  it("não repete a mesma tela e envia em lote com o token", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(apiClient, "getStoredToken").mockReturnValue("tok");

    trackPageView("/sala-de-comando");
    trackPageView("/sala-de-comando");
    trackPageView("/pacientes/42");
    expect(_pendingViews().map((v) => v.path)).toEqual(["/sala-de-comando", "/pacientes/:id"]);

    flushPageViews();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/telemetry/page-views");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body).views).toHaveLength(2);
    expect(_pendingViews()).toHaveLength(0);
  });

  it("sem login não envia nada", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(apiClient, "getStoredToken").mockReturnValue(null);
    trackPageView("/x");
    flushPageViews();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
