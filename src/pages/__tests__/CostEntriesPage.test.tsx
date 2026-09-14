import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { CostEntriesPage } from "@/pages/CostEntriesPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { CostEntry, PaginatedResponse, Professional } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), delete: vi.fn() } };
});

function makeEntry(overrides: Partial<CostEntry> = {}): CostEntry {
  return {
    id: "entry-1",
    category: "aluguel",
    description: "Aluguel da sala",
    amount: 3000,
    period_month: "2026-09-01",
    professional_id: null,
    created_by: "u1",
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

describe("CostEntriesPage — épico F3.1 do Plano Diretor", () => {
  it("lista custos lançados, com categoria/mês/valor", async () => {
    const entriesPage: PaginatedResponse<CostEntry> = { items: [makeEntry()], total: 1, limit: 20, offset: 0 };
    mockGetByPath({ "/api/v1/professionals": [] as Professional[], "/api/v1/cost-entries": entriesPage });

    renderWithProviders(<CostEntriesPage />);

    await waitFor(() => expect(screen.getByText("Aluguel")).toBeInTheDocument());
    expect(screen.getByText("Aluguel da sala")).toBeInTheDocument();
    expect(screen.getByText("R$ 3.000,00")).toBeInTheDocument();
    expect(screen.getByText("Geral")).toBeInTheDocument();
  });

  it("lança um novo custo associado a um profissional", async () => {
    const entriesPage: PaginatedResponse<CostEntry> = { items: [], total: 0, limit: 20, offset: 0 };
    const professionals: Professional[] = [
      { id: "prof-1", full_name: "Dr. Custo", professional_registry: null, specialty: null, is_active: true, availability: [] },
    ];
    mockGetByPath({ "/api/v1/professionals": professionals, "/api/v1/cost-entries": entriesPage });
    vi.mocked(apiClient.post).mockResolvedValue(makeEntry({ id: "entry-2" }));

    renderWithProviders(<CostEntriesPage />);
    await waitFor(() => expect(screen.getByText("Nenhum custo lançado ainda.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /lançar custo/i }));
    const modalTitle = await screen.findByRole("heading", { name: "Lançar custo" });
    const dialog = (modalTitle.closest('[role="dialog"]') ?? modalTitle.parentElement!) as HTMLElement;

    fireEvent.change(within(dialog).getByLabelText(/Categoria/), { target: { value: "comissao_repasse" } });
    fireEvent.change(within(dialog).getByLabelText(/Valor/), { target: { value: "500" } });
    fireEvent.change(within(dialog).getByLabelText(/Profissional/), { target: { value: "prof-1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lançar custo" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/cost-entries",
        expect.objectContaining({ category: "comissao_repasse", amount: 500, professional_id: "prof-1" })
      )
    );
  });

  it("remove um lançamento de custo", async () => {
    const entriesPage: PaginatedResponse<CostEntry> = { items: [makeEntry()], total: 1, limit: 20, offset: 0 };
    mockGetByPath({ "/api/v1/professionals": [] as Professional[], "/api/v1/cost-entries": entriesPage });
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);

    renderWithProviders(<CostEntriesPage />);
    await waitFor(() => expect(screen.getByText("Aluguel")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /remover/i }));
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/cost-entries/entry-1"));
  });
});
