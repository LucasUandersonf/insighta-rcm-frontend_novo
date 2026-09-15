import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SmartInsightsFeed } from "@/components/dashboard/SmartInsightsFeed";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";
import type { CurrentUser, SmartInsights } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), patch: vi.fn() } };
});

vi.mock("@/context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/AuthContext")>();
  return { ...actual, useAuth: vi.fn() };
});

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

function mockUser(role: CurrentUser["role"] | null) {
  vi.mocked(useAuth).mockReturnValue({
    user: role ? ({ tenant_id: "t1", id: "u1", role } as unknown as CurrentUser) : null,
  } as unknown as ReturnType<typeof useAuth>);
}

describe("SmartInsightsFeed", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    // "owner" por padrão em todo teste que não testa RBAC explicitamente
    // (mesma convenção de PriorityQueuePanel.test.tsx) — a maioria dos
    // testes aqui não é sobre atribuição/resolução, então o papel default
    // só precisa "poder gerenciar" pra não interferir nas asserções.
    mockUser("owner");
  });


  it("insight severidade 'comparativo' vira manchete com badge próprio (não crítico/atenção/positivo)", async () => {
    const data: SmartInsights = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      insights: [
        {
          severity: "comparativo",
          category: "faturamento",
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
        { severity: "critical", category: "faturamento", title: "Prazo de recurso vencendo", message: "2 recursos vencem em breve.", financial_impact: 3140 },
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
          category: "faturamento",
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
          category: "faturamento",
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

  it("botão de ação com destino '#weekday:' chama onFocusAgenda com o dia da semana, sem navegar", async () => {
    const data: SmartInsights = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      insights: [
        {
          severity: "warning",
          category: "agenda",
          title: "Quarta-feira está com menos consultas marcadas",
          message: "...",
          financial_impact: null,
          action_label: "Ver quem costumava vir quarta-feira",
          action_href: "#weekday:3",
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);
    const user = userEvent.setup();
    const onFocusAgenda = vi.fn();

    renderWithProviders(<SmartInsightsFeed dateFrom="2026-01-01" dateTo="2026-01-07" onFocusAgenda={onFocusAgenda} />);

    const button = await screen.findByRole("button", { name: "Ver quem costumava vir quarta-feira" });
    await user.click(button);
    expect(onFocusAgenda).toHaveBeenCalledWith({ type: "weekday", weekday: 3 });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("botão de ação com destino '#professional:' chama onFocusAgenda com o id do profissional, sem navegar", async () => {
    const data: SmartInsights = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      insights: [
        {
          severity: "warning",
          category: "agenda",
          title: "Sua agenda está com mais horários vazios do que o normal",
          message: "...",
          financial_impact: null,
          action_label: "Ver candidatos pra agenda de Dra. Ana",
          action_href: "#professional:prof-123",
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);
    const user = userEvent.setup();
    const onFocusAgenda = vi.fn();

    renderWithProviders(<SmartInsightsFeed dateFrom="2026-01-01" dateTo="2026-01-07" onFocusAgenda={onFocusAgenda} />);

    const button = await screen.findByRole("button", { name: "Ver candidatos pra agenda de Dra. Ana" });
    await user.click(button);
    expect(onFocusAgenda).toHaveBeenCalledWith({ type: "professional", professionalId: "prof-123" });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("insight sem action_label/action_href não mostra nenhum botão de ação (fora do workflow de atribuição)", async () => {
    // Papel sem permissão de gerenciar (mesmo RBAC de
    // insight_outcome_service.py): sem isso, os botões de
    // atribuir/resolver do workflow (independentes de action_href)
    // apareceriam e quebrariam a asserção original desta cobertura, que
    // é especificamente sobre o botão de AÇÃO do insight.
    mockUser("auditor");
    const data: SmartInsights = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      insights: [{ severity: "positive", category: "faturamento", title: "Tudo certo", message: "...", financial_impact: null }],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<SmartInsightsFeed dateFrom="2026-01-01" dateTo="2026-01-07" />);

    await screen.findByText("Tudo certo");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("agrupa o feed em Faturamento & Convênios / Agenda & Ocupação, deixando a manchete fora das seções", async () => {
    const data: SmartInsights = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      insights: [
        { severity: "critical", category: "faturamento", title: "Glosa disparou", message: "...", financial_impact: 9000 },
        { severity: "critical", category: "faturamento", title: "Outro convênio recusando mais", message: "...", financial_impact: 4000 },
        { severity: "warning", category: "agenda", title: "Quarta-feira com menos consultas", message: "...", financial_impact: null },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<SmartInsightsFeed dateFrom="2026-01-01" dateTo="2026-01-07" />);

    // A manchete (maior impacto) some do texto de qualquer seção — ela
    // não é filha de "Faturamento & Convênios" nem de "Agenda & Ocupação".
    expect(await screen.findByText("Glosa disparou")).toBeInTheDocument();
    expect(screen.getByText("Faturamento & Convênios")).toBeInTheDocument();
    expect(screen.getByText("Outro convênio recusando mais")).toBeInTheDocument();
    expect(screen.getByText("Agenda & Ocupação")).toBeInTheDocument();
    expect(screen.getByText("Quarta-feira com menos consultas")).toBeInTheDocument();
  });

  it("não mostra o título de uma seção sem nenhum card nela", async () => {
    const data: SmartInsights = {
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      insights: [
        { severity: "critical", category: "faturamento", title: "Glosa disparou", message: "...", financial_impact: 9000 },
        { severity: "warning", category: "faturamento", title: "Cobrança abaixo do contrato", message: "...", financial_impact: 1000 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<SmartInsightsFeed dateFrom="2026-01-01" dateTo="2026-01-07" />);

    await screen.findByText("Cobrança abaixo do contrato");
    expect(screen.queryByText("Agenda & Ocupação")).not.toBeInTheDocument();
  });

  // "Junta Técnica Insighta" (reavaliação de mercado da Sala de Comando):
  // atribuição/resolução de insight (épico F1.3) existia só na fila
  // "Hoje" — a aba "Diagnóstico" (este componente), que é o que a junta
  // avaliou como "feed de insights", não tinha o botão em NENHUM card.
  describe("atribuição/resolução de insight (épico F1.3, agora também no Diagnóstico)", () => {
    it("auditor (só leitura) não vê botões de gestão", async () => {
      mockUser("auditor");
      const data: SmartInsights = {
        period_start: "2026-01-01",
        period_end: "2026-01-07",
        insights: [{ severity: "critical", category: "faturamento", title: "Glosa disparou", message: "...", financial_impact: 9000 }],
      };
      vi.mocked(apiClient.get).mockResolvedValue(data);

      renderWithProviders(<SmartInsightsFeed dateFrom="2026-01-01" dateTo="2026-01-07" />);

      await screen.findByText("Glosa disparou");
      expect(screen.queryByRole("button", { name: "Marcar como resolvido" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Atribuir/ })).not.toBeInTheDocument();
    });

    it("owner marca a manchete (HeroInsight) como resolvida", async () => {
      mockUser("owner");
      const data: SmartInsights = {
        period_start: "2026-01-01",
        period_end: "2026-01-07",
        insights: [{ severity: "critical", category: "faturamento", title: "Glosa disparou", message: "...", financial_impact: 9000 }],
      };
      vi.mocked(apiClient.get).mockResolvedValue(data);
      vi.mocked(apiClient.post).mockResolvedValue({ id: "outcome-1", status: "pendente" });
      vi.mocked(apiClient.patch).mockResolvedValue({ id: "outcome-1", status: "resolvido" });
      const user = userEvent.setup();

      renderWithProviders(<SmartInsightsFeed dateFrom="2026-01-01" dateTo="2026-01-07" />);

      await screen.findByText("Glosa disparou");
      await user.click(screen.getByRole("button", { name: "Marcar como resolvido" }));

      await waitFor(() =>
        expect(apiClient.post).toHaveBeenCalledWith(
          "/api/v1/insight-outcomes",
          expect.objectContaining({ source: "insight", category: "faturamento", title: "Glosa disparou" })
        )
      );
      await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/insight-outcomes/outcome-1", { status: "resolvido" }));
      expect(await screen.findByText("Marcado como resolvido")).toBeInTheDocument();
    });

    it("owner atribui um card secundário (SecondaryInsightCard) a um colega", async () => {
      mockUser("owner");
      const data: SmartInsights = {
        period_start: "2026-01-01",
        period_end: "2026-01-07",
        insights: [
          { severity: "critical", category: "faturamento", title: "Glosa disparou", message: "...", financial_impact: 9000 },
          { severity: "warning", category: "agenda", title: "Quarta-feira com menos consultas", message: "...", financial_impact: null },
        ],
      };
      vi.mocked(apiClient.get).mockImplementation((path: string) => {
        if (path.includes("smart-insights")) return Promise.resolve(data as never);
        if (path.includes("/users")) return Promise.resolve([{ id: "user-2", full_name: "Faturista Ana", role: "financeiro" }] as never);
        return Promise.reject(new Error(`sem mock para ${path}`));
      });
      vi.mocked(apiClient.post).mockResolvedValue({ id: "outcome-2", status: "pendente" });
      const user = userEvent.setup();

      renderWithProviders(<SmartInsightsFeed dateFrom="2026-01-01" dateTo="2026-01-07" />);

      await screen.findByText("Quarta-feira com menos consultas");
      const secondaryCard = screen.getByText("Quarta-feira com menos consultas").closest("div.p-4") as HTMLElement;
      await user.click(within(secondaryCard).getByRole("button", { name: /Atribuir/ }));

      const modalTitle = await screen.findByText("Atribuir insight");
      const dialog = modalTitle.closest('[role="dialog"]') as HTMLElement;
      await waitFor(() => expect(within(dialog).getByText(/Faturista Ana/)).toBeInTheDocument());
      await user.selectOptions(within(dialog).getByLabelText(/Atribuir para/), "user-2");
      await user.click(within(dialog).getByRole("button", { name: "Atribuir" }));

      await waitFor(() =>
        expect(apiClient.post).toHaveBeenCalledWith(
          "/api/v1/insight-outcomes",
          expect.objectContaining({ assigned_to: "user-2", title: "Quarta-feira com menos consultas" })
        )
      );
      expect(within(secondaryCard).getByText("Atribuído")).toBeInTheDocument();
    });
  });
});
