import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { FaturasPage } from "@/pages/FaturasPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { Fatura, InsurancePlan, Lote, PaginatedResponse } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

function makePlan(overrides: Partial<InsurancePlan> = {}): InsurancePlan {
  return {
    id: "plan-1",
    insurance_company_id: "company-1",
    display_name: "Unimed Nacional",
    normalized_key: "unimed_nacional",
    ans_registry: null,
    is_active: true,
    plan_type: "convenio",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeLote(overrides: Partial<Lote> = {}): Lote {
  return {
    id: "lote-1",
    insurance_plan_id: "plan-1",
    tipo: "consulta",
    status: "fechado",
    fatura_id: null,
    closed_at: "2026-09-01T00:00:00Z",
    created_at: "2026-09-01T00:00:00Z",
    guias_count: 3,
    ...overrides,
  };
}

function makeFatura(overrides: Partial<Fatura> = {}): Fatura {
  return {
    id: "fatura-1",
    insurance_plan_id: "plan-1",
    serie: "TS",
    numero: "1001",
    status: "emitida",
    data_emissao: "2026-09-05T00:00:00Z",
    valor_recebido: null,
    data_recebimento: null,
    created_at: "2026-09-05T00:00:00Z",
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

describe("FaturasPage — Fase 2 do plano de adequação ao fluxo real de mercado", () => {
  it("lista faturas com convênio resolvido, série/número, status e valor recebido", async () => {
    const faturasPage: PaginatedResponse<Fatura> = { items: [makeFatura()], total: 1, limit: 20, offset: 0 };
    mockGetByPath({
      "/api/v1/insurance-companies/plans?include_inactive=true": [makePlan()],
      "/api/v1/insurance-companies/plans": [makePlan()],
      "/api/v1/faturas": faturasPage,
    });

    renderWithProviders(<FaturasPage />);

    await waitFor(() => expect(screen.getByText("Unimed Nacional")).toBeInTheDocument());
    const row = screen.getByText("Unimed Nacional").closest("tr")!;
    expect(within(row).getByText("TS / 1001")).toBeInTheDocument();
    expect(within(row).getByText("Emitida")).toBeInTheDocument();
    expect(within(row).getByText("—")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há fatura gerada", async () => {
    const faturasPage: PaginatedResponse<Fatura> = { items: [], total: 0, limit: 20, offset: 0 };
    mockGetByPath({
      "/api/v1/insurance-companies/plans?include_inactive=true": [makePlan()],
      "/api/v1/insurance-companies/plans": [makePlan()],
      "/api/v1/faturas": faturasPage,
    });

    renderWithProviders(<FaturasPage />);
    await waitFor(() => expect(screen.getByText("Nenhuma fatura gerada ainda.")).toBeInTheDocument());
  });

  it("gera uma fatura selecionando lotes fechados do convênio escolhido", async () => {
    const faturasPage: PaginatedResponse<Fatura> = { items: [], total: 0, limit: 20, offset: 0 };
    const lotesPage: PaginatedResponse<Lote> = { items: [makeLote()], total: 1, limit: 200, offset: 0 };
    mockGetByPath({
      "/api/v1/insurance-companies/plans?include_inactive=true": [makePlan()],
      "/api/v1/insurance-companies/plans": [makePlan()],
      "/api/v1/lotes": lotesPage,
      "/api/v1/faturas": faturasPage,
    });
    vi.mocked(apiClient.post).mockResolvedValue(makeFatura());

    renderWithProviders(<FaturasPage />);
    await waitFor(() => expect(screen.getByText("Nenhuma fatura gerada ainda.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /nova fatura/i }));
    const modalTitle = await screen.findByRole("heading", { name: "Nova fatura" });
    const dialog = (modalTitle.closest('[role="dialog"]') ?? modalTitle.parentElement!) as HTMLElement;

    fireEvent.change(within(dialog).getByLabelText(/Convênio/), { target: { value: "plan-1" } });
    await waitFor(() => expect(within(dialog).getByText(/3 guias/)).toBeInTheDocument());
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Gerar fatura" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/faturas", { lote_ids: ["lote-1"], serie: null, numero: null })
    );
  });

  it("registra a baixa de uma fatura emitida", async () => {
    const faturasPage: PaginatedResponse<Fatura> = { items: [makeFatura()], total: 1, limit: 20, offset: 0 };
    mockGetByPath({
      "/api/v1/insurance-companies/plans?include_inactive=true": [makePlan()],
      "/api/v1/insurance-companies/plans": [makePlan()],
      "/api/v1/faturas": faturasPage,
    });
    vi.mocked(apiClient.post).mockResolvedValue(makeFatura({ status: "paga", valor_recebido: 500 }));

    renderWithProviders(<FaturasPage />);
    await waitFor(() => expect(screen.getByText("Unimed Nacional")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Baixar" }));
    const modalTitle = await screen.findByRole("heading", { name: /Baixa da fatura/ });
    const dialog = (modalTitle.closest('[role="dialog"]') ?? modalTitle.parentElement!) as HTMLElement;

    fireEvent.change(within(dialog).getByLabelText(/Valor recebido/), { target: { value: "500" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Registrar baixa" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/faturas/fatura-1/baixar", { valor_recebido: 500, is_partial: false })
    );
  });

  it("uma fatura já paga não mostra o botão de baixar de novo", async () => {
    const faturasPage: PaginatedResponse<Fatura> = {
      items: [makeFatura({ status: "paga", valor_recebido: 500 })],
      total: 1,
      limit: 20,
      offset: 0,
    };
    mockGetByPath({
      "/api/v1/insurance-companies/plans?include_inactive=true": [makePlan()],
      "/api/v1/insurance-companies/plans": [makePlan()],
      "/api/v1/faturas": faturasPage,
    });

    renderWithProviders(<FaturasPage />);
    await waitFor(() => expect(screen.getByText("Unimed Nacional")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Baixar" })).not.toBeInTheDocument();
  });
});
