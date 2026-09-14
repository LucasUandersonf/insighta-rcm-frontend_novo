import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ProductRoiPanel } from "@/components/dashboard/ProductRoiPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { ProductRoi } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

// Épico F4.4 do Plano Diretor ("Prova de ROI do próprio produto").
describe("ProductRoiPanel", () => {
  it("mostra o total e os três componentes reais", async () => {
    const data: ProductRoi = {
      protected_from_denial_value: 3000,
      recovered_appeals_value: 5000,
      recovered_appeals_count: 3,
      realized_insight_outcomes_value: 2000,
      realized_insight_outcomes_count: 1,
      total_roi_value: 10000,
      tracking_since: "2026-01-15",
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<ProductRoiPanel />);

    await waitFor(() => expect(screen.getByText(/R\$\s?10\.000,00/)).toBeInTheDocument());
    expect(screen.getByText(/R\$\s?3\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?5\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?2\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/desde 15\/01\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/3 recurso\(s\) de glosa ganho\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 insight\(s\) resolvido\(s\)/)).toBeInTheDocument();
  });

  it("mensagem honesta quando ainda não há nenhum valor registrado", async () => {
    const data: ProductRoi = {
      protected_from_denial_value: 0,
      recovered_appeals_value: 0,
      recovered_appeals_count: 0,
      realized_insight_outcomes_value: 0,
      realized_insight_outcomes_count: 0,
      total_roi_value: 0,
      tracking_since: null,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<ProductRoiPanel />);

    await waitFor(() =>
      expect(screen.getByText(/Ainda não há nenhum valor protegido, recuperado ou realizado/)).toBeInTheDocument()
    );
  });
});
