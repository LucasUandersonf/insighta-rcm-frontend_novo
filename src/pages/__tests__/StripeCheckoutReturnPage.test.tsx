import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { StripeCheckoutReturnPage } from "@/pages/StripeCheckoutReturnPage";
import { apiClient, ApiError } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { CheckoutDetail } from "@/lib/types";

// Achado CRÍTICO da Auditoria de Prontidão v1 ("produto não se cobra
// sozinho") — irmã de MockCheckoutPage.test.tsx, mas para a página de
// retorno do Checkout real do Stripe (ver DECISÃO em
// app/services/stripe_payment_provider.py, backend). Esta página nunca
// coleta cartão — só chama /confirm (que revalida com o Stripe) e
// mostra o resultado.
vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

function apiError(message: string): ApiError {
  return new ApiError(422, { error_code: "erro_generico", message, request_id: "req-1" });
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

function renderAtReturn(checkoutId: string, query = "") {
  return renderWithProviders(
    <Routes>{<Route path="/checkout/stripe/:checkoutId" element={<StripeCheckoutReturnPage />} />}</Routes>,
    { route: `/checkout/stripe/${checkoutId}${query}` }
  );
}

describe("StripeCheckoutReturnPage", () => {
  it("confirma automaticamente ao carregar e mostra o plano ativado", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(makeCheckout());
    vi.mocked(apiClient.post).mockResolvedValue({ plan_tier: "professional" });

    renderAtReturn("checkout-1");

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/api/v1/subscription/checkout/checkout-1/confirm", {}));
    expect(await screen.findByText(/Plano Professional ativado/)).toBeInTheDocument();
  });

  it("mostra tela de cancelado sem nunca chamar /confirm quando ?cancelled=1", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(makeCheckout());
    // Sem clearMocks na config do vitest — contagem de chamadas de
    // apiClient.post persiste entre testes deste arquivo (mesmo padrão
    // já documentado em MockCheckoutPage.test.tsx).
    vi.mocked(apiClient.post).mockClear();

    renderAtReturn("checkout-1", "?cancelled=1");

    expect(await screen.findByText("Você saiu do checkout")).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("quando o Stripe ainda não confirmou o pagamento, mostra erro com botão de tentar de novo", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(makeCheckout());
    vi.mocked(apiClient.post).mockRejectedValue(apiError("O Stripe ainda não confirmou este pagamento — aguarde e tente novamente em instantes."));
    const user = userEvent.setup();

    renderAtReturn("checkout-1");

    expect(await screen.findByText("Ainda não conseguimos confirmar")).toBeInTheDocument();
    expect(screen.getByText(/O Stripe ainda não confirmou/)).toBeInTheDocument();

    vi.mocked(apiClient.post).mockResolvedValue({ plan_tier: "professional" });
    await user.click(screen.getByRole("button", { name: "Tentar confirmar de novo" }));
    expect(await screen.findByText(/Plano Professional ativado/)).toBeInTheDocument();
  });

  it("checkout já completado não chama /confirm de novo", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(makeCheckout({ status: "completed" }));
    vi.mocked(apiClient.post).mockClear();

    renderAtReturn("checkout-1");

    expect(await screen.findByText(/Plano Professional ativado/)).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("não tem violações de acessibilidade", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(makeCheckout());
    vi.mocked(apiClient.post).mockResolvedValue({ plan_tier: "professional" });

    const { container } = renderAtReturn("checkout-1");

    expect(await screen.findByText(/Plano Professional ativado/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
