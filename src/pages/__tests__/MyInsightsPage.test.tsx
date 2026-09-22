import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MyInsightsPage } from "@/pages/MyInsightsPage";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { CurrentUser, InsightOutcome, InsightOutcomesRealizedSummary, PaginatedResponse } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), patch: vi.fn() } };
});

vi.mock("@/context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/AuthContext")>();
  return { ...actual, useAuth: vi.fn() };
});

function mockUser(role: CurrentUser["role"]) {
  vi.mocked(useAuth).mockReturnValue({
    user: { tenant_id: "t1", id: "u1", role } as unknown as CurrentUser,
  } as unknown as ReturnType<typeof useAuth>);
}

function makeOutcome(overrides: Partial<InsightOutcome> = {}): InsightOutcome {
  return {
    id: "outcome-1",
    insight_key: "faturamento_x",
    source: "raiox",
    category: "faturamento",
    severity: "warning",
    title: "Contrato com baixa utilização",
    message: "Só 40% do catálogo faturado.",
    financial_impact_snapshot: 500,
    status: "pendente",
    assigned_to: "u1",
    due_date: "2026-09-30",
    resolution_note: null,
    resolved_at: null,
    resolved_metric_value: null,
    reevaluated_at: null,
    created_by: "owner-1",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("MyInsightsPage — épicos F1.2/F1.3 do Plano Diretor", () => {
  it("atendimento vê 'Meus pendentes' mas não 'Insights que valeram a pena'", async () => {
    mockUser("atendimento");
    const mine: PaginatedResponse<InsightOutcome> = { items: [makeOutcome()], total: 1, limit: 50, offset: 0 };
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path.includes("/mine")) return Promise.resolve(mine as never);
      return Promise.reject(new Error(`sem mock para ${path}`));
    });

    renderWithProviders(<MyInsightsPage />);

    await waitFor(() => expect(screen.getByText("Contrato com baixa utilização")).toBeInTheDocument());
    expect(screen.queryByText("Insights que valeram a pena")).not.toBeInTheDocument();
    // Não deveria nem tentar buscar o resumo — RBAC do próprio componente.
    expect(apiClient.get).not.toHaveBeenCalledWith(expect.stringContaining("realized-summary"));
  });

  it("financeiro vê os dois painéis, e atualizar status chama PATCH", async () => {
    mockUser("financeiro");
    const mine: PaginatedResponse<InsightOutcome> = { items: [makeOutcome()], total: 1, limit: 50, offset: 0 };
    const realized: InsightOutcomesRealizedSummary = {
      total_resolved_and_reevaluated: 1,
      total_delta_realized: 300,
      items: [makeOutcome({ id: "outcome-2", status: "resolvido", financial_impact_snapshot: 500, resolved_metric_value: 200 })],
    };
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path.includes("/mine")) return Promise.resolve(mine as never);
      if (path.includes("realized-summary")) return Promise.resolve(realized as never);
      return Promise.reject(new Error(`sem mock para ${path}`));
    });
    vi.mocked(apiClient.patch).mockResolvedValue(makeOutcome({ status: "em_andamento" }));

    renderWithProviders(<MyInsightsPage />);

    await waitFor(() => expect(screen.getByText("Contrato com baixa utilização")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Insights que valeram a pena")).toBeInTheDocument());
    expect(screen.getByText("R$ 300,00")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "em_andamento" } });
    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/insight-outcomes/outcome-1", { status: "em_andamento" })
    );
  });

  it("mensagem honesta quando não há nada atribuído", async () => {
    mockUser("owner");
    const mine: PaginatedResponse<InsightOutcome> = { items: [], total: 0, limit: 50, offset: 0 };
    const realized: InsightOutcomesRealizedSummary = { total_resolved_and_reevaluated: 0, total_delta_realized: 0, items: [] };
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path.includes("/mine")) return Promise.resolve(mine as never);
      if (path.includes("realized-summary")) return Promise.resolve(realized as never);
      return Promise.reject(new Error(`sem mock para ${path}`));
    });

    renderWithProviders(<MyInsightsPage />);

    await waitFor(() => expect(screen.getByText("Nada atribuído a você no momento.")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/Ainda nenhum insight reavaliado/)).toBeInTheDocument());
  });

  it("não tem violações de acessibilidade", async () => {
    mockUser("financeiro");
    const mine: PaginatedResponse<InsightOutcome> = { items: [makeOutcome()], total: 1, limit: 50, offset: 0 };
    const realized: InsightOutcomesRealizedSummary = {
      total_resolved_and_reevaluated: 1,
      total_delta_realized: 300,
      items: [makeOutcome({ id: "outcome-2", status: "resolvido", financial_impact_snapshot: 500, resolved_metric_value: 200 })],
    };
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path.includes("/mine")) return Promise.resolve(mine as never);
      if (path.includes("realized-summary")) return Promise.resolve(realized as never);
      return Promise.reject(new Error(`sem mock para ${path}`));
    });

    const { container } = renderWithProviders(<MyInsightsPage />);

    await waitFor(() => expect(screen.getByText("Contrato com baixa utilização")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Insights que valeram a pena")).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});
