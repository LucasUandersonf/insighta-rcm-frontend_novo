import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { DenialRiskDistributionPanel } from "@/components/dashboard/DenialRiskDistributionPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { DenialRiskDistribution } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("DenialRiskDistributionPanel", () => {
  it("mostra contagem por padrão e alterna para reais no clique do toggle", async () => {
    const data: DenialRiskDistribution = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      total_reviewed: 3,
      total_value_reviewed: 900,
      items: [
        { level: "high", count: 1, value: 500 },
        { level: "medium", count: 1, value: 300 },
        { level: "low", count: 1, value: 100 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<DenialRiskDistributionPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("Revisados")).toBeInTheDocument());
    expect(screen.getByText("3")).toBeInTheDocument(); // centerValue em modo atendimentos

    fireEvent.click(screen.getByRole("button", { name: "R$" }));

    await waitFor(() => expect(screen.getByText("Faturado")).toBeInTheDocument());
    expect(screen.getByText("R$ 900")).toBeInTheDocument();
  });

  it("mensagem honesta quando não há faturamento revisado", async () => {
    const data: DenialRiskDistribution = {
      period_start: "2026-09-01", period_end: "2026-09-07", total_reviewed: 0, total_value_reviewed: 0, items: [],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<DenialRiskDistributionPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText(/Nenhum faturamento revisado nesta janela/)).toBeInTheDocument());
  });
});
