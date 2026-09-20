import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function renderSidebar(props: Parameters<typeof Sidebar>[0] = {}) {
  return render(
    <MemoryRouter>
      <Sidebar {...props} />
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

  /**
   * Achado da Auditoria de Prontidão v1 — o drawer mobile/tablet (ver
   * DECISÃO em Sidebar.tsx) só é útil se as três formas de fechar
   * funcionarem: tocar fora (backdrop), o X e navegar. Isto testa o
   * CONTRATO (onCloseMobile chamado), não CSS de posicionamento — jsdom
   * não faz layout real, então visibilidade responsiva não é testável
   * aqui, só o comportamento.
   */
  describe("drawer mobile/tablet", () => {
    it("sem isOpenOnMobile/onCloseMobile, renderiza igual ao uso estático (compatibilidade)", () => {
      mockUser("owner");
      renderSidebar();
      expect(screen.getByRole("link", { name: /Sala de Comando/ })).toBeInTheDocument();
    });

    it("clicar no backdrop chama onCloseMobile", async () => {
      mockUser("owner");
      const onCloseMobile = vi.fn();
      const user = userEvent.setup();
      renderSidebar({ isOpenOnMobile: true, onCloseMobile });

      await user.click(screen.getByTestId("mobile-nav-backdrop"));

      expect(onCloseMobile).toHaveBeenCalledTimes(1);
    });

    it("clicar no botão de fechar (X) chama onCloseMobile", async () => {
      mockUser("owner");
      const onCloseMobile = vi.fn();
      const user = userEvent.setup();
      renderSidebar({ isOpenOnMobile: true, onCloseMobile });

      await user.click(screen.getByRole("button", { name: "Fechar menu" }));

      expect(onCloseMobile).toHaveBeenCalledTimes(1);
    });

    it("clicar num item de navegação chama onCloseMobile (fecha o drawer ao navegar)", async () => {
      mockUser("owner");
      const onCloseMobile = vi.fn();
      const user = userEvent.setup();
      renderSidebar({ isOpenOnMobile: true, onCloseMobile });

      await user.click(screen.getByRole("link", { name: /Sala de Comando/ }));

      expect(onCloseMobile).toHaveBeenCalledTimes(1);
    });

    it("sem isOpenOnMobile, o backdrop não é renderizado", () => {
      mockUser("owner");
      renderSidebar({ onCloseMobile: vi.fn() });
      expect(screen.queryByTestId("mobile-nav-backdrop")).not.toBeInTheDocument();
    });
  });
});
