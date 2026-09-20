import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { WaitlistPage } from "@/pages/WaitlistPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { Appointment, PaginatedResponse, Patient, Professional, WaitlistEntry } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "p1",
    full_name: "Paciente Espera",
    cpf: null,
    birth_date: null,
    acquisition_source: null,
    ...overrides,
  } as Patient;
}

function makeEntry(overrides: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return {
    id: "w1",
    patient_id: "p1",
    patient_full_name: "Paciente Espera",
    professional_id: null,
    professional_full_name: null,
    procedure_code: null,
    preferred_time_window: null,
    notes: null,
    status: "aguardando",
    resolved_appointment_id: null,
    created_at: "2026-01-01T10:00:00Z",
    resolved_at: null,
    ...overrides,
  };
}

function mockGetByPath(routes: Record<string, unknown>) {
  const sortedRoutes = Object.entries(routes).sort(([a], [b]) => b.length - a.length);
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    for (const [prefix, value] of sortedRoutes) {
      if (path.startsWith(prefix)) return Promise.resolve(value as never);
    }
    return Promise.reject(new Error(`Sem mock para ${path}`));
  });
}

describe("WaitlistPage", () => {
  it("lista as entradas aguardando por padrão, com paciente/profissional/período", async () => {
    const entriesPage: PaginatedResponse<WaitlistEntry> = {
      items: [makeEntry({ preferred_time_window: "manha" }), makeEntry({ id: "w2", professional_full_name: "Dra. Espera" })],
      total: 2,
      limit: 100,
      offset: 0,
    };
    mockGetByPath({
      "/api/v1/waitlist?status=aguardando": entriesPage,
      "/api/v1/patients": [makePatient()],
      "/api/v1/professionals": [],
    });

    renderWithProviders(<WaitlistPage />);

    await waitFor(() => expect(screen.getAllByText("Paciente Espera").length).toBeGreaterThan(0));
    expect(screen.getByText("Manhã")).toBeInTheDocument();
    expect(screen.getByText("Dra. Espera")).toBeInTheDocument();
  });

  it("mensagem honesta quando não há ninguém na lista", async () => {
    const emptyPage: PaginatedResponse<WaitlistEntry> = { items: [], total: 0, limit: 100, offset: 0 };
    mockGetByPath({ "/api/v1/waitlist?status=aguardando": emptyPage });

    renderWithProviders(<WaitlistPage />);

    await waitFor(() => expect(screen.getByText('Nenhuma entrada com status "Aguardando".')).toBeInTheDocument());
  });

  it("adiciona um paciente à lista de espera", async () => {
    const emptyPage: PaginatedResponse<WaitlistEntry> = { items: [], total: 0, limit: 100, offset: 0 };
    mockGetByPath({
      "/api/v1/waitlist?status=aguardando": emptyPage,
      "/api/v1/patients": { items: [makePatient()], total: 1, limit: 200, offset: 0 } as PaginatedResponse<Patient>,
      "/api/v1/professionals": [] as Professional[],
    });
    vi.mocked(apiClient.post).mockResolvedValue(makeEntry());

    renderWithProviders(<WaitlistPage />);
    await waitFor(() => expect(screen.getByText('Nenhuma entrada com status "Aguardando".')).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /adicionar à lista/i }));
    const modalTitle = await screen.findByRole("heading", { name: "Adicionar à lista de espera" });
    const dialog = (modalTitle.closest('[role="dialog"]') ?? modalTitle.parentElement!) as HTMLElement;

    await waitFor(() => expect(within(dialog).getByText("Paciente Espera")).toBeInTheDocument());
    fireEvent.change(within(dialog).getByLabelText(/Paciente/), { target: { value: "p1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Adicionar" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/waitlist", expect.objectContaining({ patient_id: "p1" }))
    );
  });

  it("busca por nome do paciente manda ?search= pro backend (achado da Auditoria v1)", async () => {
    const entriesPage: PaginatedResponse<WaitlistEntry> = { items: [makeEntry()], total: 1, limit: 20, offset: 0 };
    mockGetByPath({
      "/api/v1/waitlist?status=aguardando&search=": entriesPage,
      "/api/v1/patients": [] as Patient[],
      "/api/v1/professionals": [] as Professional[],
    });

    renderWithProviders(<WaitlistPage />);
    await waitFor(() => expect(screen.getByText("Paciente Espera")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Buscar paciente na lista de espera"), { target: { value: "beatriz" } });

    await waitFor(
      () => expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining("search=beatriz")),
      { timeout: 1000 }
    );
  });

  it("cancela uma entrada aguardando", async () => {
    const entriesPage: PaginatedResponse<WaitlistEntry> = { items: [makeEntry()], total: 1, limit: 100, offset: 0 };
    mockGetByPath({
      "/api/v1/waitlist?status=aguardando": entriesPage,
      "/api/v1/patients": [] as Patient[],
      "/api/v1/professionals": [] as Professional[],
    });
    vi.mocked(apiClient.post).mockResolvedValue(makeEntry({ status: "cancelado" }));

    renderWithProviders(<WaitlistPage />);
    await waitFor(() => expect(screen.getByText("Paciente Espera")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/api/v1/waitlist/w1/cancel"));
  });

  it("vincula uma consulta existente e resolve a entrada", async () => {
    const entriesPage: PaginatedResponse<WaitlistEntry> = { items: [makeEntry()], total: 1, limit: 100, offset: 0 };
    const appointment: Appointment = {
      id: "a1",
      patient_id: "p1",
      insurance_plan_id: null,
      professional_id: null,
      scheduled_at: "2026-02-01T10:00:00Z",
      duration_minutes: 30,
      status: "scheduled",
      procedure_code: null,
      cid_code: null,
      no_show_risk_level: null,
      no_show_risk_score: null,
      created_at: "2026-01-01T00:00:00Z",
      booked_at: null,
      visit_type: null,
      cancellation_reason: null,
      booking_channel: null,
      visit_intent_tag: null,
      addon_offered_procedure: null,
      addon_declined: null,
      visit_satisfaction_score: null,
      is_squeeze_in: null,
    };
    mockGetByPath({
      "/api/v1/waitlist?status=aguardando": entriesPage,
      "/api/v1/appointments/by-patient/p1": [appointment],
      "/api/v1/patients": [] as Patient[],
      "/api/v1/professionals": [] as Professional[],
    });
    vi.mocked(apiClient.post).mockResolvedValue(makeEntry({ status: "agendado", resolved_appointment_id: "a1" }));

    renderWithProviders(<WaitlistPage />);
    await waitFor(() => expect(screen.getByText("Paciente Espera")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Vincular consulta" }));
    const modalTitle = await screen.findByRole("heading", { name: "Vincular consulta — Paciente Espera" });
    const dialog = (modalTitle.closest('[role="dialog"]') ?? modalTitle.parentElement!) as HTMLElement;

    await waitFor(() => expect(within(dialog).getByText(/scheduled/)).toBeInTheDocument());
    fireEvent.change(within(dialog).getByLabelText(/Consulta/), { target: { value: "a1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Vincular e marcar/ }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/waitlist/w1/resolve", { appointment_id: "a1" })
    );
  });
});
