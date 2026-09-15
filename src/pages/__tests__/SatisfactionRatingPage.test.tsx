import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { SatisfactionRatingPage } from "@/pages/SatisfactionRatingPage";
import { getSatisfactionStatus, submitSatisfactionScore } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";

// Mocka as duas funções nomeadas diretamente (não apiClient.get/post):
// getSatisfactionStatus/submitSatisfactionScore chamam apiClient.get/post
// internamente DENTRO do módulo real de api-client.ts — um mock parcial
// de apiClient.get/post não intercepta essa chamada interna (o closure
// de cada função fica ligado ao `apiClient` do módulo real, não ao
// objeto sobrescrito por fora), então mockar as funções exportadas
// diretamente é o jeito que realmente funciona aqui.
vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, getSatisfactionStatus: vi.fn(), submitSatisfactionScore: vi.fn() };
});

function renderAtToken(token: string) {
  return renderWithProviders(<Routes>{<Route path="/satisfacao/:token" element={<SatisfactionRatingPage />} />}</Routes>, {
    route: `/satisfacao/${token}`,
  });
}

// "Mapa de Dados Insighta" — Domínio Pós-atendimento (Onda 2): página
// PÚBLICA (sem autenticação) do link de avaliação — ver DECISÃO em
// 052_appointment_satisfaction.sql (backend).
describe("SatisfactionRatingPage", () => {
  it("mostra o formulário de estrelas quando o token é válido, e envia a nota escolhida", async () => {
    vi.mocked(getSatisfactionStatus).mockResolvedValue({ valid: true });
    vi.mocked(submitSatisfactionScore).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderAtToken("abc123");

    await waitFor(() => expect(getSatisfactionStatus).toHaveBeenCalledWith("abc123"));
    expect(await screen.findByText("Como foi sua consulta?")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "4 estrelas" }));
    await user.click(screen.getByRole("button", { name: "Enviar avaliação" }));

    await waitFor(() => expect(submitSatisfactionScore).toHaveBeenCalledWith("abc123", 4));
    expect(await screen.findByText("Obrigado pela avaliação!")).toBeInTheDocument();
  });

  it("mostra mensagem de link inválido quando o token não é válido", async () => {
    vi.mocked(getSatisfactionStatus).mockResolvedValue({ valid: false });

    renderAtToken("token-expirado");

    expect(await screen.findByText("Link inválido")).toBeInTheDocument();
    expect(screen.queryByText("Como foi sua consulta?")).not.toBeInTheDocument();
  });

  it("o botão de enviar fica desabilitado até uma estrela ser escolhida", async () => {
    vi.mocked(getSatisfactionStatus).mockResolvedValue({ valid: true });

    renderAtToken("abc123");

    expect(await screen.findByRole("button", { name: "Enviar avaliação" })).toBeDisabled();
  });
});
