import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppointmentsPage } from "@/pages/AppointmentsPage";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";
import type { Appointment, CurrentUser, Local, Patient } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), patch: vi.fn() } };
});

// AppointmentsPage usa useAuth() pra decidir se mostra o botão de
// anonimização LGPD (admin/owner apenas) — AuthContext não é montado de
// verdade nos testes de página (ver DECISÃO em test/utils.tsx).
vi.mock("@/context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/AuthContext")>();
  return { ...actual, useAuth: vi.fn() };
});

function mockUser(role: CurrentUser["role"] = "owner") {
  vi.mocked(useAuth).mockReturnValue({
    user: { tenant_id: "t1", id: "u1", role } as unknown as CurrentUser,
  } as unknown as ReturnType<typeof useAuth>);
}

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "p1",
    full_name: "Maria da Silva",
    cpf: null,
    birth_date: null,
    acquisition_source: null,
    created_at: "2026-01-01T00:00:00Z",
    anonymized_at: null,
    referred_by_patient_id: null,
    communication_consent: null,
    preferred_time_window: null,
    zip_code: null,
    is_vip: false,
    vip_reasons: [],
    ...overrides,
  };
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "a1",
    patient_id: "p1",
    insurance_plan_id: null,
    professional_id: null,
    local_id: null,
    tipo_paciente: null,
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
    visit_satisfaction_score: null,
    addon_offered_procedure: null,
    addon_declined: null,
    is_squeeze_in: null,
    ...overrides,
  };
}

function mockGet(patients: Patient[], appointments: Appointment[] = [], locais: Local[] = []) {
  mockUser();
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path.startsWith("/api/v1/patients")) return Promise.resolve({ items: patients, total: patients.length, limit: 200, offset: 0 } as never);
    if (path.startsWith("/api/v1/professionals")) return Promise.resolve([] as never);
    if (path.startsWith("/api/v1/locais")) return Promise.resolve(locais as never);
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

// "Equilíbrio Insighta" (Balanced Scorecard, perna Cliente, mecanismo 1)
// — a recepção precisa ver o selo de paciente de alto valor no exato
// momento de marcar a consulta, não só depois de criar (ver DECISÃO em
// PatientService.list_patients_paginated, backend).
describe("AppointmentsPage — aviso de paciente de alto valor (VIP)", () => {
  it("marca o paciente VIP na lista e mostra o motivo assim que ele é selecionado", async () => {
    mockGet([
      makePatient({ id: "p1", full_name: "Maria VIP", is_vip: true, vip_reasons: ["frequente", "indicou outros pacientes"] }),
      makePatient({ id: "p2", full_name: "João Comum", is_vip: false, vip_reasons: [] }),
    ]);
    const user = userEvent.setup();

    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Nova consulta/ })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: /Nova consulta/ }));

    const dialog = screen.getByRole("dialog");
    const patientSelect = await within(dialog).findByLabelText(/^Paciente/);
    expect(within(dialog).getByRole("option", { name: "Maria VIP ★ VIP" })).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: "João Comum" })).toBeInTheDocument();
    expect(within(dialog).queryByText(/Paciente de alto valor/)).not.toBeInTheDocument();

    await user.selectOptions(patientSelect, "p1");
    expect(
      await within(dialog).findByText(/Paciente de alto valor \(frequente, indicou outros pacientes\)/)
    ).toBeInTheDocument();

    await user.selectOptions(patientSelect, "p2");
    await waitFor(() => expect(within(dialog).queryByText(/Paciente de alto valor/)).not.toBeInTheDocument());
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
        local_id: null,
        tipo_paciente: null,
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

// "Mapa de Dados Insighta" — Domínio Pós-atendimento (Onda 2): link
// público de avaliação de satisfação — ver DECISÃO em
// 052_appointment_satisfaction.sql (backend).
describe("AppointmentsPage — link de avaliação de satisfação", () => {
  it("gera e mostra o link só para consultas já realizadas, com botão de copiar", async () => {
    mockGet([makePatient()], [makeAppointment({ status: "completed" })]);
    vi.mocked(apiClient.post).mockResolvedValue({
      url: "https://app.insighta.com/satisfacao/abc123",
      expires_at: "2026-06-15T10:00:00Z",
    });
    const user = userEvent.setup();
    // @testing-library/user-event instala seu próprio stub de
    // navigator.clipboard em userEvent.setup() (para suportar
    // user.paste()) — substitui QUALQUER mock feito antes disso, então
    // o spy precisa vir DEPOIS, em cima do stub que ele mesmo instalou.
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByLabelText("Ver consultas do paciente")).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText("Ver consultas do paciente"), "p1");

    await user.click(await screen.findByRole("button", { name: /Link de avaliação/ }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/api/v1/appointments/a1/satisfaction-link"));
    expect(await screen.findByDisplayValue("https://app.insighta.com/satisfacao/abc123")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Copiar/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://app.insighta.com/satisfacao/abc123"));
  });

  it("não mostra o botão de link para uma consulta que ainda não foi realizada", async () => {
    mockGet([makePatient()], [makeAppointment({ status: "scheduled" })]);
    const user = userEvent.setup();

    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByLabelText("Ver consultas do paciente")).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText("Ver consultas do paciente"), "p1");

    expect(await screen.findByText("Registrar atendimento")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Link de avaliação/ })).not.toBeInTheDocument();
  });

  it("mostra a nota já registrada em vez do botão de gerar link", async () => {
    mockGet([makePatient()], [makeAppointment({ status: "completed", visit_satisfaction_score: 4 })]);
    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByLabelText("Ver consultas do paciente")).not.toBeDisabled());
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Ver consultas do paciente"), "p1");

    expect(await screen.findByText("4/5")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Link de avaliação/ })).not.toBeInTheDocument();
  });
});

