import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DossierButton } from "@/components/money/DossierButton";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, getBlob: vi.fn() } };
});

describe("DossierButton", () => {
  it("baixa o dossiê do convênio em PDF com o nome do convênio no arquivo", async () => {
    vi.mocked(apiClient.getBlob).mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }) as never);
    const createUrl = vi.fn(() => "blob:x");
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderWithProviders(<DossierButton planId="p1" planName="São Lucas Saúde" />);
    await userEvent.click(screen.getByRole("button", { name: "Dossiê de negociação de São Lucas Saúde (PDF)" }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(apiClient.getBlob).toHaveBeenCalledWith("/api/v1/financeiro/dossie/p1/pdf");
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("dossie_sao_lucas_saude.pdf");
  });
});
