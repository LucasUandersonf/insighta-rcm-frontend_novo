import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { MockCheckoutPage } from "@/pages/MockCheckoutPage";
import { apiClient, ApiError } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { CheckoutDetail } from "@/lib/types";

// Achado CRÍTICO da Auditoria de Prontidão v1 ("produto não se cobra
// sozinho") — checkout de upgrade self-service (ver DECISÃO completa em
// app/services/payment_provider.py, backend).
vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

function apiError(message: string): ApiError {
  return new ApiError(400, { error_code: "erro_generico", message, request_id: "req-1" });
}

function makeCheckout(overrides: Partial<CheckoutDetail> = {}): CheckoutDetail {
  return {
    id: "checkout-1",
    plan_tier: "professional",
    status: "pending",
    amount_cents: 69700,
    created_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

function renderAtCheckout(checkoutId: string) {
  return renderWithProviders(<Routes>{<Route path="/checkout/mock/:checkoutId" element={<MockCheckoutPage />} />}</Routes>, {
    route: `/checkout/mock/${checkoutId}`,
  });
}

describe("MockCheckoutPage", () => {
  it("mostra os dados do checkout pendente e confirma o pagamento simulado", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(makeCheckout() as never);
    vi.mocked(apiClient.post).mockResolvedValue({ plan_tier: "professional" } as never);
    const user = userEvent.setup();

    renderAtCheckout("checkout-1");

    expect(await screen.findByText("Finalizar upgrade")).toBeInTheDocument();
    expect(screen.getByText("R$ 697,00")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Nome no cartão/), "Maria Silva");
    await user.type(screen.getByLabelText(/Número do cartão/), "4111111111111111");
    await user.type(screen.getByLabelText(/Validade/), "12/30");
    await user.type(screen.getByLabelText(/CVV/), "123");
    await user.click(screen.getByRole("button", { name: /pagar/i }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/api/v1/subscription/checkout/checkout-1/confirm", {}));
    expect(await screen.findByText("Plano Professional ativado")).toBeInTheDocument();
  });

  it("valida os campos do cartão no cliente antes de chamar a API", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(makeCheckout() as never);
    // Os mocks de apiClient.* não são resetados entre testes deste arquivo
    // (sem clearMocks no vitest.config) — só a CONTAGEM de chamadas
    // persiste do teste anterior. Limpa aqui porque este é o único teste
    // que afirma "nunca foi chamado".
    vi.mocked(apiClient.post).mockClear();

    renderAtCheckout("checkout-1");

    await screen.findByText("Finalizar upgrade");
    // Dispara o evento `submit` direto no <form> em vez de clicar no botão:
    // os campos usam `required` NATIVO do HTML — um clique real seria
    // bloqueado pela validação nativa do navegador/jsdom ANTES do
    // onSubmit do React rodar, então nunca chegaria na validação em JS
    // que este teste quer cobrir (mesmo padrão de UploadCenterPage.test.tsx).
    const form = screen.getByRole("button", { name: /pagar/i }).closest("form")!;
    fireEvent.submit(form);

    expect(await screen.findByText(/Preencha todos os campos do cartão/)).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("mostra o checkout já confirmado sem exigir pagamento de novo", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(makeCheckout({ status: "completed" }) as never);

    renderAtCheckout("checkout-1");

    expect(await screen.findByText("Plano Professional ativado")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Número do cartão/)).not.toBeInTheDocument();
  });

  it("mostra erro da API sem travar a tela quando a confirmação falha", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(makeCheckout() as never);
    vi.mocked(apiClient.post).mockRejectedValue(apiError("Checkout já está 'completed' — não pode ser confirmado de novo."));
    const user = userEvent.setup();

    renderAtCheckout("checkout-1");

    await screen.findByText("Finalizar upgrade");
    await user.type(screen.getByLabelText(/Nome no cartão/), "Maria Silva");
    await user.type(screen.getByLabelText(/Número do cartão/), "4111111111111111");
    await user.type(screen.getByLabelText(/Validade/), "12/30");
    await user.type(screen.getByLabelText(/CVV/), "123");
    await user.click(screen.getByRole("button", { name: /pagar/i }));

    expect(await screen.findByText("Checkout já está 'completed' — não pode ser confirmado de novo.")).toBeInTheDocument();
  });

  it("mostra estado de checkout não encontrado quando a API devolve 404", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(apiError("Checkout não encontrado."));

    renderAtCheckout("nao-existe");

    expect(await screen.findByText("Checkout não encontrado")).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(makeCheckout() as never);
    vi.mocked(apiClient.post).mockResolvedValue({ plan_tier: "professional" } as never);

    const { container } = renderAtCheckout("checkout-1");

    expect(await screen.findByText("Finalizar upgrade")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
