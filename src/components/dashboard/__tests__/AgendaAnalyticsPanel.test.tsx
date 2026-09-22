import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { AgendaAnalyticsPanel } from "@/components/dashboard/AgendaAnalyticsPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { AgendaMetrics, ReturnRate } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const EMPTY_RETURN_RATE: ReturnRate = {
  period_start: "2026-09-01",
  period_end: "2026-09-07",
  return_rate: null,
  return_count: 0,
  first_visit_count: 0,
  untagged_count: 0,
};

function mockAgendaMetrics(data: AgendaMetrics) {
  vi.mocked(apiClient.get).mockImplementation((url: string) =>
    url.includes("/return-rate") ? Promise.resolve(EMPTY_RETURN_RATE) : Promise.resolve(data)
  );
}

const BASE_METRICS: AgendaMetrics = {
  period_start: "2026-09-01",
  period_end: "2026-09-07",
  professionals: [],
  peak_hours: [],
  weekday_histogram: [],
  weekday_no_show_rates: [],
  weekday_cancellation_rates: [],
  weekday_squeeze_in_rates: [],
  no_show_risk_breakdown: [],
  estimated_revenue_at_risk: 0,
  patient_no_show_ranking: [],
  upcoming_risk_appointments: [],
  total_idle_minutes: 0,
  estimated_revenue_lost_to_idle_capacity: 0,
  professionals_without_availability_count: 0,
};

describe("AgendaAnalyticsPanel", () => {
  it("mostra o gráfico de taxa de cancelamento por dia da semana quando há dado", async () => {
    const data: AgendaMetrics = {
      ...BASE_METRICS,
      weekday_cancellation_rates: [
        { weekday: 1, cancellation_count: 2, total_appointments: 5, cancellation_rate: 0.4 },
      ],
    };
    mockAgendaMetrics(data);

    renderWithProviders(<AgendaAnalyticsPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("Taxa de cancelamento por dia da semana")).toBeInTheDocument());
  });

  it("mostra o gráfico de taxa de encaixe por dia da semana quando há dado", async () => {
    const data: AgendaMetrics = {
      ...BASE_METRICS,
      weekday_squeeze_in_rates: [{ weekday: 2, squeeze_in_count: 1, total_informed: 4, squeeze_in_rate: 0.25 }],
    };
    mockAgendaMetrics(data);

    renderWithProviders(<AgendaAnalyticsPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("Taxa de encaixe por dia da semana")).toBeInTheDocument());
  });

  it("mensagem honesta quando não há atendimento com desfecho conhecido", async () => {
    mockAgendaMetrics(BASE_METRICS);

    renderWithProviders(<AgendaAnalyticsPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() =>
      expect(
        screen.getByText(/Sem atendimentos com desfecho conhecido nesta janela para calcular taxa de cancelamento/)
      ).toBeInTheDocument()
    );
  });

  it("não tem violações de acessibilidade", async () => {
    const data: AgendaMetrics = {
      ...BASE_METRICS,
      weekday_cancellation_rates: [
        { weekday: 1, cancellation_count: 2, total_appointments: 5, cancellation_rate: 0.4 },
      ],
    };
    mockAgendaMetrics(data);

    const { container } = renderWithProviders(<AgendaAnalyticsPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("Taxa de cancelamento por dia da semana")).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});
