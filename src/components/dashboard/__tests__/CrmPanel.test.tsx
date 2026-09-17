import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { CrmPanel } from "@/components/dashboard/CrmPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { CrmSummary, InactivePatients } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

function mockEndpoints(crm: CrmSummary, inactive: InactivePatients) {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url.includes("crm-summary")) return Promise.resolve(crm as never);
    if (url.includes("inactive-patients")) return Promise.resolve(inactive as never);
    return Promise.reject(new Error(`unexpected url: ${url}`));
  });
}

describe("CrmPanel", () => {
  it("mostra os 3 números da carteira quando há amostra", async () => {
    mockEndpoints(
      { avg_patient_age_years: 42, avg_days_since_last_visit: 90, return_rate: 0.6, return_rate_sample_size: 20 },
      { total_count: 0, inactive_after_days: 365, items: [] }
    );

    renderWithProviders(<CrmPanel />);

    expect(await screen.findByText("42 anos")).toBeInTheDocument();
    expect(screen.getByText("90 dias")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("sem amostra, mostra travessão em vez de 0/NaN", async () => {
    mockEndpoints(
      { avg_patient_age_years: null, avg_days_since_last_visit: null, return_rate: null, return_rate_sample_size: 0 },
      { total_count: 0, inactive_after_days: 365, items: [] }
    );

    renderWithProviders(<CrmPanel />);

    const dashes = await screen.findAllByText("—");
    expect(dashes).toHaveLength(3);
  });

  it("inclui a Carteira de Inativos abaixo dos números", async () => {
    mockEndpoints(
      { avg_patient_age_years: null, avg_days_since_last_visit: null, return_rate: null, return_rate_sample_size: 0 },
      {
        total_count: 1,
        inactive_after_days: 365,
        items: [{ patient_id: "p1", full_name: "Paciente Sumido", last_appointment_at: "2024-01-01T00:00:00Z", days_since_last_appointment: 600 }],
      }
    );

    renderWithProviders(<CrmPanel />);

    expect(await screen.findByText("Carteira de pacientes inativos")).toBeInTheDocument();
    expect(screen.getByText("Paciente Sumido")).toBeInTheDocument();
  });
});
