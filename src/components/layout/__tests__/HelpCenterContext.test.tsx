import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { HelpCenterModal } from "@/components/layout/HelpCenterModal";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

describe("Central de Ajuda contextual", () => {
  it("em Importar dados, abre já nas dúvidas da importação", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([] as never);
    renderWithProviders(<HelpCenterModal isOpen onClose={() => undefined} onStartTour={() => undefined} />, { route: "/importar" });
    const questions = await screen.findAllByRole("button", { expanded: true });
    expect(questions[0]).toHaveTextContent("A planilha foi recusada por coluna faltando. E agora?");
    expect(screen.getByText(/clique em Mapear colunas e diga qual é qual/)).toBeInTheDocument();
  });

  it("em Plano e assinatura, explica o modo leitura e a troca pendente", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([] as never);
    renderWithProviders(<HelpCenterModal isOpen onClose={() => undefined} onStartTour={() => undefined} />, { route: "/assinatura" });
    expect(await screen.findByText("Por que o sistema está em modo leitura?")).toBeInTheDocument();
    expect(screen.getByText("Pedi o Pro e ele ainda não liberou.")).toBeInTheDocument();
  });
});
