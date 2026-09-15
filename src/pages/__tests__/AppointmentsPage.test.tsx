import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppointmentsPage } from "@/pages/AppointmentsPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { Patient } from "@/lib/types";

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

function mockGet(patients: Patient[]) {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path.startsWith("/api/v1/patients")) return Promise.resolve({ items: patients, total: patients.length, limit: 200, offset: 0 } as never);
    if (path.startsWith("/api/v1/professionals")) return Promise.resolve([] as never);
    if (path.startsWith("/api/v1/appointments/by-patient")) return Promise.resolve([] as never);
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
