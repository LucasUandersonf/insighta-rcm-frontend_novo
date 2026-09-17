import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { LocaisPage } from "@/pages/LocaisPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { Local } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), patch: vi.fn() } };
});

function makeLocal(overrides: Partial<Local> = {}): Local {
  return {
    id: "local-1",
    nome: "Unidade Centro",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("LocaisPage — Fase 4 do plano de adequação ao fluxo real de mercado", () => {
  it("lista os locais cadastrados", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([makeLocal()]);

    renderWithProviders(<LocaisPage />);

    await waitFor(() => expect(screen.getByText("Unidade Centro")).toBeInTheDocument());
    expect(screen.getByText("Ativo")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há local cadastrado", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);

    renderWithProviders(<LocaisPage />);

    await waitFor(() => expect(screen.getByText("Nenhum local cadastrado ainda.")).toBeInTheDocument());
  });

  it("cadastra um novo local", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);
    vi.mocked(apiClient.post).mockResolvedValue(makeLocal({ id: "local-2", nome: "Unidade Zona Sul" }));

    renderWithProviders(<LocaisPage />);
    await waitFor(() => expect(screen.getByText("Nenhum local cadastrado ainda.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /novo local/i }));
    const modalTitle = await screen.findByRole("heading", { name: "Novo local de atendimento" });
    const dialog = (modalTitle.closest('[role="dialog"]') ?? modalTitle.parentElement!) as HTMLElement;

    fireEvent.change(within(dialog).getByLabelText(/Nome/), { target: { value: "Unidade Zona Sul" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar local" }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/api/v1/locais", { nome: "Unidade Zona Sul" }));
  });

  it("desativa um local ativo", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([makeLocal()]);
    vi.mocked(apiClient.patch).mockResolvedValue(makeLocal({ is_active: false }));

    renderWithProviders(<LocaisPage />);
    await waitFor(() => expect(screen.getByText("Unidade Centro")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));

    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/locais/local-1", { is_active: false })
    );
  });
});
