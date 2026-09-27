import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { SubscriptionPage } from "@/pages/SubscriptionPage";
import { BillingGate } from "@/components/billing/BillingGate";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";
import type { SubscriptionOffer, SubscriptionStatus } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});
vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));

const PENDING: SubscriptionStatus = {
  plan_tier: "starter",
  pending_checkout_id: null,
  billing_required: true,
  billing_status: "pending_payment",
  access_allowed: false,
  overdue_since: null,
  grace_days: 7,
  founders_member: false,
  price_locked_until: null,
  current_price_cents: null,
  provider: "asaas",
};
const OFFER: SubscriptionOffer = {
  available: true,
  plan_tier: "founders",
  price_cents: 80000,
  founders: true,
  founders_slots_total: 20,
  founders_slots_remaining: 13,
  founders_lock_months: 24,
};

function mockGet(status: SubscriptionStatus, offer: SubscriptionOffer = OFFER) {
  vi.mocked(apiClient.get).mockImplementation(((path: string) =>
    Promise.resolve(path.endsWith("/offer") ? offer : status)) as never);
}

describe("SubscriptionPage", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { sub: "u1", role: "owner" }, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
  });

  it("mostra a oferta Founders e abre a fatura do Asaas", async () => {
    mockGet(PENDING);
    vi.mocked(apiClient.post).mockResolvedValue({ checkout_id: "c1", checkout_url: "https://sandbox.asaas.com/i/abc", amount_cents: 80000, plan_tier: "founders" } as never);
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { ...window.location, assign, origin: "http://localhost" }, writable: true });
    renderWithProviders(<SubscriptionPage />);

    expect(await screen.findByText("Plano Founders")).toBeInTheDocument();
    expect(screen.getByText("13 de 20")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Pagar com Pix, boleto ou cartão/ }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/api/v1/subscription/checkout", { plan_tier: "founders" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://sandbox.asaas.com/i/abc"));
  });

  it("clínica Founders ativa vê o preço garantido", async () => {
    mockGet({ ...PENDING, billing_status: "active", access_allowed: true, founders_member: true, price_locked_until: "2028-09-27", current_price_cents: 80000 });
    renderWithProviders(<SubscriptionPage />);
    expect(await screen.findByText(/preço garantido até/)).toBeInTheDocument();
    expect(screen.getByText("27 de setembro de 2028")).toBeInTheDocument();
  });

  it("quem não é dono não vê o botão de pagar", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { sub: "u2", role: "financeiro" }, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    mockGet(PENDING);
    renderWithProviders(<SubscriptionPage />);
    expect(await screen.findByText(/Peça ao responsável/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pagar com Pix/ })).not.toBeInTheDocument();
  });
});

describe("BillingGate", () => {
  it("leva para Assinatura quando a clínica não está liberada", async () => {
    mockGet(PENDING);
    renderWithProviders(
      <Routes>
        <Route element={<BillingGate />}>
          <Route path="/" element={<p>Sala de Comando</p>} />
        </Route>
        <Route path="/assinatura" element={<p>Tela de assinatura</p>} />
      </Routes>
    );
    expect(await screen.findByText("Tela de assinatura")).toBeInTheDocument();
  });

  it("deixa passar quando o sistema não exige pagamento", async () => {
    mockGet({ ...PENDING, billing_required: false, access_allowed: true, billing_status: "active" });
    renderWithProviders(
      <Routes>
        <Route element={<BillingGate />}>
          <Route path="/" element={<p>Sala de Comando</p>} />
        </Route>
        <Route path="/assinatura" element={<p>Tela de assinatura</p>} />
      </Routes>
    );
    expect(await screen.findByText("Sala de Comando")).toBeInTheDocument();
  });
});
