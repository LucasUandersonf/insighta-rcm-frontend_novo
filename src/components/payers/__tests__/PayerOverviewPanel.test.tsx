import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PayerOverviewPanel } from "@/components/payers/PayerOverviewPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { PayerOverview } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

const OVERVIEW: PayerOverview = {
  period_start: "2026-06-26",
  period_end: "2026-09-23",
  total_billed: 12000,
  total_denied: 400,
  avg_days_to_receive: 40,
  rows: [
    {
      insurance_plan_id: "p1",
      name: "Bradesco Saúde",
      plan_type: "convenio",
      billed: 9000,
      share_pct: 75,
      denial_pct: 4,
      denied_value: 400,
      avg_days_to_receive: 61,
      awaiting_value: 4100,
      read: "Glosa sob controle, mas 61 dias para pagar seguram R$ 4.100 do seu caixa.",
      tone: "warn",
    },
  ],
  verdicts: [{ kind: "slowest", label: "Quem segura seu caixa", name: "Bradesco Saúde", text: "61 dias para pagar." }],
  concentration_text: null,
  attention: [],
};

describe("PayerOverviewPanel (Convênios → Visão geral)", () => {
  it("mostra veredicto, leitura por linha e simula o caixa liberado", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(OVERVIEW as never);
    renderWithProviders(<PayerOverviewPanel dateFrom="2026-06-26" dateTo="2026-09-23" />);

    expect(await screen.findByText("Quem segura seu caixa")).toBeInTheDocument();
    expect(screen.getByText("Glosa sob controle, mas 61 dias para pagar seguram R$ 4.100 do seu caixa.")).toBeInTheDocument();
    expect(screen.getByText(/E se/)).toHaveTextContent("E se Bradesco Saúde pagasse em 45 dias?");
    // 9.000 em 90 dias = 3.000/mês; 16 dias a menos => 1.600.
    expect(screen.getByText("R$ 1.600")).toBeInTheDocument();
  });

  it("'Gerar argumento de renegociação' chama a API e mostra o texto", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(OVERVIEW as never);
    vi.mocked(apiClient.post).mockResolvedValue({ plan_name: "Bradesco Saúde", target_days: 45, monthly_cash_released: 1600, argument: "Prezados, propomos 45 dias." } as never);
    const user = userEvent.setup();
    renderWithProviders(<PayerOverviewPanel dateFrom="2026-06-26" dateTo="2026-09-23" />);

    await user.click(await screen.findByRole("button", { name: "Gerar argumento de renegociação" }));
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/analytics/payer-negotiation-argument", {
      insurance_plan_id: "p1",
      target_days: 45,
      date_from: "2026-06-26",
      date_to: "2026-09-23",
    });
    expect(await screen.findByText("Prezados, propomos 45 dias.")).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(OVERVIEW as never);
    const { container } = renderWithProviders(<PayerOverviewPanel dateFrom="2026-06-26" dateTo="2026-09-23" />);
    await screen.findByText("Quem segura seu caixa");
    await expectNoA11yViolations(container);
  });
});
