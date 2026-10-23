import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { PayerSimulatorPanel } from "@/components/money/PayerSimulatorPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { PayerSimulation } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const SIM: PayerSimulation = {
  plan_id: "p1",
  plan_name: "Unimed",
  date_from: "2025-10-23",
  date_to: "2026-10-22",
  accounts: 5,
  billed: 600,
  received: 400,
  denial_rate: 0.2,
  lag_days: 32,
  withholding_pct: null,
  direct_cost: 0,
  contribution: 400,
  hours: 2,
  contribution_per_hour: 200,
  clinic_contribution_per_hour: 300,
  readjust_pct: 10,
  readjust_gain: 40,
  leave_contribution_lost: 400,
  leave_breakeven_share: 0.67,
  network_gap: 250,
  verdict: "abaixo_da_clinica_e_rede",
  procedures: [
    {
      tuss_code: "10101012",
      procedure_name: "Consulta",
      volume: 5,
      your_price: null,
      your_median_paid: 100,
      network_contract_median: null,
      network_paid_median: 150,
      network_cohort: 3,
      paid_gap_per_unit: 50,
    },
  ],
};

describe("PayerSimulatorPanel", () => {
  it("responde reajuste, saída e rede para o convênio escolhido", async () => {
    vi.mocked(apiClient.get).mockImplementation(((path: string) =>
      Promise.resolve(
        path.endsWith("/simulador") ? [{ plan_id: "p1", plan_name: "Unimed", billed_12m: 600, accounts_12m: 5 }] : SIM
      )) as never);
    renderWithProviders(<PayerSimulatorPanel />);
    expect(await screen.findByText(/do que a média da clínica e menos do que paga às outras/)).toBeInTheDocument();
    expect(screen.getByText(/\+R\$\s?40,00 por ano/)).toBeInTheDocument();
    expect(screen.getByText(/Empata se outros pacientes ocuparem 67%/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?250,00 por ano/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/E se reajustar/), { target: { value: "8" } });
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/financeiro/simulador/p1?reajuste=8")
    );
  });

  it("explica quando não há base na rede", async () => {
    vi.mocked(apiClient.get).mockImplementation(((path: string) =>
      Promise.resolve(
        path.endsWith("/simulador")
          ? [{ plan_id: "p1", plan_name: "Unimed", billed_12m: 600, accounts_12m: 5 }]
          : { ...SIM, network_gap: null, verdict: "saudavel", procedures: [] }
      )) as never);
    renderWithProviders(<PayerSimulatorPanel />);
    expect(await screen.findByText("Sem base na rede")).toBeInTheDocument();
    expect(screen.getByText(/3 ou mais clínicas atendem/)).toBeInTheDocument();
  });
});
