import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { SmartInsightsFeed } from "@/components/dashboard/SmartInsightsFeed";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { SmartInsights } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("SmartInsightsFeed", () => {
  it("insight severidade 'comparativo' vira manchete com badge próprio (não crítico/atenção/positivo)", async () => {
    const data: SmartInsights = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      insights: [
        {
          severity: "comparativo",
          title: "Sua taxa de glosa está acima da rede",
          message: "9,2% nesta janela — a mediana da rede é 5,1%.",
          financial_impact: 6480,
          is_new: true,
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<SmartInsightsFeed dateFrom="2026-01-01" dateTo="2026-01-07" />);

    expect(await screen.findByText("Sua taxa de glosa está acima da rede")).toBeInTheDocument();
    expect(screen.getByText("Comparativo")).toBeInTheDocument();
    // "Novo" é verdadeiro (is_new) e deve aparecer como pílula própria,
    // ao lado do badge de tipo — nunca substituindo-o.
    expect(screen.getByText("Novo")).toBeInTheDocument();
  });

  it("insight sem is_new não mostra a pílula 'Novo'", async () => {
    const data: SmartInsights = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      insights: [
        { severity: "critical", title: "Prazo de recurso vencendo", message: "2 recursos vencem em breve.", financial_impact: 3140 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<SmartInsightsFeed dateFrom="2026-01-01" dateTo="2026-01-07" />);

    expect(await screen.findByText("Prazo de recurso vencendo")).toBeInTheDocument();
    expect(screen.queryByText("Novo")).not.toBeInTheDocument();
  });
});
