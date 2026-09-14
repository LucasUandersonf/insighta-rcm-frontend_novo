import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { PriorityQueuePanel } from "@/components/dashboard/PriorityQueuePanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { PriorityQueue } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("PriorityQueuePanel — épico F1.1 do Plano Diretor", () => {
  it("mostra os itens ordenados, com badge de proveniência e total_considered", async () => {
    const data: PriorityQueue = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      total_considered: 5,
      items: [
        {
          severity: "critical",
          category: "faturamento",
          title: "Maior perda concentrada no convênio Unimed Nacional",
          message: "R$ 200,00 de perda no período.",
          financial_impact: 200,
          action_label: "Ver ranking de perda por convênio",
          action_href: "/",
          source: "raiox",
        },
        {
          severity: "warning",
          category: "agenda",
          title: "Queda de ocupação da agenda",
          message: "Ocupação caiu 12pp.",
          financial_impact: 80,
          action_label: null,
          action_href: null,
          source: "insight",
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<PriorityQueuePanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText("Maior perda concentrada no convênio Unimed Nacional")).toBeInTheDocument());
    expect(screen.getByText("Raio-X")).toBeInTheDocument();
    expect(screen.getByText("Queda de ocupação da agenda")).toBeInTheDocument();
    expect(screen.getByText("Mostrando 2 de 5 ações abertas nesta janela.")).toBeInTheDocument();
  });

  it("clique no botão de ação de um item #tab: chama onNavigateTab", async () => {
    const data: PriorityQueue = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      total_considered: 1,
      items: [
        {
          severity: "warning",
          category: "estrategia",
          title: "Fulano com a menor receita por hora ocupada",
          message: "R$ 90/hora contra R$ 200/hora de outro profissional.",
          financial_impact: null,
          action_label: "Ver rentabilidade por profissional",
          action_href: "#tab:rentabilidade",
          source: "raiox",
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);
    const onNavigateTab = vi.fn();

    renderWithProviders(<PriorityQueuePanel dateFrom="2026-09-01" dateTo="2026-09-07" onNavigateTab={onNavigateTab} />);

    await waitFor(() => expect(screen.getByText(/menor receita por hora ocupada/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Ver rentabilidade por profissional" }));
    expect(onNavigateTab).toHaveBeenCalledWith("rentabilidade");
  });

  it("mensagem honesta quando não há ação prioritária", async () => {
    const data: PriorityQueue = { period_start: "2026-09-01", period_end: "2026-09-07", total_considered: 0, items: [] };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<PriorityQueuePanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() =>
      expect(screen.getByText(/Nenhuma ação prioritária agora/)).toBeInTheDocument()
    );
  });
});
