import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PatientFichaPage } from "@/pages/PatientFichaPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { PatientFicha, PatientSearchItem } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

function ficha(overrides: Partial<PatientFicha> = {}): PatientFicha {
  return {
    patient: { id: "p1", full_name: "Carlos Andrade", cpf: "98765432100", birth_date: null, acquisition_source: null, created_at: "2026-01-01T00:00:00Z" },
    summary: {
      total_appointments: 1,
      no_show_count: 0,
      no_show_rate: 0,
      total_billed: 200,
      total_value_saved: 0,
      last_visit_at: "2026-01-05T10:00:00Z",
    },
    appointments: [
      {
        id: "a1",
        scheduled_at: "2026-01-05T10:00:00Z",
        status: "completed",
        professional_name: "Dra. Ana",
        insurance_plan_name: "Unimed",
        no_show_risk_level: "baixo",
        billings: [{ id: "b1", charged_value: 200, status: "paid", denial_risk_level: "low", created_at: "2026-01-05T10:00:00Z" }],
      },
    ],
    ...overrides,
  };
}

describe("PatientFichaPage", () => {
  it("sem patient_id na URL, mostra a busca em vez da ficha", async () => {
    renderWithProviders(<PatientFichaPage />);

    expect(screen.getByLabelText(/Buscar paciente/)).toBeInTheDocument();
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it("busca por nome, seleciona um resultado e mostra a ficha com atendimento + faturamento aninhado", async () => {
    const searchResults: PatientSearchItem[] = [{ id: "p1", full_name: "Carlos Andrade", cpf: "98765432100" }];
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/patients/search")) return Promise.resolve(searchResults as never);
      if (url.includes("/patients/p1/ficha")) return Promise.resolve(ficha() as never);
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    const user = userEvent.setup();

    renderWithProviders(<PatientFichaPage />);

    await user.type(screen.getByLabelText(/Buscar paciente/), "Carlos");
    const result = await screen.findByText("Carlos Andrade", {}, { timeout: 2000 });
    await user.click(result);

    expect(await screen.findByRole("heading", { name: "Carlos Andrade" })).toBeInTheDocument();
    expect(screen.getByText("CPF 98765432100")).toBeInTheDocument();
    expect(screen.getByText(/Dra\. Ana/)).toBeInTheDocument();
    expect(screen.getByText(/Unimed/)).toBeInTheDocument();
  });

  it("com ?patient_id= na URL, carrega a ficha direto, sem busca", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/patients/p1/ficha")) return Promise.resolve(ficha() as never);
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    renderWithProviders(<PatientFichaPage />, { route: "/pacientes?patient_id=p1" });

    expect(await screen.findByRole("heading", { name: "Carlos Andrade" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Buscar paciente/)).not.toBeInTheDocument();
  });

  it("paciente sem nenhum atendimento mostra o estado vazio", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/patients/p1/ficha")) {
        return Promise.resolve(
          ficha({
            appointments: [],
            summary: { total_appointments: 0, no_show_count: 0, no_show_rate: null, total_billed: 0, total_value_saved: 0, last_visit_at: null },
          }) as never
        );
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });

    renderWithProviders(<PatientFichaPage />, { route: "/pacientes?patient_id=p1" });

    expect(await screen.findByText("Nenhum atendimento registrado para este paciente.")).toBeInTheDocument();
  });

  it("botão 'Buscar outro paciente' limpa a seleção e volta pra busca", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/patients/p1/ficha")) return Promise.resolve(ficha() as never);
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    const user = userEvent.setup();

    renderWithProviders(<PatientFichaPage />, { route: "/pacientes?patient_id=p1" });

    await screen.findByRole("heading", { name: "Carlos Andrade" });
    await user.click(screen.getByRole("button", { name: /Buscar outro paciente/ }));

    await waitFor(() => expect(screen.getByLabelText(/Buscar paciente/)).toBeInTheDocument());
  });
});
