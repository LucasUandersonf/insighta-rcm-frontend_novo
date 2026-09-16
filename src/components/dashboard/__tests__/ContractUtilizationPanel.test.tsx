import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ContractUtilizationPanel } from "@/components/dashboard/ContractUtilizationPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { ContractUtilization } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("ContractUtilizationPanel", () => {
  it("mostra o selo 'Particular' pra contrato sem operadora (Onda 3 do Plano de Ação)", async () => {
    const data: ContractUtilization = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      contracts: [
        {
          contract_id: "c1",
          plan_name: "Atendimento Particular",
          plan_type: "particular",
          valid_from: "2026-01-01",
          valid_until: null,
          total_items: 2,
          items_billed: 1,
          utilization_pct: 50,
          idle_catalog_value: 80,
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<ContractUtilizationPanel dateFrom="2026-01-01" dateTo="2026-01-07" />);

    await waitFor(() => expect(screen.getByText("Atendimento Particular")).toBeInTheDocument());
    expect(screen.getByText("Particular")).toBeInTheDocument();
  });
});
