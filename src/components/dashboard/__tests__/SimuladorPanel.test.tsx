import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { SimuladorPanel } from "@/components/dashboard/SimuladorPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("SimuladorPanel", () => {
  it("projeta o impacto combinando denial_at_risk_value e estimated_revenue_at_risk reais, nunca um número inventado", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("executive-summary")) {
        return Promise.resolve({ denial_at_risk_value: 10_000 } as never);
      }
      if (url.includes("agenda-metrics")) {
        return Promise.resolve({ estimated_revenue_at_risk: 2_000 } as never);
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    renderWithProviders(<SimuladorPanel />);

    // Valores default: 40% do buraco de glosa + 20% do risco de falta
    // = 0.4*10000 + 0.2*2000 = 4000 + 400 = 4400.
    await waitFor(() => expect(screen.getByText(/R\$\s?4\.400,00/)).toBeInTheDocument());
  });
});
