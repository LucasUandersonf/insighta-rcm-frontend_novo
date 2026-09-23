import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { UnbilledConsumptionPanel } from "@/components/dashboard/UnbilledConsumptionPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("UnbilledConsumptionPanel", () => {
  it("lista cada atendimento com material usado e não cobrado", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      period_start: "2026-09-01",
      period_end: "2026-09-23",
      total_cost: 1400,
      items: [
        {
          appointment_id: "a1",
          scheduled_at: "2026-09-20T13:00:00Z",
          patient_name: "Maria Souza",
          professional_name: "Dra. Ortopedia",
          materials: "Placa de titânio",
          cost: 1400,
        },
      ],
    } as never);
    const { container } = renderWithProviders(<UnbilledConsumptionPanel dateFrom="2026-09-01" dateTo="2026-09-23" />);
    expect(await screen.findByText("Placa de titânio")).toBeInTheDocument();
    expect(screen.getByText("Dra. Ortopedia")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s1\.400,00 só de custo/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("estado vazio explica que não há perda", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ period_start: "", period_end: "", total_cost: 0, items: [] } as never);
    renderWithProviders(<UnbilledConsumptionPanel dateFrom="2026-09-01" dateTo="2026-09-23" />);
    expect(await screen.findByText(/Nenhum material especial ou medicamento usado sem cobrança/)).toBeInTheDocument();
  });
});
