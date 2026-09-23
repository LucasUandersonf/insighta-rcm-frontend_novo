import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopBar } from "@/components/layout/TopBar";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { CurrentUser } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/context/OnboardingTourContext", () => ({ useOnboardingTour: () => ({ startTour: vi.fn() }) }));

const logoutMock = vi.fn();

function mockUser(role: CurrentUser["role"]) {
  vi.mocked(useAuth).mockReturnValue({
    user: { tenant_id: "t1", sub: "u1", role },
    logout: logoutMock,
  } as unknown as ReturnType<typeof useAuth>);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true } as Response)));
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url.includes("/tenant")) return Promise.resolve({ trade_name: "Clínica Vila Mariana" } as never);
    if (url.includes("users/me")) return Promise.resolve({ id: "u1", full_name: "Marina Souza", email: "marina@clinica.com" } as never);
    if (url.includes("announcements")) return Promise.resolve({ items: [], unread_count: 0 } as never);
    if (url.includes("/team/me"))
      return Promise.resolve({
        profile: "coordenador",
        sectors: [{ sector: "agendamento", label: "Agendamento", coordinator: { id: "u1", full_name: "Carla Mendes" }, is_mine: true }],
      } as never);
    if (url.includes("/team/my-summary")) return Promise.resolve({ open_count: 2 } as never);
    if (url.includes("/team/overview")) return Promise.resolve({ updates: [] } as never);
    if (url.includes("navigation-summary")) return Promise.resolve({ module_alerts: [] } as never);
    return Promise.reject(new Error(`unexpected url in test: ${url}`));
  });
});

async function openAccountMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Conta e configurações" }));
  return user;
}

/**
 * Redesign 2026 ("sem sidebar") — a navegação saiu da barra lateral e
 * foi para a TopBar (linha principal + dropdown "Módulos"), e as
 * configurações da conta foram para o menu do avatar. O RBAC visual
 * continua espelhando o backend: item restrito some para quem não tem o
 * papel, aparece para quem tem.
 */
