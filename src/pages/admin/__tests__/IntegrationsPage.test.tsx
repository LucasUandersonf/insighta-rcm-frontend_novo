import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntegrationsPage } from "@/pages/admin/IntegrationsPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { ApiKey, IntegrationStatus, WebhookDeliveryEntry, WebhookSubscription } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), put: vi.fn() } };
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

const feed = (data_type: IntegrationStatus["feeds"][number]["data_type"], label: string, over: Partial<IntegrationStatus["feeds"][number]> = {}) => ({
  data_type,
  label,
  expected: false,
  state: "nao_esperada" as const,
  state_label: "Não configurada na integração",
  detail: "Marque esta perna para o Insighta cobrar a carga toda noite.",
  alarm: false,
  rows_today: 0,
  rejected_today: 0,
  files_today: 0,
  last_automatic_at: null,
  last_automatic_rows: null,
  last_automatic_rejected: null,
  last_any_at: null,
  typical_rows: null,
  ...over,
});

const STATUS: IntegrationStatus = {
  expected_types: ["faturamento", "agenda"],
  alert_hour: 6,
  feeds: [
    feed("faturamento", "Faturamento", { expected: true, state: "ok", state_label: "Carga de hoje recebida", detail: "1.200 linhas recebidas hoje.", rows_today: 1200, typical_rows: 1150 }),
    feed("agenda", "Agenda", { expected: true, state: "nao_chegou", state_label: "A carga de hoje não chegou", detail: "Nada de Agenda chegou pela integração desde as 21h de ontem.", alarm: true }),
    feed("atendimento", "Atendimento"),
    feed("estoque", "Estoque"),
    feed("pep", "Prontuário (PEP)"),
  ],
  last_connector_run: {
    connector_version: "1.0.0",
    host: "srv-erp",
    started_at: "2026-10-18T03:00:00Z",
    finished_at: "2026-10-18T03:04:00Z",
    ok: false,
    results: [
      { data_type: "faturamento", status: "ok", rows_read: 1200, rows_accepted: 1195, rows_rejected: 5, files_sent: 1 },
      { data_type: "agenda", status: "erro", rows_read: 0, rows_accepted: 0, rows_rejected: 0, files_sent: 0, message: "falta a coluna obrigatória status_agendamento" },
    ],
    received_at: "2026-10-18T03:04:00Z",
  },
  recent_alerts: [],
  active_api_keys: 1,
};

function mockEndpoints({ keys = KEYS, webhooks = WEBHOOKS, deliveries = DELIVERIES, features }: { keys?: ApiKey[]; webhooks?: WebhookSubscription[]; deliveries?: WebhookDeliveryEntry[]; features?: string[] } = {}) {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url.includes("/integrations/status")) return Promise.resolve(STATUS as never);
    if (url.includes("/subscription/usage"))
      return features ? Promise.resolve({ plan: "basic", features } as never) : Promise.reject(new Error("sem plano no teste"));
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

  it("mostra a situação de cada perna e a última execução do conector", async () => {
    mockEndpoints();
    renderWithProviders(<IntegrationsPage />);
    expect(await screen.findByText("A carga de hoje não chegou")).toBeInTheDocument();
    expect(screen.getByText("Carga de hoje recebida")).toBeInTheDocument();
    expect(screen.getByText(/falta a coluna obrigatória status_agendamento/)).toBeInTheDocument();
    expect(screen.getByText(/servidor srv-erp/)).toBeInTheDocument();
  });

  it("salva as pernas esperadas e a hora do alarme", async () => {
    mockEndpoints();
    vi.mocked(apiClient.put).mockResolvedValue({ ...STATUS, expected_types: ["faturamento", "agenda", "estoque"], alert_hour: 7 } as never);
    const user = userEvent.setup();
    renderWithProviders(<IntegrationsPage />);
    await screen.findByText("A carga de hoje não chegou");
    await user.click(screen.getByRole("checkbox", { name: "Estoque" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Hora do alarme" }), "7");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith("/api/v1/integrations/settings", {
        expected_types: ["faturamento", "agenda", "estoque"],
        alert_hour: 7,
      }),
    );
  });

  it("no Basic a integração noturna e as chaves ficam liberadas e os webhooks bloqueados", async () => {
    mockEndpoints({ features: [] });
    renderWithProviders(<IntegrationsPage />);
    expect(await screen.findByText("Integração noturna com o ERP")).toBeInTheDocument();
    expect(screen.getByText("Chaves de API")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Slack — financeiro")).not.toBeInTheDocument());
  });
});

