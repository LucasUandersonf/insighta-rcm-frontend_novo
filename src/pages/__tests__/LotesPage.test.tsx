import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { LotesPage } from "@/pages/LotesPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { Guia, InsurancePlan, Lote, PaginatedResponse } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  };
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
    status: "aberto",
    fatura_id: null,
    closed_at: null,
    created_at: "2026-09-01T00:00:00Z",
    guias_count: 2,
    ...overrides,
  };
}

function makeGuia(overrides: Partial<Guia> = {}): Guia {
  return {
    id: "guia-1",
    insurance_plan_id: "plan-1",
    tipo: "consulta",
    numero: "12345",
    senha: null,
    senha_validade: null,
    tabela_procedimento: null,
    lote_id: null,
    created_at: "2026-09-01T00:00:00Z",
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

describe("LotesPage", () => {
  it("lista lotes com convênio resolvido, tipo, contagem de guias e status", async () => {
    const lotesPage: PaginatedResponse<Lote> = { items: [makeLote()], total: 1, limit: 20, offset: 0 };
    mockGetByPath({
      "/api/v1/insurance-companies/plans?include_inactive=true": [makePlan()],
      "/api/v1/insurance-companies/plans": [makePlan()],
      "/api/v1/lotes": lotesPage,
    });

    renderWithProviders(<LotesPage />);

    await waitFor(() => expect(screen.getByText("Unimed Nacional")).toBeInTheDocument());
    const row = screen.getByText("Unimed Nacional").closest("tr")!;
    expect(within(row).getByText("Consulta")).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
    expect(within(row).getByText("Aberto")).toBeInTheDocument();
  });

  it("filtro de status manda ?status= pro backend, não filtra só no cliente", async () => {
    const lotesPage: PaginatedResponse<Lote> = { items: [makeLote()], total: 1, limit: 20, offset: 0 };
    mockGetByPath({
      "/api/v1/insurance-companies/plans?include_inactive=true": [makePlan()],
      "/api/v1/insurance-companies/plans": [makePlan()],
      "/api/v1/lotes": lotesPage,
    });

    renderWithProviders(<LotesPage />);
    await waitFor(() => expect(screen.getByText("Unimed Nacional")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Fechado" }));

    await waitFor(() =>
      expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith(expect.stringContaining("status=fechado"))
    );
  });

  it("cria um novo lote com convênio e tipo selecionados", async () => {
    const lotesPage: PaginatedResponse<Lote> = { items: [], total: 0, limit: 20, offset: 0 };
    mockGetByPath({
      "/api/v1/insurance-companies/plans?include_inactive=true": [makePlan()],
      "/api/v1/insurance-companies/plans": [makePlan()],
      "/api/v1/lotes": lotesPage,
    });
    vi.mocked(apiClient.post).mockResolvedValue(makeLote() as never);

    renderWithProviders(<LotesPage />);
    await waitFor(() => expect(screen.getByText("Nenhum lote nesta visão.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /novo lote/i }));
    const modal = await screen.findByText("Novo lote de faturamento");
    const dialog = modal.closest('[role="dialog"]') ?? modal.parentElement!;

    fireEvent.change(within(dialog as HTMLElement).getByLabelText(/Convênio/), { target: { value: "plan-1" } });
    fireEvent.click(within(dialog as HTMLElement).getByRole("button", { name: "Criar lote" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/lotes", { insurance_plan_id: "plan-1", tipo: "consulta" })
    );
  });

  it("no detalhe do lote, adiciona uma guia candidata ao lote aberto", async () => {
    const lote = makeLote({ guias_count: 0 });
    const lotesPage: PaginatedResponse<Lote> = { items: [lote], total: 1, limit: 20, offset: 0 };
    mockGetByPath({
      "/api/v1/insurance-companies/plans?include_inactive=true": [makePlan()],
      "/api/v1/insurance-companies/plans": [makePlan()],
      [`/api/v1/lotes/${lote.id}/guias-candidatas`]: [makeGuia()],
      [`/api/v1/lotes/${lote.id}/guias`]: [],
      "/api/v1/lotes": lotesPage,
    });
    vi.mocked(apiClient.post).mockResolvedValue(makeGuia({ lote_id: lote.id }) as never);

    renderWithProviders(<LotesPage />);
    await waitFor(() => expect(screen.getByText("Unimed Nacional")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Ver guias" }));
    await screen.findByText("Guias disponíveis para atribuir");
    await waitFor(() => expect(screen.getByText("12345")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(`/api/v1/lotes/${lote.id}/guias/${"guia-1"}`));
  });

  it("não tem violações de acessibilidade", async () => {
    const lotesPage: PaginatedResponse<Lote> = { items: [makeLote()], total: 1, limit: 20, offset: 0 };
    mockGetByPath({
      "/api/v1/insurance-companies/plans?include_inactive=true": [makePlan()],
      "/api/v1/insurance-companies/plans": [makePlan()],
      "/api/v1/lotes": lotesPage,
    });

    const { container } = renderWithProviders(<LotesPage />);

    await waitFor(() => expect(screen.getByText("Unimed Nacional")).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});
