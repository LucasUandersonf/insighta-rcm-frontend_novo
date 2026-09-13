import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { DenialReasonConfirmationPanel } from "@/components/dashboard/DenialReasonConfirmationPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { DenialReasonConfirmation } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

// Camada 2 do plano de IA preditiva: a regra do motor anti-glosa prevê
// glosa real, ou é ruído parecido com o baseline? Estes testes cobrem o
// contraste mostrado (nunca uma taxa sozinha, sem a base de comparação).
describe("DenialReasonConfirmationPanel", () => {
  it("mostra o baseline e cada motivo com amostra suficiente", async () => {
    const data: DenialReasonConfirmation = {
      baseline_sample_size: 20,
      baseline_denial_rate: 0.2,
      min_sample: 5,
      items: [
        { reason_code: "missing_cid", reason_label: "faltou o código da doença (CID) no atendimento", sample_size: 8, confirmed_denial_rate: 0.8 },
        { reason_code: "no_contract_reference", reason_label: "esse convênio ainda não tem uma tabela de preços cadastrada", sample_size: 6, confirmed_denial_rate: 0.2 },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<DenialReasonConfirmationPanel />);

    await waitFor(() => expect(screen.getByText("Sem motivo sinalizado (base)")).toBeInTheDocument());
    // 20% aparece duas vezes: o baseline e o motivo que NÃO se confirmou
    // (no_contract_reference, taxa igual à base — achado honesto de que
    // essa regra não está prevendo nada).
    expect(screen.getAllByText("20%")).toHaveLength(2);
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("mensagem honesta quando ainda não há faturamento resolvido suficiente", async () => {
    const data: DenialReasonConfirmation = {
      baseline_sample_size: 0,
      baseline_denial_rate: null,
      min_sample: 5,
      items: [],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<DenialReasonConfirmationPanel />);

    await waitFor(() =>
      expect(
        screen.getByText("Ainda sem faturamento resolvido (pago ou glosado de verdade) suficiente para calcular.")
      ).toBeInTheDocument()
    );
  });

  it("mensagem honesta quando há baseline mas nenhum motivo com amostra suficiente ainda", async () => {
    const data: DenialReasonConfirmation = {
      baseline_sample_size: 10,
      baseline_denial_rate: 0.1,
      min_sample: 5,
      items: [],
    };
    vi.mocked(apiClient.get).mockResolvedValue(data);

    renderWithProviders(<DenialReasonConfirmationPanel />);

    await waitFor(() =>
      expect(screen.getByText(/Nenhum motivo com amostra suficiente ainda/)).toBeInTheDocument()
    );
  });
});
