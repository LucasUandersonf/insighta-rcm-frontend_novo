import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { UsageBandMeter, type BillingBand } from "@/components/billing/UsageBandMeter";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

function band(over: Partial<BillingBand> = {}): BillingBand {
  return {
    pricing_model: "bands",
    rolling3: 421000,
    included: 500000,
    next_step_at: 550000,
    step_price: 390,
    unit_price: 390,
    steps: 0,
    extra_units: 0,
    base_price: 1390,
    total_price: 1390,
    pending_new_price: null,
    pending_effective_on: null,
    history: [],
    ...over,
  };
}

describe("UsageBandMeter", () => {
  it("mostra a média contra a faixa e a regra de subida, sem cobrar por importar", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(band() as never);
    const { container } = renderWithProviders(<UsageBandMeter />);
    expect(await screen.findByText(/R\$\s?421\.000 de R\$\s?500\.000 incluídos/)).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Uso da faixa de faturamento" })).toHaveAttribute("aria-valuenow", "84");
    expect(screen.getByText(/Importar mais dados nunca aumenta a mensalidade sozinho/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver quanto o Insighta recuperou" })).toHaveAttribute("href", "/resultado");
    await expectNoA11yViolations(container);
  });

  it("avisa a nova mensalidade e a data quando a faixa vai subir", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(band({ rolling3: 620000, pending_new_price: 1780, pending_effective_on: "2026-12-01" }) as never);
    renderWithProviders(<UsageBandMeter />);
    expect(await screen.findByText(/A partir de 01\/12\/2026, a mensalidade passa a R\$\s?1\.780,00/)).toBeInTheDocument();
  });

  it("não aparece em contrato de preço fixo", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(band({ pricing_model: "flat" }) as never);
    renderWithProviders(<UsageBandMeter />);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(screen.queryByText("Faixa de faturamento")).not.toBeInTheDocument();
  });
});
