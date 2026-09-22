import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ProfitabilityPanel } from "@/components/dashboard/ProfitabilityPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { Profitability } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("ProfitabilityPanel", () => {
  it("lista rentabilidade por profissional e mix por procedimento", async () => {
    const data: Profitability = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      total_billed: 1000,
      by_professional: [
        { professional_id: "p1", full_name: "Dr. Rentável", revenue: 300, booked_minutes: 60, revenue_per_hour: 300, allocated_cost: null, net_margin: null, margin_per_hour: null },
        { professional_id: "p2", full_name: "Dra. Sem Agenda", revenue: 100, booked_minutes: 0, revenue_per_hour: null, allocated_cost: null, net_margin: null, margin_per_hour: null },
      ],
      by_procedure: [
        { procedure_code: "80808080", procedure_name: "Consulta", revenue: 800, billing_count: 2, share_pct: 80 },
        { procedure_code: "90909090", procedure_name: null, revenue: 200, billing_count: 1, share_pct: 20 },
      ],
      has_cost_data: false,
      total_costs: null,
      net_margin: null,
      net_margin_pct: null,
      fixed_cost_pct: null,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<ProfitabilityPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("Dr. Rentável")).toBeInTheDocument());
    expect(screen.getByText("Dra. Sem Agenda")).toBeInTheDocument();
    expect(screen.getByText("Consulta")).toBeInTheDocument();
    expect(screen.getByText("Código TUSS 90909090")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("mensagem honesta quando não há faturamento vinculado a profissional", async () => {
    const data: Profitability = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      total_billed: 0,
      by_professional: [],
      by_procedure: [],
      has_cost_data: false,
      total_costs: null,
      net_margin: null,
      net_margin_pct: null,
      fixed_cost_pct: null,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<ProfitabilityPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() =>
      expect(screen.getByText(/Nenhum faturamento vinculado a um profissional específico/)).toBeInTheDocument()
    );
  });

  it("épico F3.1: mostra margem líquida quando há custo lançado, e link pra lançar quando não há", async () => {
    const withoutCost: Profitability = {
      period_start: "2026-09-01", period_end: "2026-09-07", total_billed: 300,
      by_professional: [
        { professional_id: "p1", full_name: "Dr. Rentável", revenue: 300, booked_minutes: 60, revenue_per_hour: 300, allocated_cost: null, net_margin: null, margin_per_hour: null },
      ],
      by_procedure: [], has_cost_data: false, total_costs: null, net_margin: null,
      net_margin_pct: null, fixed_cost_pct: null,
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce(withoutCost);
    const { unmount } = renderWithProviders(<ProfitabilityPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);
    await waitFor(() => expect(screen.getByText(/nenhum custo.*foi lançado ainda/i)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Lançar custos" })).toHaveAttribute("href", "/custos");
    unmount();

    const withCost: Profitability = {
      period_start: "2026-09-01", period_end: "2026-09-07", total_billed: 300,
      by_professional: [
        { professional_id: "p1", full_name: "Dr. Rentável", revenue: 300, booked_minutes: 60, revenue_per_hour: 300, allocated_cost: 100, net_margin: 200, margin_per_hour: 200 },
      ],
      by_procedure: [], has_cost_data: true, total_costs: 100, net_margin: 200,
      net_margin_pct: 66.7, fixed_cost_pct: null,
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce(withCost);
    renderWithProviders(<ProfitabilityPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);
    await waitFor(() => expect(screen.getByText("Margem líquida do período")).toBeInTheDocument());
    expect(screen.getByText("R$ 200,00")).toBeInTheDocument();
  });

  // "Junta Técnica Insighta" (reavaliação de mercado da Sala de Comando):
  // "nenhuma dessas referências aparece hoje na tela" — cobre as duas
  // faixas de benchmark (margem líquida, custo fixo) aparecendo (ou
  // não, sem amostra) na tela.
  describe("benchmarks de mercado", () => {
    function baseData(overrides: Partial<Profitability> = {}): Profitability {
      return {
        period_start: "2026-09-01",
        period_end: "2026-09-07",
        total_billed: 1000,
        by_professional: [],
        by_procedure: [],
        has_cost_data: false,
        total_costs: null,
        net_margin: null,
        net_margin_pct: null,
        fixed_cost_pct: null,
        ...overrides,
      };
    }

    it("mostra a margem líquida dentro da faixa saudável", async () => {
      vi.mocked(apiClient.get).mockResolvedValue(baseData({ has_cost_data: true, net_margin_pct: 22.5 }));

      renderWithProviders(<ProfitabilityPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

      await waitFor(() => expect(screen.getByText("Como você está frente ao mercado")).toBeInTheDocument());
      expect(screen.getByText("22.5%")).toBeInTheDocument();
      expect(screen.getByText("Dentro da faixa")).toBeInTheDocument();
    });

    it("mostra o custo fixo fora da faixa saudável", async () => {
      vi.mocked(apiClient.get).mockResolvedValue(baseData({ has_cost_data: true, fixed_cost_pct: 75 }));

      renderWithProviders(<ProfitabilityPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

      await waitFor(() => expect(screen.getByText("75.0%")).toBeInTheDocument());
      expect(screen.getByText("Fora da faixa")).toBeInTheDocument();
    });

    it("não mostra a seção de benchmarks quando nenhuma referência tem amostra suficiente", async () => {
      vi.mocked(apiClient.get).mockResolvedValue(baseData());

      renderWithProviders(<ProfitabilityPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

      await waitFor(() =>
        expect(screen.getByText(/Nenhum faturamento vinculado a um profissional específico/)).toBeInTheDocument()
      );
      expect(screen.queryByText("Como você está frente ao mercado")).not.toBeInTheDocument();
    });
  });

  it("não tem violações de acessibilidade", async () => {
    const data: Profitability = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      total_billed: 1000,
      by_professional: [
        { professional_id: "p1", full_name: "Dr. Rentável", revenue: 300, booked_minutes: 60, revenue_per_hour: 300, allocated_cost: null, net_margin: null, margin_per_hour: null },
        { professional_id: "p2", full_name: "Dra. Sem Agenda", revenue: 100, booked_minutes: 0, revenue_per_hour: null, allocated_cost: null, net_margin: null, margin_per_hour: null },
      ],
      by_procedure: [
        { procedure_code: "80808080", procedure_name: "Consulta", revenue: 800, billing_count: 2, share_pct: 80 },
        { procedure_code: "90909090", procedure_name: null, revenue: 200, billing_count: 1, share_pct: 20 },
      ],
      has_cost_data: false,
      total_costs: null,
      net_margin: null,
      net_margin_pct: null,
      fixed_cost_pct: null,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    const { container } = renderWithProviders(<ProfitabilityPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("Dr. Rentável")).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});
