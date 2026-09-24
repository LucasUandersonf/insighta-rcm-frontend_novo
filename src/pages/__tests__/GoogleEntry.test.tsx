import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { LoginPage } from "@/pages/LoginPage";
import { SignUpPage } from "@/pages/SignUpPage";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";

/**
 * Entrada pelo Google nas duas telas públicas (pedido do dono do produto:
 * "é importante"). O botão real vem do script do Google e só aparece com
 * VITE_GOOGLE_OAUTH_CLIENT_ID configurado — aqui a configuração é simulada
 * e o botão vira um stub, para qualquer mudança de layout/marketing que o
 * tire da tela quebrar o teste.
 */
vi.mock("@/components/ui/GoogleSignInButton", () => ({
  isGoogleAuthConfigured: true,
  GoogleSignInButton: () => <button type="button">Continuar com o Google</button>,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

function mockAuth() {
  vi.mocked(useAuth).mockReturnValue({
    login: vi.fn(),
    loginError: null,
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
  } as unknown as ReturnType<typeof useAuth>);
}

describe("Entrada pelo Google", () => {
  it("aparece no login", () => {
    mockAuth();
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole("button", { name: "Continuar com o Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar no sistema/ })).toBeInTheDocument();
  });

  it("aparece no cadastro", () => {
    mockAuth();
    renderWithProviders(<SignUpPage />);
    expect(screen.getByRole("button", { name: "Continuar com o Google" })).toBeInTheDocument();
  });
});
