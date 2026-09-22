import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { confirmPasswordReset } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, confirmPasswordReset: vi.fn() };
});

describe("ResetPasswordPage", () => {
  it("sem token na URL, mostra o estado de link inválido", () => {
    renderWithProviders(<ResetPasswordPage />, { route: "/reset-password" });
    expect(screen.getByText("Link inválido")).toBeInTheDocument();
  });

  it("com token válido, envia a nova senha e mostra a confirmação", async () => {
    vi.mocked(confirmPasswordReset).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />, { route: "/reset-password?token=abc123" });

    await user.type(screen.getByLabelText("Nova senha"), "senha-forte-123");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "senha-forte-123");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(confirmPasswordReset).toHaveBeenCalledWith("abc123", "senha-forte-123");
    expect(await screen.findByText("Senha redefinida")).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade (link inválido)", async () => {
    const { container } = renderWithProviders(<ResetPasswordPage />, { route: "/reset-password" });
    await expectNoA11yViolations(container);
  });

  it("não tem violações de acessibilidade (formulário com token válido)", async () => {
    const { container } = renderWithProviders(<ResetPasswordPage />, { route: "/reset-password?token=abc123" });
    await expectNoA11yViolations(container);
  });
});
