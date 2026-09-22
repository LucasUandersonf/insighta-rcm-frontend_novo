import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ContributionMarginPanel } from "@/components/dashboard/ContributionMarginPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { ContributionMargin } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("ContributionMarginPanel", () => {
  it("mostra receita, custo e margem por procedimento", async () => {
    const data: ContributionMargin = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      items: [
        { procedure_code: "10101012", total_revenue: 1000, total_cost: 200, margin_pct: 80, sample_count: 5 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<ContributionMarginPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("10101012")).toBeInTheDocument());
    expect(screen.getByText("80.0%")).toBeInTheDocument();
  });

  it("travessão quando margem é indefinida (receita zero)", async () => {
    const data: ContributionMargin = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      items: [{ procedure_code: "20202020", total_revenue: 0, total_cost: 0, margin_pct: null, sample_count: 1 }],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<ContributionMarginPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("20202020")).toBeInTheDocument());
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("mensagem honesta sem atendimento de procedimento único no período", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ period_start: "2026-09-01", period_end: "2026-09-07", items: [] } as ContributionMargin);

    renderWithProviders(<ContributionMarginPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText(/Nenhum atendimento de procedimento único/)).toBeInTheDocument());
  });

  it("não tem violações de acessibilidade", async () => {
    const data: ContributionMargin = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      items: [
        { procedure_code: "10101012", total_revenue: 1000, total_cost: 200, margin_pct: 80, sample_count: 5 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    const { container } = renderWithProviders(<ContributionMarginPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("10101012")).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});
