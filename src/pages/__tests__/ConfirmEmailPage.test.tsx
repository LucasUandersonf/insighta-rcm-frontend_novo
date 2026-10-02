import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { ConfirmEmailPage } from "@/pages/ConfirmEmailPage";
import { apiClient, ApiError } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, post: vi.fn() } };
});

describe("ConfirmEmailPage", () => {
  it("confirma o e-mail com o token do link, uma única vez", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(undefined as never);
    renderWithProviders(<ConfirmEmailPage />, { route: "/confirmar-email?token=abc-123" });

    expect(await screen.findByText("E-mail confirmado.")).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/auth/verify-email", { token: "abc-123" }, { skipAuth: true });
  });

  it("mostra o motivo quando o link expirou", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(
      new ApiError(400, { error_code: "erro", message: "Este link de confirmação é inválido ou expirou.", request_id: "r" })
    );
    renderWithProviders(<ConfirmEmailPage />, { route: "/confirmar-email?token=velho" });
    expect(await screen.findByText("Este link de confirmação é inválido ou expirou.")).toBeInTheDocument();
  });

  it("link sem token não chama a API", async () => {
    vi.mocked(apiClient.post).mockClear();
    renderWithProviders(<ConfirmEmailPage />, { route: "/confirmar-email" });
    expect(await screen.findByText(/Link incompleto/)).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
