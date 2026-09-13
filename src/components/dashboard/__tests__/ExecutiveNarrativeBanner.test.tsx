import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ExecutiveNarrativeBanner } from "@/components/dashboard/ExecutiveNarrativeBanner";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { ExecutiveNarrative } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

// "O Jarvis pegando os cálculos e transformando em texto explicativo"
// (pedido direto do usuário) — estes testes cobrem o caso feliz e a
// degradação graciosa (nunca um card de erro nesta peça de abertura).
describe("ExecutiveNarrativeBanner", () => {
  it("mostra o texto narrado quando a IA gerou um resumo", async () => {
    const data: ExecutiveNarrative = {
      period_start: "2026-09-07",
      period_end: "2026-09-13",
      narrative: "A clínica faturou bem esta semana, mas o prazo de recebimento merece atenção.",
      generated_at: "2026-09-13T08:00:00Z",
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<ExecutiveNarrativeBanner />);

    await waitFor(() =>
      expect(
        screen.getByText("A clínica faturou bem esta semana, mas o prazo de recebimento merece atenção.")
      ).toBeInTheDocument()
    );
  });

  it("não renderiza nada quando a IA não está configurada ou a geração falhou", async () => {
    const data: ExecutiveNarrative = {
      period_start: "2026-09-07",
      period_end: "2026-09-13",
      narrative: null,
      generated_at: null,
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    const { container } = renderWithProviders(<ExecutiveNarrativeBanner />);

    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(container.querySelector(".border-aura-line\\/30")).not.toBeInTheDocument();
  });

  it("não renderiza nada (nem um erro visível) quando a chamada falha", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error("falha de rede"));

    const { container } = renderWithProviders(<ExecutiveNarrativeBanner />);

    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(container.querySelector(".border-aura-line\\/30")).not.toBeInTheDocument();
    expect(screen.queryByText(/falha/i)).not.toBeInTheDocument();
  });
});
