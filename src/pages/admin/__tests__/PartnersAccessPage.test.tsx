import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PartnersAccessPage } from "@/pages/admin/PartnersAccessPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

const active = {
  id: "g-1",
  partner_id: "p-1",
  partner_name: "Escritório Contábil",
  partner_cnpj: "11222333000181",
  status: "ativo",
  acting_role: "financeiro",
  granted_at: "2026-10-01T10:00:00Z",
  revoked_at: null,
  last_session_at: null,
};

describe("PartnersAccessPage", () => {
  it("autoriza pelo CNPJ e revoga com confirmação", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);
    vi.mocked(apiClient.post).mockResolvedValue([active]);
    vi.mocked(apiClient.delete).mockResolvedValue([{ ...active, status: "revogado" }]);
    renderWithProviders(<PartnersAccessPage />);

    expect(await screen.findByText("Nenhum parceiro autorizado.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/CNPJ do escritório/), "11222333000181");
    await userEvent.click(screen.getByRole("button", { name: "Autorizar" }));
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/partner-access", { cnpj: "11.222.333/0001-81", acting_role: "financeiro" });
    expect(await screen.findByText("Escritório Contábil")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Revogar acesso de Escritório Contábil" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Revogar" }));
    expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/partner-access/g-1");
    expect(await screen.findByText("Revogado")).toBeInTheDocument();
  });
});
