import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { requestPasswordReset } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, requestPasswordReset: vi.fn() };
});

describe("ForgotPasswordPage", () => {
  it("envia o e-mail digitado e mostra a confirmação de envio", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("E-mail"), "dona@clinica.com");
    await user.click(screen.getByRole("button", { name: "Enviar instruções de acesso" }));

    expect(requestPasswordReset).toHaveBeenCalledWith("dona@clinica.com");
    expect(await screen.findByText("Verifique seu e-mail")).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade (formulário inicial)", async () => {
    const { container } = renderWithProviders(<ForgotPasswordPage />);
    await expectNoA11yViolations(container);
  });

  it("não tem violações de acessibilidade (estado 'e-mail enviado')", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { container } = renderWithProviders(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("E-mail"), "dona@clinica.com");
    await user.click(screen.getByRole("button", { name: "Enviar instruções de acesso" }));
    await screen.findByText("Verifique seu e-mail");

    await expectNoA11yViolations(container);
  });
});
