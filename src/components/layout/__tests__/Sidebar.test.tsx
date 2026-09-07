import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuth } from "@/context/AuthContext";
import type { CurrentUser } from "@/lib/types";

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

function mockUser(role: CurrentUser["role"]) {
  vi.mocked(useAuth).mockReturnValue({ user: { tenant_id: "t1", sub: "u1", role } } as unknown as ReturnType<typeof useAuth>);
}

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );
}

/**
 * Espelha o RBAC real do backend (ver DECISÃO em Sidebar.tsx) — um item
 * só deve aparecer pra quem o backend de fato deixaria usar. Este teste
 * prova que o filtro por papel funciona nos dois sentidos: item restrito
 * some para quem não tem o papel, aparece para quem tem.
 */
describe("Sidebar", () => {
  it("atendimento não vê itens administrativos nem financeiros restritos", () => {
    mockUser("atendimento");
    renderSidebar();

    expect(screen.getByRole("link", { name: /Painel/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Consultas/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Sala de Comando/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Central de upload/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Usuários/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Administração")).not.toBeInTheDocument();
  });

  it("owner vê o grupo de Administração e os itens financeiros", () => {
    mockUser("owner");
    renderSidebar();

    expect(screen.getByText("Administração")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Usuários/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sala de Comando/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Convênios e contratos/ })).toBeInTheDocument();
  });

  it("auditor vê logs de auditoria mas não gestão de usuários", () => {
    mockUser("auditor");
    renderSidebar();

    expect(screen.getByRole("link", { name: /Logs de auditoria/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Usuários/ })).not.toBeInTheDocument();
  });
});
