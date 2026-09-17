import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { PatientRevenueParetoPanel } from "@/components/dashboard/PatientRevenueParetoPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { PatientRevenuePareto } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("PatientRevenueParetoPanel", () => {
  it("lista os pacientes por receita, maior primeiro, com % acumulado", async () => {
    const data: PatientRevenuePareto = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      total_billed: 1000,
      items: [
        { patient_id: "p1", full_name: "Paciente Alto Valor", revenue: 700, share_pct: 70, cumulative_share_pct: 70 },
        { patient_id: "p2", full_name: "Paciente Baixo Valor", revenue: 300, share_pct: 30, cumulative_share_pct: 100 },
      ],
      top_n_share_pct: 100,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    const { container } = renderWithProviders(<PatientRevenueParetoPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("Paciente Alto Valor")).toBeInTheDocument());
    expect(screen.getByText("Paciente Baixo Valor")).toBeInTheDocument();
    expect(screen.getByText(/somam 100\.0% de tudo que a clínica faturou/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("mensagem honesta quando não há faturamento no período", async () => {
    const data: PatientRevenuePareto = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      total_billed: 0,
      items: [],
      top_n_share_pct: null,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<PatientRevenueParetoPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText(/Nenhum faturamento neste período/)).toBeInTheDocument());
  });
});
