import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { IntegrationsPage } from "@/pages/admin/IntegrationsPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { ApiKey, WebhookDeliveryEntry, WebhookSubscription } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
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
});
