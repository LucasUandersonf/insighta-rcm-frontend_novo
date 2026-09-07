import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginPage } from "@/pages/LoginPage";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const baseAuth = {
  login: vi.fn(),
  loginError: null as string | null,
  isLoggingIn: false,
  loginWithGoogle: vi.fn(),
  isLoggingInWithGoogle: false,
  tenantSelection: null,
  selectTenant: vi.fn(),
  cancelTenantSelection: vi.fn(),
  sessionExpired: false,
  dismissSessionExpired: vi.fn(),
  register: vi.fn(),
  registerError: null,
  isRegistering: false,
  user: null,
  isAuthenticated: false,
  logout: vi.fn(),
};

function mockAuth(overrides: Partial<typeof baseAuth> = {}) {
  vi.mocked(useAuth).mockReturnValue({ ...baseAuth, ...overrides } as unknown as ReturnType<typeof useAuth>);
}

describe("LoginPage", () => {
  it("renderiza os campos de e-mail/senha e o botão de entrar", () => {
    mockAuth();
    renderWithProviders(<LoginPage />);
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar no sistema/ })).toBeInTheDocument();
  });

  it("submeter o formulário chama login com e-mail e senha digitados", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    mockAuth({ login });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "dono@clinica.com");
    await user.type(screen.getByLabelText("Senha"), "senha-123");
    await user.click(screen.getByRole("button", { name: /Entrar no sistema/ }));

    expect(login).toHaveBeenCalledWith("dono@clinica.com", "senha-123");
  });

  it("mostra a mensagem de erro do contexto quando o login falha", () => {
    mockAuth({ loginError: "E-mail ou senha incorretos." });
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("E-mail ou senha incorretos.");
  });

  it("desabilita o botão de entrar enquanto isLoggingIn é true", () => {
    mockAuth({ isLoggingIn: true });
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole("button", { name: /Entrando/ })).toBeDisabled();
  });

  it("mostra o seletor de clínica quando tenantSelection está preenchido, em vez do formulário", () => {
    mockAuth({ tenantSelection: [{ tenant_id: "t1", trade_name: "Clínica A" }] as never });
    renderWithProviders(<LoginPage />);
    expect(screen.getByText("Qual clínica?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clínica A" })).toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
  });

  it("mostra o aviso de sessão expirada quando sessionExpired é true", () => {
    mockAuth({ sessionExpired: true });
    renderWithProviders(<LoginPage />);
    expect(screen.getByText("Sua sessão expirou por segurança.")).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    mockAuth();
    const { container } = renderWithProviders(<LoginPage />);
    await expectNoA11yViolations(container);
  });
});
