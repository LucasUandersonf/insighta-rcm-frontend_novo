import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ReturnRatePanel } from "@/components/dashboard/ReturnRatePanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { ReturnRate } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("ReturnRatePanel", () => {
  it("mostra a taxa de retorno e a contagem por trás dela", async () => {
    const data: ReturnRate = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      return_rate: { value: 60, previous_value: 60, delta_pct: null },
      return_count: 6,
      first_visit_count: 4,
      untagged_count: 0,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    const { container } = renderWithProviders(<ReturnRatePanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("60")).toBeInTheDocument());
    expect(screen.getByText("Taxa de retorno de pacientes")).toBeInTheDocument();
    expect(screen.getByText(/6 retornos de 10 atendimentos concluídos/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("mostra mensagem honesta quando não há atendimento com tipo de visita identificado, nunca '0%'", async () => {
    const data: ReturnRate = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      return_rate: null,
      return_count: 0,
      first_visit_count: 0,
      untagged_count: 5,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<ReturnRatePanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText(/Nenhum atendimento concluído com tipo de visita/)).toBeInTheDocument());
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("informa quantos atendimentos ficaram fora da conta por falta de tipo de visita", async () => {
    const data: ReturnRate = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      return_rate: { value: 100, previous_value: 100, delta_pct: null },
      return_count: 1,
      first_visit_count: 0,
      untagged_count: 3,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<ReturnRatePanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText(/3 atendimentos sem essa informação, fora da conta/)).toBeInTheDocument());
  });

  it("mostra a tendência de queda com o tom de alerta", async () => {
    const data: ReturnRate = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      return_rate: { value: 30, previous_value: 50, delta_pct: -40 },
      return_count: 3,
      first_visit_count: 7,
      untagged_count: 0,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<ReturnRatePanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    const pill = await screen.findByText(/40\.0% vs\. período anterior/);
    expect(pill.closest("span")).toHaveClass("text-denied");
  });
});
