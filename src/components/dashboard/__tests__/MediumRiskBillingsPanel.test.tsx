import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { MediumRiskBillingsPanel } from "@/components/dashboard/MediumRiskBillingsPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { BillingResponse, PaginatedResponse } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

function makeBilling(overrides: Partial<BillingResponse> = {}): BillingResponse {
  return {
    id: "b1",
    appointment_id: "a1",
    charged_value: 150,
    status: "pending",
    denial_risk_level: "medium",
    denial_reasons: ["no_contract_reference"],
    value_saved_by_correction: 0,
    received_value: null,
    settled_at: null,
    created_at: "2026-01-05T00:00:00Z",
    quantity: 1,
    member_card_number: null,
    ...overrides,
  } as BillingResponse;
}

describe("MediumRiskBillingsPanel", () => {
  it("lista faturamentos de risco médio, separados da fila de alto risco", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      { items: [makeBilling()], total: 1, limit: 20, offset: 0 } as PaginatedResponse<BillingResponse> as never
    );

    renderWithProviders(<MediumRiskBillingsPanel />);

    expect(screen.getByText("Contas que valem revisão — risco médio de glosa")).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining("/billing/medium-risk"));
    expect(await screen.findByText("no_contract_reference")).toBeInTheDocument();
  });

  it("lista vazia mostra estado de 'nada precisando de revisão'", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 } as never);

    renderWithProviders(<MediumRiskBillingsPanel />);

    expect(await screen.findByText(/nada precisando de uma segunda olhada/)).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      { items: [makeBilling()], total: 1, limit: 20, offset: 0 } as PaginatedResponse<BillingResponse> as never
    );

    const { container } = renderWithProviders(<MediumRiskBillingsPanel />);

    expect(await screen.findByText("no_contract_reference")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
