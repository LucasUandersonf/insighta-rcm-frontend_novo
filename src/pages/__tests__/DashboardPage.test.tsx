import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardPage } from "@/pages/DashboardPage";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";
import type { BillingResponse, ExecutiveSummary, PaginatedResponse } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));

const SUMMARY: ExecutiveSummary = {
  period_start: "2026-01-01",
  period_end: "2026-01-07",
  total_billed: { value: 1000, previous_value: 900, delta_pct: 11.1 },
  total_value_saved: { value: 0, previous_value: 0, delta_pct: null },
  financial_hole: { value: 0, previous_value: 0, delta_pct: null },
  payment_gap: { value: 0, previous_value: 0, delta_pct: null },
  margin_vs_contracted_pct: null,
  avg_capacity_utilization: null,
  high_risk_pending_count: 0,
  appeals_due_soon_count: 0,
  denial_risk_pct: null,
  denial_at_risk_value: 0,
};

function billingPage(items: BillingResponse[]): PaginatedResponse<BillingResponse> {
  return { items, total: items.length, limit: 20, offset: 0 };
}

function makeBilling(overrides: Partial<BillingResponse> = {}): BillingResponse {
  return {
    id: "b1",
    appointment_id: "a1",
    charged_value: 150,
    status: "held_for_review",
    denial_risk_level: "high",
    denial_reasons: ["missing_cid"],
    value_saved_by_correction: 0,
    received_value: null,
    settled_at: null,
    created_at: "2026-01-05T00:00:00Z",
    ...overrides,
  };
}

describe("DashboardPage — deep-link de convênio (item 4 do roadmap)", () => {
  it("sem parâmetro na URL, busca a fila geral e não mostra o banner de filtro", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { tenant_id: "t1", sub: "u1", role: "owner" } } as unknown as ReturnType<
      typeof useAuth
    >);
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("high-risk")) return Promise.resolve(billingPage([makeBilling()]) as never);
      if (url.includes("executive-summary")) return Promise.resolve(SUMMARY as never);
      return Promise.reject(new Error(`URL não mockada: ${url}`));
    });

    renderWithProviders(<DashboardPage />);

    await waitFor(() => expect(screen.getByText("Faturamentos de alto risco")).toBeInTheDocument());
    expect(screen.queryByText(/Filtrando por 1 convênio/)).not.toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith(expect.not.stringContaining("insurance_plan_id"));
  });

  it("com ?insurance_plan_id= na URL, chama a API já filtrada e mostra o banner", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { tenant_id: "t1", sub: "u1", role: "owner" } } as unknown as ReturnType<
      typeof useAuth
    >);
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("high-risk")) return Promise.resolve(billingPage([makeBilling()]) as never);
      if (url.includes("executive-summary")) return Promise.resolve(SUMMARY as never);
      return Promise.reject(new Error(`URL não mockada: ${url}`));
    });

    renderWithProviders(<DashboardPage />, { route: "/?insurance_plan_id=plan-123" });

    await waitFor(() => expect(screen.getByText(/Filtrando por 1 convênio/)).toBeInTheDocument());
    expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining("insurance_plan_id=plan-123"));
  });

  it("clicar em 'Limpar filtro' refaz a busca sem o parâmetro", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { tenant_id: "t1", sub: "u1", role: "owner" } } as unknown as ReturnType<
      typeof useAuth
    >);
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("high-risk")) return Promise.resolve(billingPage([makeBilling()]) as never);
      if (url.includes("executive-summary")) return Promise.resolve(SUMMARY as never);
      return Promise.reject(new Error(`URL não mockada: ${url}`));
    });
    const user = userEvent.setup();

    renderWithProviders(<DashboardPage />, { route: "/?insurance_plan_id=plan-123" });

    await waitFor(() => expect(screen.getByText(/Filtrando por 1 convênio/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Limpar filtro/ }));

    await waitFor(() => expect(screen.queryByText(/Filtrando por 1 convênio/)).not.toBeInTheDocument());
  });
});
