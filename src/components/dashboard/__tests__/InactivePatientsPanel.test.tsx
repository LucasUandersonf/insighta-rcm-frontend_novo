import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { InactivePatientsPanel } from "@/components/dashboard/InactivePatientsPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { InactivePatients } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("InactivePatientsPanel", () => {
  it("lista os pacientes inativos, do mais parado pro mais recente", async () => {
    const data: InactivePatients = {
      total_count: 2,
      inactive_after_days: 365,
      items: [
        { patient_id: "p1", full_name: "Paciente Sumido", last_appointment_at: "2024-01-10T00:00:00Z", days_since_last_appointment: 800 },
        { patient_id: "p2", full_name: "Paciente Distante", last_appointment_at: "2024-11-01T00:00:00Z", days_since_last_appointment: 400 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<InactivePatientsPanel />);

    await waitFor(() => expect(screen.getByText("Paciente Sumido")).toBeInTheDocument());
    expect(screen.getByText("Paciente Distante")).toBeInTheDocument();
    expect(screen.getByText(/2 pacientes não voltam há mais de 1 ano/)).toBeInTheDocument();
  });

  it("mensagem honesta quando não há ninguém inativo", async () => {
    const data: InactivePatients = { total_count: 0, inactive_after_days: 365, items: [] };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<InactivePatientsPanel />);

    await waitFor(() => expect(screen.getByText(/Nenhum paciente parado há mais de 1 ano/)).toBeInTheDocument());
  });

  it("avisa quando a lista mostrada é um recorte do total", async () => {
    const data: InactivePatients = {
      total_count: 30,
      inactive_after_days: 365,
      items: [{ patient_id: "p1", full_name: "Paciente Sumido", last_appointment_at: "2024-01-10T00:00:00Z", days_since_last_appointment: 800 }],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<InactivePatientsPanel />);

    await waitFor(() => expect(screen.getByText(/Mostrando os 1 mais inativos de 30 no total/)).toBeInTheDocument());
  });
});
