import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { GlosasPage } from "@/pages/GlosasPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { BillingSearchItem, Glosa, GlosaReconciliationResponse, PaginatedResponse } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

function makeGlosa(overrides: Partial<Glosa> = {}): Glosa {
  return {
    id: "glosa-1",
    billing_id: "billing-1",
    codigo_motivo: "CID",
    descricao_motivo: "Falta de CID na guia",
    valor_glosado: 250,
    data_recebimento: "2026-09-01T00:00:00Z",
    created_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

function makeReconciliation(overrides: Partial<GlosaReconciliationResponse> = {}): GlosaReconciliationResponse {
  return {
    period_start: "2026-08-26",
    period_end: "2026-09-01",
    by_risk_level: [
      { level: "high", billing_count: 10, glosado_count: 6, valor_glosado_total: 1200 },
      { level: "low", billing_count: 40, glosado_count: 2, valor_glosado_total: 100 },
    ],
    true_positive_count: 6,
    false_positive_count: 4,
    false_negative_count: 2,
    true_negative_count: 38,
    precision_pct: 60.0,
    recall_pct: 75.0,
    valor_glosado_previsto: 1200,
    valor_glosado_nao_previsto: 100,
    ...overrides,
  };
}

function makeBillingSearchItem(overrides: Partial<BillingSearchItem> = {}): BillingSearchItem {
  return {
    id: "billing-1",
    patient_name: "Maria da Silva",
    procedure_code: "10101012",
    insurance_plan_name: "Unimed Nacional",
    charged_value: 300,
    status: "pending",
    denial_risk_level: "high",
    created_at: "2026-09-01T00:00:00Z",
    item_type: null,
    member_card_number: null,
    coparticipation_value: null,
    coparticipation_received: null,
    clinical_documentation_confirmed: null,
    payment_method: null,
    ...overrides,
  };
}

function mockGetByPath(routes: Record<string, unknown>) {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    for (const [prefix, value] of Object.entries(routes)) {
      if (path.startsWith(prefix)) return Promise.resolve(value as never);
    }
    return Promise.reject(new Error(`Sem mock para ${path}`));
  });
}

describe("GlosasPage — Fase 3 do plano de adequação ao fluxo real de mercado", () => {
  it("lista glosas registradas com motivo e valor", async () => {
    const glosasPage: PaginatedResponse<Glosa> = { items: [makeGlosa()], total: 1, limit: 20, offset: 0 };
    mockGetByPath({ "/api/v1/glosas/reconciliacao": makeReconciliation(), "/api/v1/glosas": glosasPage });

    renderWithProviders(<GlosasPage />);

    await waitFor(() => expect(screen.getByText(/Falta de CID na guia/)).toBeInTheDocument());
    expect(screen.getByText("R$ 250,00")).toBeInTheDocument();
  });

  it("mostra a reconciliação Previsto x Realizado com precisão/sensibilidade e a tabela por nível de risco", async () => {
    const glosasPage: PaginatedResponse<Glosa> = { items: [], total: 0, limit: 20, offset: 0 };
    mockGetByPath({ "/api/v1/glosas/reconciliacao": makeReconciliation(), "/api/v1/glosas": glosasPage });

    renderWithProviders(<GlosasPage />);

    await waitFor(() => expect(screen.getByText("60.0%")).toBeInTheDocument());
    expect(screen.getByText("75.0%")).toBeInTheDocument();
    expect(screen.getByText("Alto")).toBeInTheDocument();
    expect(screen.getByText("Baixo")).toBeInTheDocument();
  });

  it("registra uma glosa selecionando o faturamento pelo autocomplete", async () => {
    const glosasPage: PaginatedResponse<Glosa> = { items: [], total: 0, limit: 20, offset: 0 };
    mockGetByPath({
      "/api/v1/glosas/reconciliacao": makeReconciliation(),
      "/api/v1/billing/search": [makeBillingSearchItem()],
      "/api/v1/glosas": glosasPage,
    });
    vi.mocked(apiClient.post).mockResolvedValue(makeGlosa());

    renderWithProviders(<GlosasPage />);
    await waitFor(() => expect(screen.getByText("Nenhuma glosa registrada ainda.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /registrar glosa/i }));
    const modalTitle = await screen.findByRole("heading", { name: "Registrar glosa" });
    const dialog = (modalTitle.closest('[role="dialog"]') ?? modalTitle.parentElement!) as HTMLElement;

    fireEvent.change(within(dialog).getByLabelText(/Buscar faturamento/), { target: { value: "Maria" } });
    const option = await within(dialog).findByText("Maria da Silva");
    fireEvent.click(option);

    fireEvent.change(within(dialog).getByLabelText(/Valor glosado/), { target: { value: "250" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Registrar glosa" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/glosas", {
        billing_id: "billing-1",
        codigo_motivo: null,
        descricao_motivo: null,
        valor_glosado: 250,
      })
    );
  });

  it("não registra sem selecionar um faturamento", async () => {
    // Limpa o histórico de chamadas do teste anterior — este arquivo não
    // usa clearMocks global (vite.config.ts), então o spy é compartilhado
    // entre os testes do mesmo describe.
    vi.mocked(apiClient.post).mockClear();
    const glosasPage: PaginatedResponse<Glosa> = { items: [], total: 0, limit: 20, offset: 0 };
    mockGetByPath({ "/api/v1/glosas/reconciliacao": makeReconciliation(), "/api/v1/glosas": glosasPage });

    renderWithProviders(<GlosasPage />);
    await waitFor(() => expect(screen.getByText("Nenhuma glosa registrada ainda.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /registrar glosa/i }));
    const modalTitle = await screen.findByRole("heading", { name: "Registrar glosa" });
    const dialog = (modalTitle.closest('[role="dialog"]') ?? modalTitle.parentElement!) as HTMLElement;

    fireEvent.change(within(dialog).getByLabelText(/Valor glosado/), { target: { value: "100" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Registrar glosa" }));

    expect(await within(dialog).findByText(/Selecione o faturamento glosado/)).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
