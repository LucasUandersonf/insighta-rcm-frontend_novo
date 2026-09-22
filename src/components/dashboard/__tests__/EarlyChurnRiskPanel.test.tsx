import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { EarlyChurnRiskPanel } from "@/components/dashboard/EarlyChurnRiskPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { EarlyChurnRisk } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("EarlyChurnRiskPanel", () => {
  it("lista pacientes fora do próprio ritmo de retorno", async () => {
    const data: EarlyChurnRisk = {
      total_count: 2,
      gap_multiplier: 2.0,
      inactive_after_days: 365,
      items: [
        { patient_id: "p1", full_name: "Paciente Ritmo Quebrado", last_appointment_at: "2026-06-01T00:00:00Z", avg_interval_days: 20, days_since_last: 100 },
        { patient_id: "p2", full_name: "Paciente Sumindo", last_appointment_at: "2026-07-15T00:00:00Z", avg_interval_days: 30, days_since_last: 70 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<EarlyChurnRiskPanel />);

    await waitFor(() => expect(screen.getByText("Paciente Ritmo Quebrado")).toBeInTheDocument());
    expect(screen.getByText("Paciente Sumindo")).toBeInTheDocument();
    expect(screen.getByText(/2 pacientes já estão bem além do ritmo/)).toBeInTheDocument();
    expect(screen.getByText(/5\.0x o próprio ritmo/)).toBeInTheDocument();
  });

  it("mensagem honesta quando ninguém está fora do próprio ritmo", async () => {
    const data: EarlyChurnRisk = { total_count: 0, gap_multiplier: 2.0, inactive_after_days: 365, items: [] };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<EarlyChurnRiskPanel />);

    await waitFor(() =>
      expect(screen.getByText(/Ninguém sumindo do próprio padrão de retorno/)).toBeInTheDocument()
    );
  });

  it("avisa quando a lista mostrada é um recorte do total", async () => {
    const data: EarlyChurnRisk = {
      total_count: 20,
      gap_multiplier: 2.0,
      inactive_after_days: 365,
      items: [
        { patient_id: "p1", full_name: "Paciente Ritmo Quebrado", last_appointment_at: "2026-06-01T00:00:00Z", avg_interval_days: 20, days_since_last: 100 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<EarlyChurnRiskPanel />);

    await waitFor(() =>
      expect(screen.getByText(/Mostrando os 1 mais fora do próprio ritmo de 20 no total/)).toBeInTheDocument()
    );
  });

  it("não tem violações de acessibilidade", async () => {
    const data: EarlyChurnRisk = {
      total_count: 2,
      gap_multiplier: 2.0,
      inactive_after_days: 365,
      items: [
        { patient_id: "p1", full_name: "Paciente Ritmo Quebrado", last_appointment_at: "2026-06-01T00:00:00Z", avg_interval_days: 20, days_since_last: 100 },
        { patient_id: "p2", full_name: "Paciente Sumindo", last_appointment_at: "2026-07-15T00:00:00Z", avg_interval_days: 30, days_since_last: 70 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    const { container } = renderWithProviders(<EarlyChurnRiskPanel />);

    await waitFor(() => expect(screen.getByText("Paciente Ritmo Quebrado")).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});
