import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { HealthScoreWidget } from "@/components/dashboard/HealthScoreWidget";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { HealthScore } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("HealthScoreWidget", () => {
  it("mostra a nota e os componentes quando há dado suficiente", async () => {
    const score: HealthScore = {
      score: 74,
      window_days: 90,
      trend: null,
      components: [
        { key: "denial", label: "Taxa de glosa", rate: 0.09, sub_score: 64, weight: 0.45 },
        { key: "no_show", label: "Taxa de falta", rate: 0.05, sub_score: 87.5, weight: 0.55 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(score);

    const { container } = renderWithProviders(<HealthScoreWidget />);

    await waitFor(() => expect(screen.getByText("74")).toBeInTheDocument());
    expect(screen.getByText("Nota de saúde financeira")).toBeInTheDocument();
    expect(screen.getByText(/Taxa de glosa/)).toBeInTheDocument();
    expect(screen.getByText(/9\.0%/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("mostra mensagem de amostra insuficiente quando score é null, nunca '0'", async () => {
    const score: HealthScore = { score: null, window_days: 90, components: [], trend: null };
    vi.mocked(apiClient.get).mockResolvedValue(score);

    renderWithProviders(<HealthScoreWidget />);

    await waitFor(() => expect(screen.getByText(/ainda não há faturamento/i)).toBeInTheDocument());
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("sem fotografia de referência ainda, não mostra pílula de tendência nenhuma", async () => {
    const score: HealthScore = { score: 60, window_days: 90, components: [], trend: null };
    vi.mocked(apiClient.get).mockResolvedValue(score);

    renderWithProviders(<HealthScoreWidget />);

    await waitFor(() => expect(screen.getByText("60")).toBeInTheDocument());
    expect(screen.queryByText(/pontos desde/)).not.toBeInTheDocument();
  });

  it("mostra a tendência de melhora com o mês de referência", async () => {
    const score: HealthScore = {
      score: 74,
      window_days: 90,
      components: [],
      trend: { reference_score: 60, reference_month: "2026-06-01", delta: 14 },
    };
    vi.mocked(apiClient.get).mockResolvedValue(score);

    renderWithProviders(<HealthScoreWidget />);

    await waitFor(() => expect(screen.getByText(/14 pontos desde/)).toBeInTheDocument());
    expect(screen.getByText(/jun\.? de 2026|jun\/2026/i)).toBeInTheDocument();
  });

  it("mostra a tendência de queda com o tom de alerta", async () => {
    const score: HealthScore = {
      score: 40,
      window_days: 90,
      components: [],
      trend: { reference_score: 60, reference_month: "2026-06-01", delta: -20 },
    };
    vi.mocked(apiClient.get).mockResolvedValue(score);

    renderWithProviders(<HealthScoreWidget />);

    const pill = await screen.findByText(/20 pontos desde/);
    expect(pill.closest("span")).toHaveClass("text-denied");
  });
});
