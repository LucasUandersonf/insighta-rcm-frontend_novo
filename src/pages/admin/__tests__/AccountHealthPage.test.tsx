import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { AccountHealthPage } from "@/pages/admin/AccountHealthPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { AccountHealth } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("AccountHealthPage", () => {
  it("lista o que falta, com o atalho para resolver", async () => {
    const health: AccountHealth = {
      ok_count: 1,
      attention_count: 1,
      checks: [
        { key: "dados_faturamento", group: "dados", label: "Faturamento", status: "ok", detail: "Último envio ontem.", action_label: null, action_href: null },
        {
          key: "coordenadores",
          group: "equipe",
          label: "Coordenadores por setor",
          status: "atencao",
          detail: "Sem coordenador: Estoque.",
          action_label: "Definir coordenadores",
          action_href: "/admin/users",
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(health);
    renderWithProviders(<AccountHealthPage />);

    expect(await screen.findByText("Sem coordenador: Estoque.")).toBeInTheDocument();
    expect(screen.getByText("1 item precisa de atenção para o Insighta funcionar por completo.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Definir coordenadores" })).toHaveAttribute("href", "/admin/users");
    expect(screen.queryByRole("link", { name: "Importar dados" })).not.toBeInTheDocument();
  });
});
