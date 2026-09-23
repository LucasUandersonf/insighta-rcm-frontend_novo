import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { BillingRiskQueuePage } from "@/pages/BillingRiskQueuePage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("BillingRiskQueuePage (Fila de correção — o que sobrou do Painel)", () => {
  it("abre a fila já filtrada pelo convênio quando vem de um insight", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/billing/high-risk"))
        return Promise.resolve({
          items: [
            {
              id: "b1",
              created_at: "2026-09-20T10:00:00Z",
              charged_value: 920,
              item_type: "material_opme",
              denial_risk_level: "high",
              denial_reasons: ["faltou o CID"],
              status: "pending",
              value_saved_by_correction: 0,
            },
          ],
          total: 1,
          limit: 20,
          offset: 0,
        } as never);
      return Promise.resolve({ items: [], total: 0, limit: 20, offset: 0 } as never);
    });
    renderWithProviders(<BillingRiskQueuePage />, { route: "/fila-correcao?insurance_plan_id=plan-1" });

    expect(await screen.findByRole("heading", { name: "Fila de correção" })).toBeInTheDocument();
    expect(await screen.findByText("faltou o CID")).toBeInTheDocument();
    expect(screen.getByText(/Filtrando por 1 convênio/)).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining("insurance_plan_id=plan-1"));
  });
});
