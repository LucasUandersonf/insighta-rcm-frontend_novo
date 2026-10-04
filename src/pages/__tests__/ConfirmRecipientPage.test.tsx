import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { ConfirmRecipientPage } from "@/pages/ConfirmRecipientPage";
import { apiClient, ApiError } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, post: vi.fn() } };
});

describe("ConfirmRecipientPage (rodada 8, A2)", () => {
  it("confirma o destinatário com o token do link, sem login, uma única vez", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(undefined as never);
    renderWithProviders(<ConfirmRecipientPage />, { route: "/confirmar-destinatario?token=tok-123" });

    expect(await screen.findByText("E-mail confirmado.")).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/report-recipients/confirm-email", { token: "tok-123" }, { skipAuth: true });
  });

  it("mostra o motivo quando o link não vale mais", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(
      new ApiError(400, { error_code: "erro", message: "Este link de confirmação é inválido, expirou ou o e-mail do destinatário mudou.", request_id: "r" }),
    );
    renderWithProviders(<ConfirmRecipientPage />, { route: "/confirmar-destinatario?token=velho" });
    expect(await screen.findByText(/o e-mail do destinatário mudou/)).toBeInTheDocument();
  });
});
