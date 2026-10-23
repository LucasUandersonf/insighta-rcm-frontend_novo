import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WithholdingPanel } from "@/components/money/WithholdingPanel";
import { BillingBridge } from "@/components/money/BillingBridge";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { BillingBridge as Bridge, WithholdingOverview } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), put: vi.fn() } };
});

let mockRole = "financeiro";
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { sub: "u1", tenant_id: "t1", role: mockRole } }),
}));

const LEGAL = { irrf: 1.5, pis: 0.65, cofins: 3, csll: 1, iss: 0 };
const OVERVIEW: WithholdingOverview = {
  legal_default: LEGAL,
  plans: [
    {
      plan_id: "p1",
      plan_name: "Unimed",
      billed_90d: 50000,
      confirmed: null,
      confirmed_at: null,
      total_pct: null,
      observed_pct: 6.2,
      observed_count: 40,
      suggested: LEGAL,
      suggestion_source: "historico",
    },
    {
      plan_id: "p2",
      plan_name: "Amil",
      billed_90d: 20000,
      confirmed: { irrf: 1.5, pis: 0, cofins: 0, csll: 0, iss: 0 },
      confirmed_at: "2026-10-01T12:00:00Z",
      total_pct: 1.5,
      observed_pct: null,
      observed_count: 0,
      suggested: LEGAL,
      suggestion_source: "padrao",
    },
  ],
};

describe("WithholdingPanel", () => {
  it("mostra a sugestão pelo histórico e confirma com um clique", async () => {
    mockRole = "financeiro";
    vi.mocked(apiClient.get).mockResolvedValue(OVERVIEW as never);
    vi.mocked(apiClient.put).mockResolvedValue({} as never);
    const { container } = renderWithProviders(<WithholdingPanel />);

    expect(await screen.findByText("Sugestão: 6,15%")).toBeInTheDocument();
    expect(screen.getByText(/o convênio reteve em média 6,2%/)).toBeInTheDocument();
    expect(screen.getByText("Retém 1,5%")).toBeInTheDocument();
    expect(screen.getByText(/1 convênio ainda sem retenção confirmada/)).toBeInTheDocument();
    await expectNoA11yViolations(container);

    await userEvent.click(screen.getByRole("button", { name: "Confirmar sugestão" }));
    await waitFor(() => expect(vi.mocked(apiClient.put)).toHaveBeenCalledWith("/api/v1/financeiro/retencoes/p1", LEGAL));
  });

  it("ajusta as alíquotas antes de confirmar", async () => {
    mockRole = "owner";
    vi.mocked(apiClient.get).mockResolvedValue(OVERVIEW as never);
    vi.mocked(apiClient.put).mockResolvedValue({} as never);
    renderWithProviders(<WithholdingPanel />);

    await userEvent.click((await screen.findAllByRole("button", { name: "Ajustar" }))[0]);
    const iss = screen.getByLabelText("ISS (%)");
    await userEvent.clear(iss);
    await userEvent.type(iss, "2");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar 8,15%" }));
    await waitFor(() =>
      expect(vi.mocked(apiClient.put)).toHaveBeenCalledWith("/api/v1/financeiro/retencoes/p1", { ...LEGAL, iss: 2 }),
    );
  });

  it("auditor vê, mas não confirma", async () => {
    mockRole = "auditor";
    vi.mocked(apiClient.get).mockResolvedValue(OVERVIEW as never);
    renderWithProviders(<WithholdingPanel />);
    expect(await screen.findByText("Sugestão: 6,15%")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar sugestão" })).not.toBeInTheDocument();
  });
});

const BRIDGE: Bridge = {
  date_from: "2026-07-24",
  date_to: "2026-10-21",
  billed: 1700,
  denied: 200,
  open: 500,
  withholding: 61.5,
  received: 900,
  unexplained: 38.5,
  confirmed_plans: 1,
  plans_with_billing: 3,
};

describe("BillingBridge", () => {
  it("explica do faturado ao recebido e pede as retenções que faltam", async () => {
    mockRole = "owner";
    vi.mocked(apiClient.get).mockResolvedValue(BRIDGE as never);
    renderWithProviders(<BillingBridge />);

    expect(await screen.findByText("Do faturado ao recebido · últimos 90 dias")).toBeInTheDocument();
    expect(screen.getByText("Retido na fonte (impostos)")).toBeInTheDocument();
    expect(screen.getByText("Pago a menos, sem explicação")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?38,50/)).toBeInTheDocument();
    expect(screen.getByText(/Retenção confirmada em 1 de 3 convênios/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Confirmar retenções" })).toHaveAttribute("href", "/convenios?tab=prazos");
  });
});
