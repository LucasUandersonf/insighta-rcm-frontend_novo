import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntegrationsPage } from "@/pages/admin/IntegrationsPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { ApiKey, WebhookDeliveryEntry, WebhookSubscription } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

const KEYS: ApiKey[] = [
  { id: "k1", name: "ERP TotalCare", key_prefix: "insg_ab12", created_at: "2026-09-01T10:00:00Z", last_used_at: null, revoked_at: null },
];
const WEBHOOKS: WebhookSubscription[] = [
  { id: "w1", name: "Slack — financeiro", url: "https://hooks.slack.com/x", event_types: [], active: true, created_at: "2026-09-01T10:00:00Z" },
];
const DELIVERIES: WebhookDeliveryEntry[] = [
  {
    id: "d1",
    subscription_id: "w1",
    event_type: "billing.held_for_review",
    status: "pending",
    attempt_count: 1,
    next_attempt_at: "2026-09-22T10:00:00Z",
    last_error: null,
    created_at: "2026-09-22T09:00:00Z",
    updated_at: "2026-09-22T09:00:00Z",
  },
];

function mockEndpoints({ keys = KEYS, webhooks = WEBHOOKS, deliveries = DELIVERIES }: { keys?: ApiKey[]; webhooks?: WebhookSubscription[]; deliveries?: WebhookDeliveryEntry[] } = {}) {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url.includes("/webhooks/deliveries")) return Promise.resolve(deliveries as never);
    if (url.includes("/webhooks/event-types"))
      return Promise.resolve([
        { event_type: "billing.held_for_review", description: "Cobrança retida para revisão." },
        { event_type: "no_show_risk.high", description: "Agendamento com risco alto de falta." },
      ] as never);
    if (url.includes("/webhooks")) return Promise.resolve(webhooks as never);
    if (url.includes("/api-keys")) return Promise.resolve(keys as never);
    return Promise.reject(new Error(`unexpected url in test: ${url}`));
  });
}

describe("IntegrationsPage", () => {
  it("lista chaves de API e webhooks cadastrados", async () => {
    mockEndpoints();
    renderWithProviders(<IntegrationsPage />);

    expect(await screen.findByText("ERP TotalCare")).toBeInTheDocument();
    expect(await screen.findByText("Slack — financeiro")).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    mockEndpoints();
    const { container } = renderWithProviders(<IntegrationsPage />);

    await screen.findByText("ERP TotalCare");
    await screen.findByText("Slack — financeiro");
    await expectNoA11yViolations(container);
  });

  it("rodada 9 (M4): eventos do webhook vêm do catálogo, marcados em lista", async () => {
    mockEndpoints();
    vi.mocked(apiClient.post).mockResolvedValue({ ...WEBHOOKS[0], id: "w2", secret: "s" } as never);
    const user = userEvent.setup();
    renderWithProviders(<IntegrationsPage />);
    await screen.findByText("Slack — financeiro");
    await user.click(screen.getByRole("button", { name: /Novo webhook/ }));
    await user.type(screen.getByLabelText(/^Nome/), "ERP");
    await user.type(screen.getByLabelText(/URL/), "https://erp.example.com/h");
    await user.click(await screen.findByRole("checkbox", { name: /billing.held_for_review/ }));
    await user.click(screen.getByRole("button", { name: "Cadastrar webhook" }));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/integrations/webhooks", {
        name: "ERP",
        url: "https://erp.example.com/h",
        event_types: ["billing.held_for_review"],
        active: true,
      }),
    );
  });
});
