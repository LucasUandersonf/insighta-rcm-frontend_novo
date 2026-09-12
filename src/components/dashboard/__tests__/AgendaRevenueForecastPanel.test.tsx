import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { AgendaRevenueForecastPanel } from "@/components/dashboard/AgendaRevenueForecastPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { AgendaRevenueForecast } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

// Previsão de receita futura da agenda — pedido direto do usuário: "a
// receita da agenda... conseguimos tirar metade do faturamento futuro
// da clínica". Estes testes cobrem os 3 baldes separados nunca virando
// um único número (ver DECISÃO no componente e no backend).
describe("AgendaRevenueForecastPanel", () => {
  it("mostra a receita esperada em destaque e os baldes de sem-histórico/sem-preço à parte", async () => {
    const data: AgendaRevenueForecast = {
      period_start: "2026-09-12",
      period_end: "2026-09-25",
      total_scheduled_count: 3,
      total_scheduled_value: 400,
      known_risk_count: 1,
      known_risk_value: 200,
      expected_value: 160,
      unrated_count: 1,
      unrated_value: 200,
      unpriced_count: 1,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<AgendaRevenueForecastPanel />);

    await waitFor(() => expect(screen.getByText(/R\$\s*160,00/)).toBeInTheDocument());
    expect(screen.getByText(/1 agendamento com histórico calculado/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*200,00/)).toBeInTheDocument();
    expect(screen.getByText(/sem histórico ainda/)).toBeInTheDocument();
    expect(screen.getByText(/1 agendamento sem preço de contrato encontrado ainda/)).toBeInTheDocument();
  });

  it("mensagem honesta quando não há nenhum agendamento futuro no período", async () => {
    const data: AgendaRevenueForecast = {
      period_start: "2026-09-12",
      period_end: "2026-09-25",
      total_scheduled_count: 0,
      total_scheduled_value: 0,
      known_risk_count: 0,
      known_risk_value: 0,
      expected_value: 0,
      unrated_count: 0,
      unrated_value: 0,
      unpriced_count: 0,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<AgendaRevenueForecastPanel />);

    await waitFor(() =>
      expect(screen.getByText("Nenhum agendamento futuro nesse período ainda.")).toBeInTheDocument()
    );
  });
});