describe("TopBar", () => {
  it("coordenador (atendimento) vê só Minhas demandas e as telas do próprio setor", async () => {
    mockUser("atendimento");
    renderWithProviders(<TopBar />);

    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(await within(nav).findByRole("link", { name: /Minhas demandas/ })).toBeInTheDocument();
    expect(await within(nav).findByText("2", { selector: "a[href='/'] span" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /Consultas/ })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /Lista de espera/ })).toBeInTheDocument();
    // Nada da visão geral do gestor.
    expect(within(nav).queryByRole("link", { name: /Sala de Comando/ })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: /Painel/ })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: /Equipe/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Módulos/ })).not.toBeInTheDocument();

    await openAccountMenu();
    expect(screen.queryByText("Administração")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Usuários/ })).not.toBeInTheDocument();
  });

  it("owner vê os módulos agrupados e a administração só no menu do avatar", async () => {
    mockUser("owner");
    renderWithProviders(<TopBar />);

    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(within(nav).getByRole("link", { name: /Sala de Comando/ })).toBeInTheDocument();
    // Configurações nunca soltas na barra — só depois de abrir o avatar.
    expect(screen.queryByRole("link", { name: /Integrações e webhooks/ })).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Módulos/ }));
    const faturamento = screen.getByRole("navigation", { name: "Faturamento" });
    expect(within(faturamento).getByRole("link", { name: /Convênios e contratos/ })).toBeInTheDocument();
    expect(within(faturamento).getByRole("link", { name: /Recurso de glosa/ })).toBeInTheDocument();

    await openAccountMenu();
    expect(screen.getByText("Administração")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Usuários e permissões/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Integrações e webhooks/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Minha clínica/ })).toBeInTheDocument();
  });

  it("auditor vê logs de auditoria mas não gestão de usuários", async () => {
    mockUser("auditor");
    renderWithProviders(<TopBar />);

    await openAccountMenu();
    expect(screen.getByRole("link", { name: /Logs de auditoria/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Usuários/ })).not.toBeInTheDocument();
  });

  it("'Sair' fica dentro do menu do avatar e chama logout", async () => {
    mockUser("financeiro");
    renderWithProviders(<TopBar />);

    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
    const user = await openAccountMenu();
    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(logoutMock).toHaveBeenCalled();
  });

  it("dentro de um módulo, o botão Módulos mostra onde o usuário está", async () => {
    mockUser("owner");
    renderWithProviders(<TopBar />, { route: "/contracts" });

    expect(screen.getByRole("button", { name: /Módulos.*Convênios e contratos/ })).toBeInTheDocument();
  });

  it("'Pergunte ao Insighta' oferece a pergunta à IA e os módulos com aquele nome", async () => {
    mockUser("owner");
    vi.mocked(apiClient.post).mockResolvedValue({ question: "glosa", answer: "A glosa subiu por causa da Unimed.", sources: "Baseado em: os insights ativos." } as never);
    renderWithProviders(<TopBar />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("combobox", { name: "Pergunte ao Insighta" }), "glosa");
    expect(screen.getByRole("option", { name: /Ir para Recurso de glosa/ })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /Perguntar ao Insighta: “glosa”/ }));
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/analytics/ask", { question: "glosa" });
    expect(await screen.findByText("A glosa subiu por causa da Unimed.")).toBeInTheDocument();
  });

  it("coordenador não vê a pergunta à IA (visão geral), só o atalho para as telas do setor", async () => {
    mockUser("atendimento");
    renderWithProviders(<TopBar />);
    await screen.findByRole("link", { name: /Minhas demandas/ });
    const user = userEvent.setup();
    await user.type(screen.getByRole("combobox", { name: "Pergunte ao Insighta" }), "espera");
    expect(screen.getByRole("option", { name: /Ir para Lista de espera/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Perguntar ao Insighta/ })).not.toBeInTheDocument();
  });

  it("mostra alertas reais dos módulos, os avisos novos da Equipe e a última importação", async () => {
    mockUser("owner");
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("navigation-summary"))
        return Promise.resolve({
          module_alerts: [{ route: "/denial-appeals", text: "4 prazos vencem nos próximos 7 dias", tone: "critical" }],
          my_open_insights: 3,
          last_import_at: new Date(Date.now() - 12 * 60000).toISOString(),
          last_import_source: "agenda_setembro.xlsx",
          urgent: null,
        } as never);
      if (url.includes("/tenant")) return Promise.resolve({ trade_name: "Clínica Vila Mariana" } as never);
      if (url.includes("users/me")) return Promise.resolve({ id: "u1", full_name: "Marina Souza", email: "m@c.com" } as never);
      if (url.includes("/team/overview"))
        return Promise.resolve({
          updates: [
            { demand_id: "d1", kind: "resolvido", text: "Carla resolveu", at: new Date().toISOString() },
            { demand_id: "d2", kind: "devolvido", text: "Rafael devolveu", at: new Date().toISOString() },
            { demand_id: "d3", kind: "confirmado", text: "Juliana resolveu", at: new Date().toISOString() },
          ],
        } as never);
      return Promise.resolve({ items: [], unread_count: 0 } as never);
    });
    renderWithProviders(<TopBar />);

    expect(await screen.findByText(/Dados atualizados há 12 min · última importação de agenda_setembro.xlsx/)).toBeInTheDocument();
    expect(await screen.findByText("3", { selector: "a[href='/equipe'] span" })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Módulos/ }));
    expect(screen.getByText("4 prazos vencem nos próximos 7 dias")).toBeInTheDocument();
    expect(screen.getByText("Dica")).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade com o menu do avatar aberto", async () => {
    mockUser("owner");
    const { container } = renderWithProviders(<TopBar />);
    await openAccountMenu();
    await expectNoA11yViolations(container);
  });
});
