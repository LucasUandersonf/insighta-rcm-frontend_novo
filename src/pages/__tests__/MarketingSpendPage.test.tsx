import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { MarketingSpendPage } from "@/pages/MarketingSpendPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { MarketingSpend, PaginatedResponse } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), delete: vi.fn() } };
});

function makeEntry(overrides: Partial<MarketingSpend> = {}): MarketingSpend {
  return {
    id: "spend-1",
    source: "meta_ads",
    campaign_id: "camp-1",
    campaign_name: "Campanha de Verão",
    spend_date: "2026-09-01",
    amount_spent: 500,
    impressions: null,
    clicks: null,
    created_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("MarketingSpendPage — achado do Dossiê Insighta RCM", () => {
  it("lista gastos lançados, com canal/campanha/valor", async () => {
    const entriesPage: PaginatedResponse<MarketingSpend> = { items: [makeEntry()], total: 1, limit: 20, offset: 0 };
    vi.mocked(apiClient.get).mockResolvedValue(entriesPage);

    renderWithProviders(<MarketingSpendPage />);

    await waitFor(() => expect(screen.getByText("Campanha de Verão")).toBeInTheDocument());
    expect(screen.getByText("Meta Ads (Facebook/Instagram)")).toBeInTheDocument();
    expect(screen.getByText("R$ 500,00")).toBeInTheDocument();
  });

  it("mensagem honesta quando nenhum gasto foi lançado ainda", async () => {
    const entriesPage: PaginatedResponse<MarketingSpend> = { items: [], total: 0, limit: 20, offset: 0 };
    vi.mocked(apiClient.get).mockResolvedValue(entriesPage);

    renderWithProviders(<MarketingSpendPage />);

    await waitFor(() => expect(screen.getByText("Nenhum gasto de marketing lançado ainda.")).toBeInTheDocument());
  });

  it("lança um novo gasto de marketing", async () => {
    const entriesPage: PaginatedResponse<MarketingSpend> = { items: [], total: 0, limit: 20, offset: 0 };
    vi.mocked(apiClient.get).mockResolvedValue(entriesPage);
    vi.mocked(apiClient.post).mockResolvedValue(makeEntry({ id: "spend-2" }));

    renderWithProviders(<MarketingSpendPage />);
    await waitFor(() => expect(screen.getByText("Nenhum gasto de marketing lançado ainda.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /lançar gasto/i }));
    const modalTitle = await screen.findByRole("heading", { name: "Lançar gasto de marketing" });
    const dialog = (modalTitle.closest('[role="dialog"]') ?? modalTitle.parentElement!) as HTMLElement;

    fireEvent.change(within(dialog).getByLabelText(/Canal/), { target: { value: "google_ads" } });
    fireEvent.change(within(dialog).getByLabelText(/Identificador da campanha/), { target: { value: "camp-google-1" } });
    fireEvent.change(within(dialog).getByLabelText(/Valor gasto/), { target: { value: "750" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lançar gasto" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/marketing-spend",
        expect.objectContaining({ source: "google_ads", campaign_id: "camp-google-1", amount_spent: 750 })
      )
    );
  });

  it("remove um lançamento de gasto", async () => {
    const entriesPage: PaginatedResponse<MarketingSpend> = { items: [makeEntry()], total: 1, limit: 20, offset: 0 };
    vi.mocked(apiClient.get).mockResolvedValue(entriesPage);
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);

    renderWithProviders(<MarketingSpendPage />);
    await waitFor(() => expect(screen.getByText("Campanha de Verão")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /remover/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /remover/i }));
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/marketing-spend/spend-1"));
  });
});
