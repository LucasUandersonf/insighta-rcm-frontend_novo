import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { PriorityQueuePanel } from "@/components/dashboard/PriorityQueuePanel";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";
import type { CurrentUser, InsightOutcome, PlatformUser, PriorityQueue } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), patch: vi.fn() } };
});

vi.mock("@/context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/AuthContext")>();
  return { ...actual, useAuth: vi.fn() };
});

function mockUser(role: CurrentUser["role"] | null) {
  vi.mocked(useAuth).mockReturnValue({
    user: role ? ({ tenant_id: "t1", id: "u1", role } as unknown as CurrentUser) : null,
  } as unknown as ReturnType<typeof useAuth>);
}

const RAIOX_ITEM: PriorityQueue["items"][number] = {
  severity: "critical",
  category: "faturamento",
  title: "Maior perda concentrada no convênio Unimed Nacional",
  message: "R$ 200,00 de perda no período.",
  financial_impact: 200,
  action_label: "Ver ranking de perda por convênio",
  action_href: "/",
  source: "raiox",
};

describe("PriorityQueuePanel — épico F1.1 do Plano Diretor", () => {
  it("mostra os itens ordenados, com badge de proveniência e total_considered", async () => {
    mockUser("auditor");
    const data: PriorityQueue = {
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      total_considered: 5,
      items: [
        RAIOX_ITEM,
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
    mockUser("auditor");
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
    mockUser("auditor");
    const data: PriorityQueue = { period_start: "2026-09-01", period_end: "2026-09-07", total_considered: 0, items: [] };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<PriorityQueuePanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() =>
      expect(screen.getByText(/Nenhuma ação prioritária agora/)).toBeInTheDocument()
    );
  });

  it("auditor (só leitura) não vê botões de gestão (Marcar como resolvido/Atribuir)", async () => {
    mockUser("auditor");
    vi.mocked(apiClient.get).mockResolvedValue({
      period_start: "2026-09-01", period_end: "2026-09-07", total_considered: 1, items: [RAIOX_ITEM],
    } as PriorityQueue);

    renderWithProviders(<PriorityQueuePanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByText(RAIOX_ITEM.title)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Marcar como resolvido" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Atribuir/ })).not.toBeInTheDocument();
  });

  it("épico F1.2: financeiro marca um item como resolvido (cria + resolve o insight_outcome)", async () => {
    mockUser("financeiro");
    vi.mocked(apiClient.get).mockResolvedValue({
      period_start: "2026-09-01", period_end: "2026-09-07", total_considered: 1, items: [RAIOX_ITEM],
    } as PriorityQueue);
    vi.mocked(apiClient.post).mockResolvedValue({ id: "outcome-1", status: "pendente" } as InsightOutcome);
    vi.mocked(apiClient.patch).mockResolvedValue({ id: "outcome-1", status: "resolvido" } as InsightOutcome);

    renderWithProviders(<PriorityQueuePanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Marcar como resolvido" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Marcar como resolvido" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/insight-outcomes",
        expect.objectContaining({ source: "raiox", category: "faturamento", title: RAIOX_ITEM.title })
      )
    );
    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/insight-outcomes/outcome-1", { status: "resolvido" })
    );
    await waitFor(() => expect(screen.getByText("Marcado como resolvido")).toBeInTheDocument());
    // Botões de ação somem depois de resolvido — não dá pra clicar de novo.
    expect(screen.queryByRole("button", { name: "Marcar como resolvido" })).not.toBeInTheDocument();
  });

  it("épico F1.3: owner atribui um item a um colega com prazo", async () => {
    mockUser("owner");
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path.includes("priority-queue")) {
        return Promise.resolve({
          period_start: "2026-09-01", period_end: "2026-09-07", total_considered: 1, items: [RAIOX_ITEM],
        } as never);
      }
      if (path.includes("/users")) {
        return Promise.resolve([{ id: "user-2", full_name: "Faturista Ana", role: "financeiro" }] as PlatformUser[] as never);
      }
      return Promise.reject(new Error(`sem mock para ${path}`));
    });
    vi.mocked(apiClient.post).mockResolvedValue({ id: "outcome-2", status: "pendente" } as InsightOutcome);

    renderWithProviders(<PriorityQueuePanel dateFrom="2026-09-01" dateTo="2026-09-07" />);

    await waitFor(() => expect(screen.getByRole("button", { name: /Atribuir/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Atribuir/ }));

    const modalTitle = await screen.findByText("Atribuir insight");
    const dialog = (modalTitle.closest('[role="dialog"]') ?? modalTitle.parentElement!) as HTMLElement;
    await waitFor(() => expect(within(dialog).getByText(/Faturista Ana/)).toBeInTheDocument());
    fireEvent.change(within(dialog).getByLabelText(/Atribuir para/), { target: { value: "user-2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Atribuir" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/insight-outcomes",
        expect.objectContaining({ assigned_to: "user-2", title: RAIOX_ITEM.title })
      )
    );
    await waitFor(() => expect(screen.getByText("Atribuído")).toBeInTheDocument());
  });
});
