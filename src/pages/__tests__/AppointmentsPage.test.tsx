import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppointmentsPage } from "@/pages/AppointmentsPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { Appointment, Patient } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), patch: vi.fn() } };
});

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "p1",
    full_name: "Maria da Silva",
    cpf: null,
    birth_date: null,
    acquisition_source: null,
    created_at: "2026-01-01T00:00:00Z",
    referred_by_patient_id: null,
    communication_consent: null,
    preferred_time_window: null,
    zip_code: null,
    ...overrides,
  };
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "a1",
    patient_id: "p1",
    insurance_plan_id: null,
    professional_id: null,
    scheduled_at: "2026-06-01T10:00:00Z",
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
    ...overrides,
  };
}

function mockGet(patients: Patient[], appointments: Appointment[] = []) {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path.startsWith("/api/v1/patients")) return Promise.resolve({ items: patients, total: patients.length, limit: 200, offset: 0 } as never);
    if (path.startsWith("/api/v1/professionals")) return Promise.resolve([] as never);
    if (path.startsWith("/api/v1/appointments/by-patient")) return Promise.resolve(appointments as never);
    return Promise.reject(new Error(`Sem mock para ${path}`));
  });
}

// "Mapa de Dados Insighta" — Domínio Paciente (Onda 1): não existia
// nenhuma tela de cadastro manual de paciente; estes testes cobrem o
// ponto de captura novo (cadastro + edição de contato) junto do
// seletor de paciente já existente nesta página.
describe("AppointmentsPage — cadastro e edição de dados do paciente", () => {
  it("cadastra um novo paciente com os campos relacionais e seleciona ele na lista", async () => {
    mockGet([makePatient({ id: "existing", full_name: "Paciente Existente" })]);
    vi.mocked(apiClient.post).mockResolvedValue(makePatient({ id: "new-1", full_name: "Paciente Novo" }));
    const user = userEvent.setup();

    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Novo paciente/ })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: /Novo paciente/ }));

    // Regex, não string exata: TextField com `required` acrescenta um
    // "*" dentro do próprio <label>, então o nome acessível de verdade
    // é "Nome completo *", não "Nome completo".
    await user.type(await screen.findByLabelText(/Nome completo/), "Paciente Novo");
    await user.selectOptions(screen.getByLabelText(/Quem indicou/), "existing");
    await user.selectOptions(screen.getByLabelText(/Horário preferido/), "manha");
    await user.type(screen.getByLabelText(/CEP/), "01310100");
    await user.click(screen.getByLabelText(/autoriza contato/i));

    await user.click(screen.getByRole("button", { name: "Cadastrar paciente" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/patients", {
        full_name: "Paciente Novo",
        cpf: null,
        referred_by_patient_id: "existing",
        communication_consent: true,
        preferred_time_window: "manha",
        zip_code: "01310100",
      })
    );
  });

  it("edita os dados de contato de um paciente já existente via PATCH", async () => {
    mockGet([makePatient()]);
    vi.mocked(apiClient.patch).mockResolvedValue(makePatient());
    const user = userEvent.setup();

    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByLabelText("Ver consultas do paciente")).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText("Ver consultas do paciente"), "p1");

    await user.click(await screen.findByRole("button", { name: /Dados de contato/ }));
    await user.selectOptions(await screen.findByLabelText(/Autoriza contato/), "true");

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/patients/p1", {
        referred_by_patient_id: null,
        communication_consent: true,
        preferred_time_window: null,
        zip_code: null,
      })
    );
  });

  it("o botão 'Dados de contato' só aparece depois de um paciente ser selecionado", async () => {
    mockGet([makePatient()]);
    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByLabelText("Ver consultas do paciente")).not.toBeDisabled());
    expect(screen.queryByRole("button", { name: /Dados de contato/ })).not.toBeInTheDocument();
  });
});

