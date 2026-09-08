import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExecutiveOverviewPage } from "@/pages/ExecutiveOverviewPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

/**
 * Mock genérico por URL — a Sala de Comando 2.0 busca vários endpoints
 * ao mesmo tempo (executive-summary, smart-insights, health-score,
 * agenda-metrics, network-benchmark); este teste foca na ESTRUTURA de
 * abas, não no conteúdo detalhado de cada painel (já coberto pelos
 * testes próprios de HealthScoreWidget/NetworkBenchmarkPanel/SimuladorPanel).
 */
function mockAllEndpoints() {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url.includes("executive-summary")) {
      return Promise.resolve({
        total_billed: { value: 1000, delta_pct: null },
        total_value_saved: { value: 0, delta_pct: null },
        financial_hole: { value: 0, delta_pct: null },
        payment_gap: { value: 0, delta_pct: null },
        margin_vs_contracted_pct: null,
        avg_capacity_utilization: null,
        high_risk_pending_count: 0,
        appeals_due_soon_count: 0,
        denial_risk_pct: null,
        denial_at_risk_value: 0,
      } as never);
    }
    if (url.includes("smart-insights")) {
      return Promise.resolve({ period_start: "2026-01-01", period_end: "2026-01-07", insights: [] } as never);
    }
    if (url.includes("health-score")) {
      return Promise.resolve({ score: null, window_days: 90, components: [] } as never);
    }
    if (url.includes("agenda-metrics")) {
      return Promise.resolve({
        period_start: "2026-01-01",
        period_end: "2026-01-07",
        professionals: [],
        peak_hours: [],
        weekday_histogram: [],
        weekday_no_show_rates: [],
        no_show_risk_breakdown: [],
        estimated_revenue_at_risk: 0,
        patient_no_show_ranking: [],
        upcoming_risk_appointments: [],
        total_idle_minutes: 0,
        estimated_revenue_lost_to_idle_capacity: 0,
        professionals_without_availability_count: 0,
      } as never);
    }
    if (url.includes("network-benchmark")) {
      return Promise.resolve({ window_days: 90, metrics: [] } as never);
    }
    if (url.includes("/users/me")) {
      return Promise.resolve(null as never);
    }
    return Promise.reject(new Error(`URL não mockada: ${url}`));
  });
}

describe("ExecutiveOverviewPage", () => {
  it("abre na aba Diagnóstico e troca para Oportunidades/Comparativo/Simulador ao clicar", async () => {
    mockAllEndpoints();
    const user = userEvent.setup();
    renderWithProviders(<ExecutiveOverviewPage />);

    expect(await screen.findByText("Agenda & Capacidade Operacional")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Oportunidades/ }));
    await waitFor(() => expect(screen.getByText(/Em construção/)).toBeInTheDocument());

    await user.click(screen.getByRole("tab", { name: /Comparativo/ }));
    await waitFor(() => expect(screen.queryByText("Agenda & Capacidade Operacional")).not.toBeInTheDocument());

    await user.click(screen.getByRole("tab", { name: /Simulador/ }));
    await waitFor(() => expect(screen.getByText(/Ajuste os cenários/)).toBeInTheDocument());
  });
});
