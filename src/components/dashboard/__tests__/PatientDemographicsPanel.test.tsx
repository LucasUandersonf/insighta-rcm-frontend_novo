import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { PatientDemographicsPanel } from "@/components/dashboard/PatientDemographicsPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { PatientDemographics } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const EMPTY_BUCKETS: PatientDemographics["buckets"] = [
  { label: "0-17", patient_count: 0 },
  { label: "18-30", patient_count: 0 },
  { label: "31-45", patient_count: 0 },
  { label: "46-60", patient_count: 0 },
  { label: "60+", patient_count: 0 },
];

describe("PatientDemographicsPanel", () => {
  it("mostra a distribuição por faixa etária", async () => {
    const data: PatientDemographics = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      buckets: EMPTY_BUCKETS.map((b) => (b.label === "18-30" ? { ...b, patient_count: 5 } : b)),
      unknown_age_count: 0,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    const { container } = renderWithProviders(<PatientDemographicsPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("Faixa etária dos pacientes")).toBeInTheDocument());
    expect(screen.getByText(/5 pacientes atendidos neste período/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("mensagem honesta quando ninguém tem data de nascimento cadastrada", async () => {
    const data: PatientDemographics = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      buckets: EMPTY_BUCKETS,
      unknown_age_count: 0,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<PatientDemographicsPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() =>
      expect(screen.getByText(/Nenhum paciente com data de nascimento cadastrada atendido neste período/)).toBeInTheDocument()
    );
  });

  it("informa quantos pacientes ficaram fora por falta de data de nascimento", async () => {
    const data: PatientDemographics = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      buckets: EMPTY_BUCKETS.map((b) => (b.label === "31-45" ? { ...b, patient_count: 2 } : b)),
      unknown_age_count: 3,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<PatientDemographicsPanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText(/3 sem essa informação, fora da contagem/)).toBeInTheDocument());
  });
});
