import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ConsumptionByProfessionalPanel } from "@/components/dashboard/ConsumptionByProfessionalPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { ConsumptionByProfessional } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("ConsumptionByProfessionalPanel", () => {
  it("lista os profissionais por custo médio por atendimento, maior primeiro", async () => {
    const data: ConsumptionByProfessional = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      items: [
        { professional_id: "p1", professional_name: "Dr. Baixo Consumo", custo_total: 200, atendimentos_count: 10, custo_medio_por_atendimento: 20 },
        { professional_id: "p2", professional_name: "Dra. Alto Consumo", custo_total: 1000, atendimentos_count: 10, custo_medio_por_atendimento: 100 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<ConsumptionByProfessionalPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("Dra. Alto Consumo")).toBeInTheDocument());
    const rows = screen.getAllByRole("row");
    // Header + 2 linhas de dado; a linha de maior custo médio deve vir primeiro.
    expect(rows[1]).toHaveTextContent("Dra. Alto Consumo");
    expect(rows[2]).toHaveTextContent("Dr. Baixo Consumo");
  });

  it("mensagem honesta quando ninguém atinge a amostra mínima", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ period_start: "2026-09-01", period_end: "2026-09-07", items: [] } as ConsumptionByProfessional);

    renderWithProviders(<ConsumptionByProfessionalPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText(/Nenhum profissional com amostra suficiente/)).toBeInTheDocument());
  });

  it("não tem violações de acessibilidade", async () => {
    const data: ConsumptionByProfessional = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      items: [
        { professional_id: "p1", professional_name: "Dr. Baixo Consumo", custo_total: 200, atendimentos_count: 10, custo_medio_por_atendimento: 20 },
        { professional_id: "p2", professional_name: "Dra. Alto Consumo", custo_total: 1000, atendimentos_count: 10, custo_medio_por_atendimento: 100 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    const { container } = renderWithProviders(<ConsumptionByProfessionalPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("Dra. Alto Consumo")).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});