// "Mapa de Dados Insighta" — Domínio Pós-atendimento (Onda 1): motivo
// estruturado do agendamento.
describe("AppointmentsPage — nova consulta com motivo estruturado", () => {
  it("envia visit_intent_tag ao agendar uma nova consulta", async () => {
    mockGet([makePatient()]);
    vi.mocked(apiClient.post).mockResolvedValue({ id: "a1", patient_id: "p1", no_show_risk_level: null });
    const user = userEvent.setup();

    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Nova consulta/ })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: /Nova consulta/ }));

    await user.selectOptions(await screen.findByLabelText(/Paciente/), "p1");
    await user.type(screen.getByLabelText(/Data e horário/), "2026-06-01T10:00");
    await user.selectOptions(screen.getByLabelText(/Motivo do agendamento/), "urgencia");

    await user.click(screen.getByRole("button", { name: "Agendar consulta" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/appointments",
        expect.objectContaining({ visit_intent_tag: "urgencia" })
      )
    );
  });
});

// "Mapa de Dados Insighta" — Domínio Pós-atendimento (Onda 2): fecha a
// lacuna de UI do PATCH /appointments/{id} (status/procedimento/CID) e
// captura o funil de upsell do checkout (addon_offered_procedure/
// addon_declined) — ver DECISÃO em 050_appointment_addon_upsell.sql.
describe("AppointmentsPage — registrar atendimento (checkout + funil de upsell)", () => {
  it("registra status, procedimento/CID e uma oferta de upsell aceita", async () => {
    mockGet([makePatient()], [makeAppointment()]);
    vi.mocked(apiClient.patch).mockResolvedValue(makeAppointment());
    const user = userEvent.setup();

    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByLabelText("Ver consultas do paciente")).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText("Ver consultas do paciente"), "p1");

    await user.click(await screen.findByRole("button", { name: /Registrar atendimento/ }));

    await user.selectOptions(await screen.findByLabelText("Status"), "completed");
    await user.type(screen.getByLabelText(/Código do procedimento/), "10101012");
    await user.type(screen.getByLabelText(/CID/), "J06");
    await user.type(screen.getByLabelText(/oferecido no checkout/), "Limpeza de pele");
    await user.selectOptions(screen.getByLabelText(/Resultado da oferta/), "aceito");

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/appointments/a1", {
        status: "completed",
        procedure_code: "10101012",
        cid_code: "J06",
        addon_offered_procedure: "Limpeza de pele",
        addon_declined: false,
      })
    );
  });

  it("registra uma oferta de upsell recusada", async () => {
    mockGet([makePatient()], [makeAppointment()]);
    vi.mocked(apiClient.patch).mockResolvedValue(makeAppointment());
    const user = userEvent.setup();

    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByLabelText("Ver consultas do paciente")).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText("Ver consultas do paciente"), "p1");
    await user.click(await screen.findByRole("button", { name: /Registrar atendimento/ }));

    await user.type(await screen.findByLabelText(/oferecido no checkout/), "Drenagem linfática");
    await user.selectOptions(screen.getByLabelText(/Resultado da oferta/), "recusado");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/api/v1/appointments/a1",
        expect.objectContaining({ addon_offered_procedure: "Drenagem linfática", addon_declined: true })
      )
    );
  });

  it("o resultado da oferta fica desabilitado até um procedimento oferecido ser digitado", async () => {
    mockGet([makePatient()], [makeAppointment()]);
    const user = userEvent.setup();

    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByLabelText("Ver consultas do paciente")).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText("Ver consultas do paciente"), "p1");
    await user.click(await screen.findByRole("button", { name: /Registrar atendimento/ }));

    expect(await screen.findByLabelText(/Resultado da oferta/)).toBeDisabled();
    await user.type(screen.getByLabelText(/oferecido no checkout/), "Bota de pressoterapia");
    expect(screen.getByLabelText(/Resultado da oferta/)).not.toBeDisabled();
  });

  it("pré-preenche o formulário com os dados já salvos do agendamento", async () => {
    mockGet(
      [makePatient()],
      [makeAppointment({ status: "completed", procedure_code: "10101012", addon_offered_procedure: "Peeling", addon_declined: true })]
    );
    const user = userEvent.setup();

    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByLabelText("Ver consultas do paciente")).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText("Ver consultas do paciente"), "p1");
    await user.click(await screen.findByRole("button", { name: /Registrar atendimento/ }));

    expect(await screen.findByLabelText("Status")).toHaveValue("completed");
    expect(screen.getByLabelText(/Código do procedimento/)).toHaveValue("10101012");
    expect(screen.getByLabelText(/oferecido no checkout/)).toHaveValue("Peeling");
    expect(screen.getByLabelText(/Resultado da oferta/)).toHaveValue("recusado");
  });
});
