import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { UpsellFunnelPanel } from "@/components/dashboard/UpsellFunnelPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { UpsellFunnel } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("UpsellFunnelPanel", () => {
  it("lista ofertas e taxa de aceite por procedimento", async () => {
    const data: UpsellFunnel = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      total_offered: 3,
      total_accepted: 2,
      overall_acceptance_rate: 2 / 3,
      items: [
        { procedure_name: "Clareamento dental", offered_count: 2, accepted_count: 1, acceptance_rate: 0.5 },
        { procedure_name: "Limpeza avançada", offered_count: 1, accepted_count: 1, acceptance_rate: 1.0 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<UpsellFunnelPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("Clareamento dental")).toBeInTheDocument());
    expect(screen.getByText("Limpeza avançada")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText(/2 de 3 no total/)).toBeInTheDocument();
  });

  it("mensagem honesta quando não há oferta registrada no período", async () => {
    const data: UpsellFunnel = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      total_offered: 0,
      total_accepted: 0,
      overall_acceptance_rate: null,
      items: [],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<UpsellFunnelPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() =>
      expect(screen.getByText(/Nenhuma oferta de procedimento adicional registrada neste período/)).toBeInTheDocument()
    );
  });
});
