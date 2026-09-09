import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { OportunidadesPanel } from "@/components/dashboard/OportunidadesPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { Oportunidades } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("OportunidadesPanel", () => {
  it("lista as oportunidades com preço, mediana e oportunidade estimada", async () => {
    const data: Oportunidades = {
      window_days: 90,
      items: [
        {
          insurance_plan_id: "p1",
          plan_display_name: "Unimed Regional",
          tuss_code: "10101012",
          procedure_name: "Consulta em consultório",
          your_price: 100,
          network_median_price: 150,
          network_cohort_size: 4,
          monthly_volume: 20,
          gap_value: 50,
          gap_pct: 0.5,
          estimated_monthly_opportunity: 1000,
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<OportunidadesPanel />);

    await waitFor(() => expect(screen.getByText("Unimed Regional")).toBeInTheDocument());
    expect(screen.getByText("Consulta em consultório")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*1\.000,00/)).toBeInTheDocument();
  });

  it("mensagem honesta quando não há oportunidade nenhuma, não uma tela vazia sem explicação", async () => {
    const data: Oportunidades = { window_days: 90, items: [] };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<OportunidadesPanel />);

    await waitFor(() => expect(screen.getByText(/Nenhuma oportunidade de renegociação/)).toBeInTheDocument());
  });

  it("procedimento sem volume recente mostra 'sem volume recente' em vez de 0/mês", async () => {
    const data: Oportunidades = {
      window_days: 90,
      items: [
        {
          insurance_plan_id: "p1",
          plan_display_name: "Bradesco Saúde",
          tuss_code: "20202020",
          procedure_name: null,
          your_price: 80,
          network_median_price: 100,
          network_cohort_size: 3,
          monthly_volume: 0,
          gap_value: 20,
          gap_pct: 0.25,
          estimated_monthly_opportunity: 0,
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<OportunidadesPanel />);

    await waitFor(() => expect(screen.getByText("Bradesco Saúde")).toBeInTheDocument());
    expect(screen.getByText("sem volume recente")).toBeInTheDocument();
    expect(screen.getByText("Código TUSS 20202020")).toBeInTheDocument();
  });
});
