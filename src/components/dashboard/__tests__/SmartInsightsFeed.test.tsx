import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SmartInsightsFeed } from "@/components/dashboard/SmartInsightsFeed";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { SmartInsights } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

describe("SmartInsightsFeed", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });


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

  it("botão de ação com destino de rota navega pra tela certa", async () => {
    const data: SmartInsights = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      insights: [
        {
          severity: "critical",
          title: "Boa parte do que você faturou corre risco de ser recusada pelo convênio",
          message: "...",
          financial_impact: 9000,
          action_label: "Ver faturamentos de alto risco",
          action_href: "/",
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);
    const user = userEvent.setup();

    renderWithProviders(<SmartInsightsFeed dateFrom="2026-01-01" dateTo="2026-01-07" />);

    const button = await screen.findByRole("button", { name: "Ver faturamentos de alto risco" });
    await user.click(button);
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("botão de ação com destino '#tab:' troca de aba em vez de navegar", async () => {
    const data: SmartInsights = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      insights: [
        {
          severity: "comparativo",
          title: "Sua taxa de glosa está acima da rede",
          message: "...",
          financial_impact: 6480,
          action_label: "Ver comparativo completo",
          action_href: "#tab:comparativo",
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);
    const user = userEvent.setup();
    const onNavigateTab = vi.fn();

    renderWithProviders(<SmartInsightsFeed dateFrom="2026-01-01" dateTo="2026-01-07" onNavigateTab={onNavigateTab} />);

    const button = await screen.findByRole("button", { name: "Ver comparativo completo" });
    await user.click(button);
    expect(onNavigateTab).toHaveBeenCalledWith("comparativo");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("insight sem action_label/action_href não mostra nenhum botão", async () => {
    const data: SmartInsights = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      insights: [{ severity: "positive", title: "Tudo certo", message: "...", financial_impact: null }],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<SmartInsightsFeed dateFrom="2026-01-01" dateTo="2026-01-07" />);

    await screen.findByText("Tudo certo");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
