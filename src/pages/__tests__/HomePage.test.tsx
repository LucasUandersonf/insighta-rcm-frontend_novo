import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomePage } from "@/pages/HomePage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { ExecutiveNarrative, PlatformUser } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

const PROFILE: PlatformUser = { id: "u1", full_name: "Marina Souza", email: "marina@clinica.com" } as PlatformUser;

function mockEndpoints(narrative: ExecutiveNarrative) {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url.includes("executive-narrative")) return Promise.resolve(narrative as never);
    if (url.includes("users/me")) return Promise.resolve(PROFILE as never);
    return Promise.reject(new Error(`unexpected url in test: ${url}`));
  });
}

describe("HomePage", () => {
  it("mostra o texto narrado pela IA e a saudação por nome", async () => {
    mockEndpoints({
      period_start: "2026-09-10",
      period_end: "2026-09-16",
      narrative: "A agenda de quinta está mais vazia que o normal — ainda dá pra reverter.",
      generated_at: "2026-09-16T08:00:00Z",
      top_priorities: [],
    });

    renderWithProviders(<HomePage />);

    expect(await screen.findByText("A agenda de quinta está mais vazia que o normal — ainda dá pra reverter.")).toBeInTheDocument();
    expect(await screen.findByText(/, Marina\.$/)).toBeInTheDocument();
  });

  it("mostra até 3 cards de prioridade com botão de ação real", async () => {
    mockEndpoints({
      period_start: "2026-09-10",
      period_end: "2026-09-16",
      narrative: "Resumo do dia.",
      generated_at: "2026-09-16T08:00:00Z",
      top_priorities: [
        {
          severity: "critical",
          category: "faturamento",
          title: "Convênio recusando mais pagamentos",
          message: "...",
          financial_impact: 4200,
          action_label: "Ver faturamentos de alto risco",
          action_href: "/painel",
        },
      ],
    });
    const user = userEvent.setup();

    renderWithProviders(<HomePage />);

    expect(await screen.findByText("Convênio recusando mais pagamentos")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Ver faturamentos de alto risco" });
    await user.click(button);
    expect(navigateMock).toHaveBeenCalledWith("/painel");
  });

  it("destino '#...' de um card navega pra Sala de Comando, não pra um link inexistente", async () => {
    mockEndpoints({
      period_start: "2026-09-10",
      period_end: "2026-09-16",
      narrative: "Resumo do dia.",
      generated_at: "2026-09-16T08:00:00Z",
      top_priorities: [
        {
          severity: "warning",
          category: "agenda",
          title: "Agenda com mais horários vazios",
          message: "...",
          financial_impact: null,
          action_label: "Ver ocupação por profissional",
          action_href: "#agenda-resumo",
        },
      ],
    });
    const user = userEvent.setup();

    renderWithProviders(<HomePage />);

    const button = await screen.findByRole("button", { name: "Ver ocupação por profissional" });
    await user.click(button);
    expect(navigateMock).toHaveBeenCalledWith("/decisao");
  });

  it("sem prioridades, mostra o estado 'tudo certo' em vez de nada", async () => {
    mockEndpoints({
      period_start: "2026-09-10",
      period_end: "2026-09-16",
      narrative: null,
      generated_at: null,
      top_priorities: [],
    });

    renderWithProviders(<HomePage />);

    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(await screen.findByText("Nenhuma prioridade urgente agora — tudo dentro do esperado.")).toBeInTheDocument();
  });

  it("botão 'Ver tudo na Sala de Comando' navega pra /decisao", async () => {
    mockEndpoints({
      period_start: "2026-09-10",
      period_end: "2026-09-16",
      narrative: "Resumo do dia.",
      generated_at: "2026-09-16T08:00:00Z",
      top_priorities: [],
    });
    const user = userEvent.setup();

    renderWithProviders(<HomePage />);

    const button = await screen.findByRole("button", { name: /Ver tudo na Sala de Comando/ });
    await user.click(button);
    expect(navigateMock).toHaveBeenCalledWith("/decisao");
  });
});
