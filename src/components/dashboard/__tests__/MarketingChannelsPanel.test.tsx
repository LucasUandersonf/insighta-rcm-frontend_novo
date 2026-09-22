import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { MarketingChannelsPanel } from "@/components/dashboard/MarketingChannelsPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { MarketingChannels } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("MarketingChannelsPanel", () => {
  it("lista CAC e receita média por campanha", async () => {
    const data: MarketingChannels = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      total_spend: 550,
      items: [
        {
          source: "meta_ads", campaign_id: "campanha-primavera", campaign_name: "Campanha de Primavera",
          spend: 400, patients_acquired: 2, cac: 200, lifetime_patients: 2, lifetime_revenue: 800, avg_revenue_per_patient: 400,
        },
        {
          source: "google_ads", campaign_id: "campanha-sem-conversao", campaign_name: null,
          spend: 150, patients_acquired: 0, cac: null, lifetime_patients: 0, lifetime_revenue: 0, avg_revenue_per_patient: null,
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<MarketingChannelsPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("Campanha de Primavera")).toBeInTheDocument());
    expect(screen.getByText("campanha-sem-conversao")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2); // CAC e receita média indefinidos pra quem não converteu
  });

  it("mensagem honesta quando não há gasto de marketing no período", async () => {
    const data: MarketingChannels = { period_start: "2026-09-01", period_end: "2026-09-07", total_spend: 0, items: [] };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<MarketingChannelsPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() =>
      expect(screen.getByText(/Nenhum gasto de marketing registrado neste período/)).toBeInTheDocument()
    );
  });

  it("não tem violações de acessibilidade", async () => {
    const data: MarketingChannels = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      total_spend: 550,
      items: [
        {
          source: "meta_ads", campaign_id: "campanha-primavera", campaign_name: "Campanha de Primavera",
          spend: 400, patients_acquired: 2, cac: 200, lifetime_patients: 2, lifetime_revenue: 800, avg_revenue_per_patient: 400,
        },
        {
          source: "google_ads", campaign_id: "campanha-sem-conversao", campaign_name: null,
          spend: 150, patients_acquired: 0, cac: null, lifetime_patients: 0, lifetime_revenue: 0, avg_revenue_per_patient: null,
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    const { container } = renderWithProviders(<MarketingChannelsPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("Campanha de Primavera")).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});
