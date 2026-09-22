import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { PlanLossRankingPanel } from "@/components/dashboard/PlanLossRankingPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { PlanLossRanking } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("PlanLossRankingPanel", () => {
  it("mostra o selo 'Particular' pra plano sem operadora (Onda 3 do Plano de Ação)", async () => {
    const data: PlanLossRanking = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      plans: [
        {
          plan_name: "Atendimento Particular",
          plan_type: "particular",
          financial_hole: 50,
          payment_gap: 0,
          denial_risk_value: 0,
          total_loss: 50,
        },
        {
          plan_name: "Unimed Nacional",
          plan_type: "convenio",
          financial_hole: 10,
          payment_gap: 0,
          denial_risk_value: 0,
          total_loss: 10,
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<PlanLossRankingPanel dateFrom="2026-01-01" dateTo="2026-01-07" />);

    await waitFor(() => expect(screen.getByText("Atendimento Particular")).toBeInTheDocument());
    expect(screen.getByText("Particular")).toBeInTheDocument();
    expect(screen.getByText("Unimed Nacional")).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    const data: PlanLossRanking = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      plans: [
        {
          plan_name: "Atendimento Particular",
          plan_type: "particular",
          financial_hole: 50,
          payment_gap: 0,
          denial_risk_value: 0,
          total_loss: 50,
        },
        {
          plan_name: "Unimed Nacional",
          plan_type: "convenio",
          financial_hole: 10,
          payment_gap: 0,
          denial_risk_value: 0,
          total_loss: 10,
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    const { container } = renderWithProviders(<PlanLossRankingPanel dateFrom="2026-01-01" dateTo="2026-01-07" />);

    await waitFor(() => expect(screen.getByText("Atendimento Particular")).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});
