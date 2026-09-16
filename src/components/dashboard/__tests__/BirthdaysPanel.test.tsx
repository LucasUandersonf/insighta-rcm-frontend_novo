import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { BirthdaysPanel } from "@/components/dashboard/BirthdaysPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { PatientBirthdays } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("BirthdaysPanel", () => {
  it("lista os aniversariantes do mês, ordenados por dia", async () => {
    const currentMonth = new Date().getMonth() + 1;
    const data: PatientBirthdays = {
      month: currentMonth,
      items: [
        { patient_id: "p1", full_name: "Paciente Dia 5", birth_date: "1990-01-05", communication_consent: true },
        { patient_id: "p2", full_name: "Paciente Dia 20", birth_date: "1985-01-20", communication_consent: null },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    const { container } = renderWithProviders(<BirthdaysPanel />);

    await waitFor(() => expect(screen.getByText("Paciente Dia 5")).toBeInTheDocument());
    expect(screen.getByText("Paciente Dia 20")).toBeInTheDocument();
    expect(screen.getByText(/dia 5/)).toBeInTheDocument();
    expect(screen.getByText(/dia 20/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("mensagem honesta quando ninguém faz aniversário no mês", async () => {
    const data: PatientBirthdays = { month: new Date().getMonth() + 1, items: [] };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<BirthdaysPanel />);

    await waitFor(() => expect(screen.getByText(/Nenhum paciente com data de nascimento cadastrada faz aniversário/)).toBeInTheDocument());
  });

  it("avisa quando o paciente não tem consentimento de contato", async () => {
    const data: PatientBirthdays = {
      month: new Date().getMonth() + 1,
      items: [{ patient_id: "p1", full_name: "Paciente Sem Consentimento", birth_date: "1990-03-10", communication_consent: false }],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<BirthdaysPanel />);

    await waitFor(() => expect(screen.getByText(/sem consentimento de contato/)).toBeInTheDocument());
  });

  it("não mostra aviso de consentimento quando é true ou nunca perguntado", async () => {
    const data: PatientBirthdays = {
      month: new Date().getMonth() + 1,
      items: [{ patient_id: "p1", full_name: "Paciente OK", birth_date: "1990-03-10", communication_consent: true }],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<BirthdaysPanel />);

    await waitFor(() => expect(screen.getByText("Paciente OK")).toBeInTheDocument());
    expect(screen.queryByText(/sem consentimento de contato/)).not.toBeInTheDocument();
  });
});
