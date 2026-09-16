import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { PatientRfmPanel } from "@/components/dashboard/PatientRfmPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { RfmResponse } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("PatientRfmPanel", () => {
  it("mensagem honesta quando não há paciente com histórico ainda", async () => {
    const data: RfmResponse = { as_of: "2026-01-07", total_patients: 0, segment_counts: [], action_items: [] };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<PatientRfmPanel />);

    await waitFor(() =>
      expect(screen.getByText("Nenhum paciente com histórico de atendimento ainda.")).toBeInTheDocument()
    );
  });

  it("mostra a distribuição de segmentos e a fila de reativação, maior receita primeiro", async () => {
    const data: RfmResponse = {
      as_of: "2026-01-07",
      total_patients: 5,
      segment_counts: [
        { segment: "campeoes", patient_count: 1 },
        { segment: "fieis", patient_count: 0 },
        { segment: "nao_pode_perder", patient_count: 1 },
        { segment: "em_risco", patient_count: 1 },
        { segment: "novos", patient_count: 1 },
        { segment: "hibernando", patient_count: 1 },
        { segment: "precisa_atencao", patient_count: 0 },
      ],
      action_items: [
        {
          patient_id: "p1",
          full_name: "Paciente Não Pode Perder",
          days_since_last_appointment: 400,
          visit_count: 1,
          total_revenue: 3000,
          recency_score: 1,
          frequency_score: 1,
          monetary_score: 4,
          segment: "nao_pode_perder",
          last_outreach_at: null,
          last_outreach_outcome: null,
        },
        {
          patient_id: "p2",
          full_name: "Paciente Em Risco",
          days_since_last_appointment: 200,
          visit_count: 5,
          total_revenue: 2000,
          recency_score: 2,
          frequency_score: 4,
          monetary_score: 3,
          segment: "em_risco",
          last_outreach_at: "2026-01-05T00:00:00Z",
          last_outreach_outcome: "agendou",
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<PatientRfmPanel />);

    await waitFor(() => expect(screen.getByText("Campeões: 1")).toBeInTheDocument());
    expect(screen.getByText("Fiéis: 0")).toBeInTheDocument();
    expect(screen.getByText("Não pode perder: 1")).toBeInTheDocument();

    const names = screen.getAllByText(/Paciente (Não Pode Perder|Em Risco)/).map((el) => el.textContent);
    expect(names).toEqual(["Paciente Não Pode Perder", "Paciente Em Risco"]);

    // Onda 4 do Plano de Ação, item 12 — botão de registrar contato em
    // cada linha da fila de ação + selo "já contatado" só pra quem já
    // recebeu um contato.
    expect(screen.getAllByRole("button", { name: /Registrar contato/ })).toHaveLength(2);
    expect(screen.getByText("· já contatado")).toBeInTheDocument();
  });
});
