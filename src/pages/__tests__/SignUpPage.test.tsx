import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignUpPage } from "@/pages/SignUpPage";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";

/**
 * LGPD ("vamos chegar a 9.5") — cobre só o checkbox de aceite de Termos/
 * Privacidade (RegisterRequest.terms_accepted no backend, sem default —
 * ver DECISÃO lá): botão de criar conta começa desabilitado, só habilita
 * com o checkbox marcado, e `register` recebe terms_accepted=true.
 * Não duplica cobertura de step 1 (validação de CNPJ/senha) — fora do
 * escopo desta mudança.
 */
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
  registerError: null as string | null,
  isRegistering: false,
  user: null,
  isAuthenticated: false,
  logout: vi.fn(),
};

function mockAuth(overrides: Partial<typeof baseAuth> = {}) {
  vi.mocked(useAuth).mockReturnValue({ ...baseAuth, ...overrides } as unknown as ReturnType<typeof useAuth>);
}

async function fillStep1AndAdvance(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nome da clínica"), "Clínica Teste");
  await user.type(screen.getByLabelText("CNPJ"), "11222333000181");
  await user.type(screen.getByLabelText("Seu nome completo"), "Dona da Clínica");
  await user.type(screen.getByLabelText("E-mail"), "dona@clinica-teste.com");
  await user.type(screen.getByLabelText("Senha"), "senha-forte-123");
  await user.type(screen.getByLabelText("Confirmar senha"), "senha-forte-123");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

describe("SignUpPage — aceite de Termos/Privacidade", () => {
  it("botão 'Criar conta' começa desabilitado até o checkbox ser marcado", async () => {
    mockAuth();
    const user = userEvent.setup();
    renderWithProviders(<SignUpPage />);

    await fillStep1AndAdvance(user);

    const submitButton = screen.getByRole("button", { name: "Criar conta" });
    expect(submitButton).toBeDisabled();

    await user.click(screen.getByRole("checkbox"));
    expect(submitButton).toBeEnabled();
  });

  it("envia terms_accepted=true para register() só depois do checkbox marcado", async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    mockAuth({ register });
    const user = userEvent.setup();
    renderWithProviders(<SignUpPage />);

    await fillStep1AndAdvance(user);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(register).toHaveBeenCalledWith(expect.objectContaining({ terms_accepted: true }));
  });

  it("links de Termos de Uso e Política de Privacidade apontam para as rotas públicas", async () => {
    mockAuth();
    const user = userEvent.setup();
    renderWithProviders(<SignUpPage />);

    await fillStep1AndAdvance(user);

    expect(screen.getByRole("link", { name: "Termos de Uso" })).toHaveAttribute("href", "/termos");
    expect(screen.getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute("href", "/privacidade");
  });

  it("não tem violações de acessibilidade no step 2 (plano + aceite)", async () => {
    mockAuth();
    const user = userEvent.setup();
    const { container } = renderWithProviders(<SignUpPage />);

    await fillStep1AndAdvance(user);
    await expectNoA11yViolations(container);
  });
});
