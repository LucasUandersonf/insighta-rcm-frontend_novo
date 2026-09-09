import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { ExecutiveAgendaSummary } from "@/components/dashboard/ExecutiveAgendaSummary";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { AgendaMetrics } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

function baseMetrics(overrides: Partial<AgendaMetrics> = {}): AgendaMetrics {
  return {
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
    ...overrides,
  };
}

describe("ExecutiveAgendaSummary", () => {
  it("aponta o dia mais fraco quando a diferença é grande — antes esta seção não tinha nenhuma frase", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      baseMetrics({
        // Segunda(1)/Terça(2).../Sábado(6)/Domingo(0) — terça bem abaixo do resto.
        weekday_histogram: [
          { weekday: 1, appointment_count: 20 },
          { weekday: 2, appointment_count: 4 },
          { weekday: 3, appointment_count: 18 },
          { weekday: 4, appointment_count: 22 },
          { weekday: 5, appointment_count: 19 },
        ],
      })
    );

    renderWithProviders(<ExecutiveAgendaSummary dateFrom="2026-01-01" dateTo="2026-01-07" />);

    expect(await screen.findByText(/Terça-feira costuma ser seu dia mais fraco/)).toBeInTheDocument();
  });

  it("sem diferença grande entre dias, não inventa um 'dia mais fraco'", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      baseMetrics({
        weekday_histogram: [
          { weekday: 1, appointment_count: 10 },
          { weekday: 2, appointment_count: 9 },
        ],
      })
    );

    renderWithProviders(<ExecutiveAgendaSummary dateFrom="2026-01-01" dateTo="2026-01-07" />);

    expect(await screen.findByText("19 consultas")).toBeInTheDocument();
    expect(screen.queryByText(/costuma ser seu dia mais fraco/)).not.toBeInTheDocument();
  });

  it("avisa quando algum profissional está com a agenda bem mais livre que o normal", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      baseMetrics({
        professionals: [
          {
            professional_id: "p1",
            full_name: "Dra. Livre",
            utilization_rate: 0.3,
            no_show_rate: 0,
            available_minutes: 1000,
            booked_minutes: 300,
            total_appointments: 5,
          },
        ],
      })
    );

    renderWithProviders(<ExecutiveAgendaSummary dateFrom="2026-01-01" dateTo="2026-01-07" />);

    expect(await screen.findByText(/agenda bem mais livre que o normal/)).toBeInTheDocument();
  });

  it("mensagem honesta quando ninguém tem risco relevante de falta", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(baseMetrics());

    renderWithProviders(<ExecutiveAgendaSummary dateFrom="2026-01-01" dateTo="2026-01-07" />);

    expect(await screen.findByText(/pode ficar tranquilo/)).toBeInTheDocument();
  });
});
