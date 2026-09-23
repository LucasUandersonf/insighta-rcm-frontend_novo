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
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
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
  it("atendimento não vê Sala de Comando, módulos financeiros nem a administração", async () => {
    mockUser("atendimento");
    renderWithProviders(<TopBar />);

    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(within(nav).getByRole("link", { name: /Painel/ })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /Consultas/ })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: /Sala de Comando/ })).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Módulos/ }));
    expect(screen.getByRole("link", { name: /Lista de espera/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Central de upload/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Recurso de glosa/ })).not.toBeInTheDocument();

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

  it("busca rápida sugere o módulo pelo nome digitado", async () => {
    mockUser("owner");
    renderWithProviders(<TopBar />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("combobox", { name: "Ir para um módulo" }), "glosa");
    expect(screen.getByRole("option", { name: /Recurso de glosa/ })).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade com o menu do avatar aberto", async () => {
    mockUser("owner");
    const { container } = renderWithProviders(<TopBar />);
    await openAccountMenu();
    await expectNoA11yViolations(container);
  });
});
