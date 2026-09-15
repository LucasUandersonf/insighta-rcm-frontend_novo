import { describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { RootRedirect } from "@/routes/RootRedirect";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";
import type { CurrentUser } from "@/lib/types";

vi.mock("@/context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/AuthContext")>();
  return { ...actual, useAuth: vi.fn() };
});

function mockUser(role: CurrentUser["role"]) {
  vi.mocked(useAuth).mockReturnValue({
    user: { tenant_id: "t1", id: "u1", role } as unknown as CurrentUser,
  } as unknown as ReturnType<typeof useAuth>);
}

// "Junta Técnica Insighta" — o Painel deixou de ser a rota "/" (virou
// destino de drill-down, não landing page). Este teste prova o motivo
// de RootRedirect existir: sem checar o papel, "atendimento" entraria
// num loop infinito de redirect (sem acesso a /decisao -> "/" -> "/decisao"
// -> ...), porque RoleProtectedRoute manda de volta pra "/" quem não tem
// acesso à Sala de Comando (ver ProtectedRoute.tsx).
describe("RootRedirect", () => {
  function renderAt(role: CurrentUser["role"]) {
    mockUser(role);
    renderWithProviders(
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/decisao" element={<div>Sala de Comando</div>} />
        <Route path="/painel" element={<div>Painel</div>} />
      </Routes>,
      { route: "/" }
    );
  }

  it.each<CurrentUser["role"]>(["owner", "admin", "financeiro", "auditor"])(
    "papel %s com acesso à Sala de Comando é redirecionado para /decisao, nunca para o Painel",
    async (role) => {
      renderAt(role);
      expect(await screen.findByText("Sala de Comando")).toBeInTheDocument();
    }
  );

  it("papel sem acesso à Sala de Comando (atendimento) cai no Painel, não num loop de redirect", async () => {
    renderAt("atendimento");
    expect(await screen.findByText("Painel")).toBeInTheDocument();
  });
});