// Fase 4 do plano de adequação ao fluxo real de mercado (Agendamento ->
// Atendimento -> Faturamento) — ver DECISÃO em
// app/sql/018_locais_tipo_paciente.sql (backend): local_id/tipo_paciente
// já existiam prontos no schema de Appointment, mas nenhum formulário
// os oferecia.
describe("AppointmentsPage — Local e Tipo de paciente (Fase 4)", () => {
  const locais: Local[] = [{ id: "local-1", nome: "Unidade Centro", is_active: true, created_at: "2026-01-01T00:00:00Z" }];

  it("envia local_id e tipo_paciente ao agendar uma nova consulta", async () => {
    mockGet([makePatient()], [], locais);
    vi.mocked(apiClient.post).mockResolvedValue({ id: "a1", patient_id: "p1", no_show_risk_level: null });
    const user = userEvent.setup();

    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Nova consulta/ })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: /Nova consulta/ }));

    await user.selectOptions(await screen.findByLabelText(/Paciente/), "p1");
    await user.type(screen.getByLabelText(/Data e horário/), "2026-06-01T10:00");
    await user.selectOptions(screen.getByLabelText(/^Local/), "local-1");
    await user.selectOptions(screen.getByLabelText(/Tipo de paciente/), "pronto_socorro");

    await user.click(screen.getByRole("button", { name: "Agendar consulta" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/appointments",
        expect.objectContaining({ local_id: "local-1", tipo_paciente: "pronto_socorro" })
      )
    );
  });

  it("edita local_id e tipo_paciente ao registrar o atendimento", async () => {
    mockGet([makePatient()], [makeAppointment()], locais);
    vi.mocked(apiClient.patch).mockResolvedValue(makeAppointment());
    const user = userEvent.setup();

    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByLabelText("Ver consultas do paciente")).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText("Ver consultas do paciente"), "p1");
    await user.click(await screen.findByRole("button", { name: /Registrar atendimento/ }));

    await user.selectOptions(await screen.findByLabelText(/^Local/), "local-1");
    await user.selectOptions(screen.getByLabelText(/Tipo de paciente/), "ambulatorial");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/api/v1/appointments/a1",
        expect.objectContaining({ local_id: "local-1", tipo_paciente: "ambulatorial" })
      )
    );
  });
});

// Direito de eliminação do titular (LGPD art. 18, VI) — ver DECISÃO em
// PatientService.anonymize_patient (backend): admin/owner apenas,
// irreversível, com confirmação explícita.
describe("AppointmentsPage — anonimização de paciente (LGPD)", () => {
  it("admin/owner vê o botão, confirma e chama POST /patients/{id}/anonymize", async () => {
    mockGet([makePatient({ id: "p1", full_name: "Paciente LGPD" })]);
    mockUser("admin");
    vi.mocked(apiClient.post).mockResolvedValue(makePatient({ anonymized_at: "2026-06-01T00:00:00Z" }));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByLabelText("Ver consultas do paciente")).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText("Ver consultas do paciente"), "p1");

    await user.click(await screen.findByRole("button", { name: /Anonimizar/ }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Paciente LGPD"));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/api/v1/patients/p1/anonymize"));
  });

  it("não anonimiza se o usuário cancelar a confirmação", async () => {
    // Limpa o histórico de chamadas dos testes anteriores — este arquivo
    // não usa clearMocks global (vite.config.ts), o spy é compartilhado
    // entre todos os testes do describe.
    vi.mocked(apiClient.post).mockClear();
    mockGet([makePatient()]);
    mockUser("owner");
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();

    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByLabelText("Ver consultas do paciente")).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText("Ver consultas do paciente"), "p1");

    await user.click(await screen.findByRole("button", { name: /Anonimizar/ }));

    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("atendimento não vê o botão de anonimizar", async () => {
    mockGet([makePatient()]);
    mockUser("atendimento");
    const user = userEvent.setup();

    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByLabelText("Ver consultas do paciente")).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText("Ver consultas do paciente"), "p1");

    expect(screen.queryByRole("button", { name: /Anonimizar/ })).not.toBeInTheDocument();
  });

  it("um paciente já anonimizado mostra a data em vez do botão", async () => {
    mockGet([makePatient({ anonymized_at: "2026-06-01T00:00:00Z" })]);
    mockUser("owner");
    const user = userEvent.setup();

    renderWithProviders(<AppointmentsPage />);
    await waitFor(() => expect(screen.getByLabelText("Ver consultas do paciente")).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText("Ver consultas do paciente"), "p1");

    expect(await screen.findByText(/Paciente anonimizado em/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Anonimizar/ })).not.toBeInTheDocument();
  });
});
