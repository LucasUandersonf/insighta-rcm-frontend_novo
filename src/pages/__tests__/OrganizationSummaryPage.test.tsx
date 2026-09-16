import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { OrganizationSummaryPage } from "@/pages/OrganizationSummaryPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { OrganizationSummary } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

// Épico F3.2 do Plano Diretor ("Consolidação multi-unidade").
describe("OrganizationSummaryPage", () => {
  it("clínica avulsa (sem organização) vê mensagem honesta, nunca um erro", async () => {
    const data: OrganizationSummary = {
      belongs_to_organization: false,
      organization_name: null,
      window_days: 30,
      units: [],
      consolidated_total_billed: 0,
      consolidated_denial_risk_pct: null,
      consolidated_no_show_rate: null,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<OrganizationSummaryPage />);

    await waitFor(() =>
      expect(screen.getByText(/Esta clínica não faz parte de um grupo multi-unidade/)).toBeInTheDocument()
    );
  });

  it("mostra as unidades lado a lado com os consolidados, pior risco em destaque", async () => {
    const data: OrganizationSummary = {
      belongs_to_organization: true,
      organization_name: "Grupo Clínica Alfa",
      window_days: 30,
      units: [
        {
          tenant_id: "t1",
          trade_name: "Unidade Centro",
          is_requesting_tenant: true,
          total_billed: 10_000,
          denial_risk_pct: 0.3,
          appointment_count: 40,
          no_show_rate: 0.1,
        },
        {
          tenant_id: "t2",
          trade_name: "Unidade Zona Sul",
          is_requesting_tenant: false,
          total_billed: 8_000,
          denial_risk_pct: 0.1,
          appointment_count: 30,
          no_show_rate: 0.05,
        },
      ],
      consolidated_total_billed: 18_000,
      consolidated_denial_risk_pct: 0.2,
      consolidated_no_show_rate: 0.08,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<OrganizationSummaryPage />);

    await waitFor(() => expect(screen.getByText("Grupo Clínica Alfa")).toBeInTheDocument());
    expect(screen.getByText("Unidade Centro")).toBeInTheDocument();
    expect(screen.getByText("Unidade Zona Sul")).toBeInTheDocument();
    expect(screen.getByText("Esta unidade")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?18\.000,00/)).toBeInTheDocument();
  });

  it("busca o endpoint de organização", async () => {
    const data: OrganizationSummary = {
      belongs_to_organization: false,
      organization_name: null,
      window_days: 30,
      units: [],
      consolidated_total_billed: 0,
      consolidated_denial_risk_pct: null,
      consolidated_no_show_rate: null,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<OrganizationSummaryPage />);

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith("/api/v1/analytics/organization-summary"));
  });
});
