import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangeTemporaryPasswordPage } from "@/pages/ChangeTemporaryPasswordPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ logout: vi.fn() }) }));
vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, post: vi.fn() } };
});

describe("ChangeTemporaryPasswordPage", () => {
  it("troca a senha temporária pela nova", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(undefined as never);
    const user = userEvent.setup();
    renderWithProviders(<ChangeTemporaryPasswordPage />, { route: "/trocar-senha" });

    await user.type(screen.getByLabelText("Senha temporária"), "Temp-1234abcd");
    await user.type(screen.getByLabelText("Nova senha"), "senha-forte-123");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "senha-forte-123");
    await user.click(screen.getByRole("button", { name: "Salvar e continuar" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/users/me/change-password", {
        current_password: "Temp-1234abcd",
        new_password: "senha-forte-123",
      }),
    );
  });

  it("não envia quando a confirmação não confere", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangeTemporaryPasswordPage />, { route: "/trocar-senha" });
    await user.type(screen.getByLabelText("Senha temporária"), "Temp-1234abcd");
    await user.type(screen.getByLabelText("Nova senha"), "senha-forte-123");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "outra-senha-99");
    expect(screen.getByText("As senhas não coincidem.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar e continuar" })).toBeDisabled();
  });
});
