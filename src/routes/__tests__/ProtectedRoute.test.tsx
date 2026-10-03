import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/useCurrentUserProfile", () => ({ useCurrentUserProfile: vi.fn() }));

function renderAt(route: string) {
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<p>login</p>} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<p>inicio</p>} />
        <Route path="/trocar-senha" element={<p>trocar senha</p>} />
      </Route>
    </Routes>,
    { route },
  );
}

function withProfile(mustChange: boolean | undefined) {
  vi.mocked(useCurrentUserProfile).mockReturnValue({
    data: mustChange === undefined ? undefined : { must_change_password: mustChange },
  } as never);
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true } as never);
});

describe("ProtectedRoute", () => {
  it("sem sessão, manda para o login", () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false } as never);
    withProfile(undefined);
    renderAt("/");
    expect(screen.getByText("login")).toBeInTheDocument();
  });

  it("com senha temporária, força a tela de troca de senha", () => {
    withProfile(true);
    renderAt("/");
    expect(screen.getByText("trocar senha")).toBeInTheDocument();
  });

  it("senha já trocada: segue para a rota pedida", () => {
    withProfile(false);
    renderAt("/");
    expect(screen.getByText("inicio")).toBeInTheDocument();
  });

  it("enquanto o perfil carrega, não bloqueia a navegação", () => {
    withProfile(undefined);
    renderAt("/");
    expect(screen.getByText("inicio")).toBeInTheDocument();
  });
});
