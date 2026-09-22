import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { CapitalDecisionPanel } from "@/components/dashboard/CapitalDecisionPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { CapitalDecisionBaseData } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

function baseData(overrides: Partial<CapitalDecisionBaseData> = {}): CapitalDecisionBaseData {
  return {
    window_days: 180,
    period_start: "2026-03-19",
    period_end: "2026-09-17",
    available_specialties: [],
    specialty_requested: null,
    used_fallback_clinic_wide: false,
    sample_size: 0,
    min_sample: 2,
    avg_revenue_per_hour: null,
    has_cost_data: false,
    avg_margin_per_hour: null,
    belongs_to_organization: false,
    sibling_units_count: 0,
    avg_monthly_revenue_per_unit: null,
    ...overrides,
  };
}

// Épico F3.4 do Plano Diretor ("Decisões de capital: contratar/expandir").
describe("CapitalDecisionPanel", () => {
  it("sem amostra nenhuma, mostra estado honesto nos dois blocos (nunca inventa um número)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(baseData());

    renderWithProviders(<CapitalDecisionPanel />);

    await waitFor(() => expect(screen.getByText(/Ainda não há amostra suficiente/)).toBeInTheDocument());
    expect(screen.getByText(/Esta clínica não faz parte de um grupo multi-unidade/)).toBeInTheDocument();
  });

  it("calcula o ganho líquido mensal de contratação (margem, quando disponível) e de expansão com dado real", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      baseData({
        sample_size: 3,
        avg_revenue_per_hour: 300,
        has_cost_data: true,
        avg_margin_per_hour: 250, // prioriza margem líquida sobre receita bruta
        belongs_to_organization: true,
        sibling_units_count: 2,
        avg_monthly_revenue_per_unit: 20000,
      })
    );

    renderWithProviders(<CapitalDecisionPanel />);

    // 250/h * 20h/semana * (52/12) semanas/mês - R$8.000 de custo mensal padrão = R$13.666,67.
    await waitFor(() => expect(screen.getByText(/R\$\s?13\.666,67/)).toBeInTheDocument());
    expect(screen.getByText(/líquida \(margem, já descontando custo\)/)).toBeInTheDocument();
    expect(screen.getByText(/Sem custo único informado/)).toBeInTheDocument();

    // Expansão: R$20.000 (outras unidades) - R$15.000 (custo padrão) = R$5.000; payback = 50.000 / 5.000 = 10 meses.
    expect(screen.getByText(/R\$\s?5\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/Payback em ~10 mês\(es\)/)).toBeInTheDocument();
  });

  it("amostra insuficiente pra especialidade avisa e cai pra média da clínica", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      baseData({
        available_specialties: ["Dermatologia", "Ortopedia"],
        specialty_requested: "Dermatologia",
        used_fallback_clinic_wide: true,
        sample_size: 2,
        avg_revenue_per_hour: 200,
      })
    );

    renderWithProviders(<CapitalDecisionPanel />);

    await waitFor(() => expect(screen.getByText(/Amostra insuficiente para "Dermatologia"/)).toBeInTheDocument());
  });

  it("não tem violações de acessibilidade", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      baseData({
        sample_size: 3,
        avg_revenue_per_hour: 300,
        has_cost_data: true,
        avg_margin_per_hour: 250,
        belongs_to_organization: true,
        sibling_units_count: 2,
        avg_monthly_revenue_per_unit: 20000,
      })
    );

    const { container } = renderWithProviders(<CapitalDecisionPanel />);

    await waitFor(() => expect(screen.getByText(/R\$\s?13\.666,67/)).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});
