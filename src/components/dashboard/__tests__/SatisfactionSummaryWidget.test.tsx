import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { SatisfactionSummaryWidget } from "@/components/dashboard/SatisfactionSummaryWidget";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { SatisfactionSummary } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("SatisfactionSummaryWidget", () => {
  it("mostra a média e a distribuição quando há avaliações no período", async () => {
    const summary: SatisfactionSummary = {
      average_score: { value: 4.2, previous_value: 4.2, delta_pct: null },
      response_count: 5,
      distribution: { "1": 0, "2": 0, "3": 1, "4": 2, "5": 2 },
      window_days: 90,
    };
    vi.mocked(apiClient.get).mockResolvedValue(summary);

    const { container } = renderWithProviders(<SatisfactionSummaryWidget />);

    await waitFor(() => expect(screen.getByText("4.2")).toBeInTheDocument());
    expect(screen.getByText("Satisfação pós-atendimento")).toBeInTheDocument();
    expect(screen.getByText(/5 avaliações nos últimos 90 dias/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("mostra mensagem honesta quando não há avaliação nenhuma, nunca '0'", async () => {
    const summary: SatisfactionSummary = {
      average_score: null,
      response_count: 0,
      distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
      window_days: 90,
    };
    vi.mocked(apiClient.get).mockResolvedValue(summary);

    renderWithProviders(<SatisfactionSummaryWidget />);

    await waitFor(() => expect(screen.getByText(/Nenhuma avaliação recebida/)).toBeInTheDocument());
    expect(screen.queryByText("0.0")).not.toBeInTheDocument();
  });

  it("sem janela anterior pra comparar, não mostra pílula de tendência nenhuma", async () => {
    const summary: SatisfactionSummary = {
      average_score: { value: 4.0, previous_value: 4.0, delta_pct: null },
      response_count: 1,
      distribution: { "1": 0, "2": 0, "3": 0, "4": 1, "5": 0 },
      window_days: 90,
    };
    vi.mocked(apiClient.get).mockResolvedValue(summary);

    renderWithProviders(<SatisfactionSummaryWidget />);

    await waitFor(() => expect(screen.getByText("4.0")).toBeInTheDocument());
    expect(screen.queryByText(/vs\. janela anterior/)).not.toBeInTheDocument();
  });

  it("mostra a tendência de melhora", async () => {
    const summary: SatisfactionSummary = {
      average_score: { value: 4.5, previous_value: 3.5, delta_pct: 28.6 },
      response_count: 4,
      distribution: { "1": 0, "2": 0, "3": 0, "4": 2, "5": 2 },
      window_days: 90,
    };
    vi.mocked(apiClient.get).mockResolvedValue(summary);

    renderWithProviders(<SatisfactionSummaryWidget />);

    const pill = await screen.findByText(/28\.6% vs\. janela anterior/);
    expect(pill.closest("span")).toHaveClass("text-revenue");
  });

  it("mostra a tendência de queda com o tom de alerta", async () => {
    const summary: SatisfactionSummary = {
      average_score: { value: 3.0, previous_value: 4.5, delta_pct: -33.3 },
      response_count: 4,
      distribution: { "1": 1, "2": 1, "3": 1, "4": 1, "5": 0 },
      window_days: 90,
    };
    vi.mocked(apiClient.get).mockResolvedValue(summary);

    renderWithProviders(<SatisfactionSummaryWidget />);

    const pill = await screen.findByText(/33\.3% vs\. janela anterior/);
    expect(pill.closest("span")).toHaveClass("text-denied");
  });
});
