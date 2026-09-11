import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExecutiveAgendaSummary } from "@/components/dashboard/ExecutiveAgendaSummary";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { AgendaMetrics, AppointmentListItem, PaginatedResponse, RecallCandidates } from "@/lib/types";

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

  it("foco por dia da semana filtra o risco de falta e mostra os candidatos a recontato daquele dia", async () => {
    const sameWeekdayAppt = { appointment_id: "a1", patient_full_name: "Do Dia Focado", scheduled_at: "2026-01-14T12:00:00Z", risk_level: "alto" as const };
    const otherWeekdayAppt = {
      appointment_id: "a2",
      patient_full_name: "De Outro Dia",
      // 7 dias depois cai no mesmo dia da semana — usa 3 dias depois pra
      // garantir um dia da semana DIFERENTE independente do fuso do runner.
      scheduled_at: "2026-01-17T12:00:00Z",
      risk_level: "alto" as const,
    };
    const focusedWeekday = new Date(sameWeekdayAppt.scheduled_at).getDay();
    const recallData: RecallCandidates = {
      total_count: 1,
      weekday: focusedWeekday,
      professional_id: null,
      professional_name: null,
      items: [{ patient_id: "p1", full_name: "Costumava Vir Nesse Dia", last_appointment_at: "2025-12-01T00:00:00Z", days_since_last_appointment: 44, last_professional_name: null }],
    };
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("recall-candidates")) return Promise.resolve(recallData as never);
      return Promise.resolve(baseMetrics({ upcoming_risk_appointments: [sameWeekdayAppt, otherWeekdayAppt] }) as never);
    });

    renderWithProviders(
      <ExecutiveAgendaSummary dateFrom="2026-01-01" dateTo="2026-01-07" focus={{ type: "weekday", weekday: focusedWeekday }} />
    );

    expect(await screen.findByText("Do Dia Focado")).toBeInTheDocument();
    expect(screen.queryByText("De Outro Dia")).not.toBeInTheDocument();
    expect(await screen.findByText("Costumava Vir Nesse Dia")).toBeInTheDocument();
  });

  it("foco por profissional mostra o nome do profissional no título dos candidatos", async () => {
    const recallData: RecallCandidates = {
      total_count: 1,
      weekday: null,
      professional_id: "prof-1",
      professional_name: "Dra. Ana",
      items: [{ patient_id: "p1", full_name: "Paciente Da Dra. Ana", last_appointment_at: "2025-12-01T00:00:00Z", days_since_last_appointment: 20, last_professional_name: "Dra. Ana" }],
    };
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("recall-candidates")) return Promise.resolve(recallData as never);
      return Promise.resolve(baseMetrics() as never);
    });

    renderWithProviders(
      <ExecutiveAgendaSummary dateFrom="2026-01-01" dateTo="2026-01-07" focus={{ type: "professional", professionalId: "prof-1" }} />
    );

    expect(await screen.findByText("Candidatos a recontato — agenda de Dra. Ana")).toBeInTheDocument();
    expect(screen.getByText("Paciente Da Dra. Ana")).toBeInTheDocument();
  });

  it("botão de fechar do card de candidatos chama onClearFocus", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("recall-candidates")) return Promise.resolve({ total_count: 0, weekday: 3, professional_id: null, professional_name: null, items: [] } as never);
      return Promise.resolve(baseMetrics() as never);
    });
    const onClearFocus = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <ExecutiveAgendaSummary dateFrom="2026-01-01" dateTo="2026-01-07" focus={{ type: "weekday", weekday: 3 }} onClearFocus={onClearFocus} />
    );

    const closeButton = await screen.findByRole("button", { name: "Fechar candidatos a recontato" });
    await user.click(closeButton);
    await waitFor(() => expect(onClearFocus).toHaveBeenCalled());
  });

  // Achado 12 da Auditoria de Templates e Insights ("O que resta em
  // aberto"): os insights de canal de agendamento/motivo de
  // cancelamento apontavam pra "#agenda-resumo", mas essa seção não
  // tinha nenhuma tela listando agendamentos individuais com esses
  // campos. Os 3 testes abaixo cobrem o painel "Agendamentos do
  // período" (AppointmentListPanel) que fecha essa lacuna.
  function appointmentsPage(overrides: Partial<PaginatedResponse<AppointmentListItem>> = {}): PaginatedResponse<AppointmentListItem> {
    return { items: [], total: 0, limit: 10, offset: 0, ...overrides };
  }

  it("lista agendamentos do período com canal de agendamento e motivo de cancelamento", async () => {
    const item: AppointmentListItem = {
      id: "a1",
      patient_name: "Paciente Canal",
      scheduled_at: "2026-01-05T14:00:00Z",
      status: "no_show",
      procedure_code: null,
      visit_type: null,
      booking_channel: "whatsapp",
      cancellation_reason: null,
    };
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/api/v1/appointments?")) return Promise.resolve(appointmentsPage({ items: [item], total: 1 }) as never);
      return Promise.resolve(baseMetrics() as never);
    });

    renderWithProviders(<ExecutiveAgendaSummary dateFrom="2026-01-01" dateTo="2026-01-07" />);

    expect(await screen.findByText("Agendamentos do período")).toBeInTheDocument();
    expect(await screen.findByText("Paciente Canal")).toBeInTheDocument();
    expect(screen.getByText("Faltou")).toBeInTheDocument();
    expect(screen.getByText("whatsapp")).toBeInTheDocument();
  });

  it("mostra travessão quando não há motivo de cancelamento registrado", async () => {
    const item: AppointmentListItem = {
      id: "a1",
      patient_name: "Paciente Sem Motivo",
      scheduled_at: "2026-01-05T14:00:00Z",
      status: "scheduled",
      procedure_code: null,
      visit_type: null,
      booking_channel: null,
      cancellation_reason: null,
    };
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/api/v1/appointments?")) return Promise.resolve(appointmentsPage({ items: [item], total: 1 }) as never);
      return Promise.resolve(baseMetrics() as never);
    });

    renderWithProviders(<ExecutiveAgendaSummary dateFrom="2026-01-01" dateTo="2026-01-07" />);

    await screen.findByText("Paciente Sem Motivo");
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2); // canal e motivo, ambos nulos
  });

  it("período vazio mostra o estado vazio, não uma tabela em branco", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/api/v1/appointments?")) return Promise.resolve(appointmentsPage() as never);
      return Promise.resolve(baseMetrics() as never);
    });

    renderWithProviders(<ExecutiveAgendaSummary dateFrom="2026-01-01" dateTo="2026-01-07" />);

    expect(await screen.findByText("Nenhum agendamento nesse período.")).toBeInTheDocument();
  });
});
