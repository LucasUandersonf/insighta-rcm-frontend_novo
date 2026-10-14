import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { SubscriptionPage } from "@/pages/SubscriptionPage";
import { BillingGate } from "@/components/billing/BillingGate";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";
import type { PlanCatalogEntry, SubscriptionOffer, SubscriptionStatus } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});
vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));

const PENDING: SubscriptionStatus = {
  plan_tier: "basic",
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
  plan: "basic",
  contracted_plan: "basic",
  in_trial: false,
  trial_ends_at: null,
  billing_cycle: "monthly",
  pending_plan: null,
  read_only: false,
};
const OFFER: SubscriptionOffer = {
  available: true,
  plan_tier: "founders",
  price_cents: 80000,
  founders: true,
  founders_slots_total: 7,
  founders_slots_remaining: 5,
  founders_lock_months: 0,
  pro_price_cents: 129000,
  basic_price_cents: 49000,
};
const PLANS: PlanCatalogEntry[] = [
  { tier: "basic", label: "Basic", monthly_price_cents: 49000, self_service: true, yearly_price_cents: 490000, limits: null, features: [] },
  { tier: "pro", label: "Pro", monthly_price_cents: 129000, self_service: true, yearly_price_cents: 1290000, limits: null, features: ["ask_ai"] },
  { tier: "redes", label: "Redes", monthly_price_cents: 0, self_service: false, yearly_price_cents: null, limits: null, features: [] },
];

function mockGet(status: SubscriptionStatus, offer: SubscriptionOffer = OFFER) {
  vi.mocked(apiClient.get).mockImplementation(((path: string) =>
    Promise.resolve(
      path.endsWith("/offer") ? offer : path.endsWith("/plans") ? PLANS : path.endsWith("/usage") ? undefined : status,
    )) as never);
}

describe("SubscriptionPage", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { sub: "u1", role: "owner" }, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
  });

  it("mostra Basic, Pro e a vaga Founders, e assina o Pro anual", async () => {
    mockGet(PENDING);
    vi.mocked(apiClient.post).mockResolvedValue({ checkout_id: "c1", checkout_url: "https://sandbox.asaas.com/i/abc", amount_cents: 1290000, plan_tier: "pro" } as never);
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { ...window.location, assign, origin: "http://localhost" }, writable: true });
    renderWithProviders(<SubscriptionPage />);

    expect(await screen.findByText("Pro Founders")).toBeInTheDocument();
    expect(screen.getByText("Restam 5 de 7")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Anual/ }));
    await userEvent.click(screen.getByRole("button", { name: "Assinar o Pro" }));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/subscription/checkout", { plan_tier: "pro", billing_cycle: "yearly" }),
    );
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://sandbox.asaas.com/i/abc"));
  });

  it("Founders sai sempre no mensal", async () => {
    mockGet(PENDING);
    vi.mocked(apiClient.post).mockResolvedValue({ checkout_id: "c2", checkout_url: "/checkout/mock/c2", amount_cents: 80000, plan_tier: "founders" } as never);
    renderWithProviders(<SubscriptionPage />);
    await userEvent.click(await screen.findByRole("radio", { name: /Anual/ }));
    await userEvent.click(screen.getByRole("button", { name: /Garantir minha vaga Founders/ }));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/subscription/checkout", { plan_tier: "founders", billing_cycle: "monthly" }),
    );
  });

  it("quem já assina o Basic troca para o Pro na hora", async () => {
    mockGet({ ...PENDING, billing_status: "active", access_allowed: true, current_price_cents: 49000 });
    vi.mocked(apiClient.post).mockResolvedValue({
      plan: "pro", pending_plan: null, effective_at: "now", proration_cents: 0, proration_invoice_url: null, message: "Pronto: a clínica está no Pro.",
    } as never);
    renderWithProviders(<SubscriptionPage />);
    expect(await screen.findByText("Seu plano")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mudar para o Pro agora" }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/api/v1/subscription/change-plan", { plan_tier: "pro" }));
  });

  it("mostra o teste do Pro com os dias que faltam", async () => {
    const inThreeDays = new Date(Date.now() + 3 * 86_400_000 - 60_000).toISOString();
    mockGet({ ...PENDING, access_allowed: true, plan: "pro", in_trial: true, trial_ends_at: inThreeDays });
    renderWithProviders(<SubscriptionPage />);
    expect(await screen.findByText("Teste do Pro: faltam 3 dias")).toBeInTheDocument();
  });

  it("clínica Founders vê o preço travado enquanto for cliente", async () => {
    mockGet({ ...PENDING, plan: "pro", contracted_plan: "pro", billing_status: "active", access_allowed: true, founders_member: true, current_price_cents: 80000 });
    renderWithProviders(<SubscriptionPage />);
    expect(await screen.findByText(/enquanto for cliente, só com reajuste anual pelo IPCA/)).toBeInTheDocument();
    expect(screen.queryByText("Pro Founders")).not.toBeInTheDocument();
  });

  it("quem não é dono não vê os botões de assinar", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { sub: "u2", role: "financeiro" }, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
    mockGet(PENDING);
    renderWithProviders(<SubscriptionPage />);
    expect(await screen.findByText(/Peça ao responsável/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Assinar o/ })).not.toBeInTheDocument();
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

  it("modo leitura: fica no sistema com o aviso, sem ir para Assinatura", async () => {
    mockGet({ ...PENDING, read_only: true });
    renderWithProviders(
      <Routes>
        <Route element={<BillingGate />}>
          <Route path="/" element={<p>Sala de Comando</p>} />
        </Route>
        <Route path="/assinatura" element={<p>Tela de assinatura</p>} />
      </Routes>
    );
    expect(await screen.findByText("Sala de Comando")).toBeInTheDocument();
    expect(await screen.findByText(/Modo leitura/)).toBeInTheDocument();
  });
});
