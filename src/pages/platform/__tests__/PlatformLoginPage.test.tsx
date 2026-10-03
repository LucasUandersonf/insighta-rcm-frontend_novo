import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlatformLoginPage } from "@/pages/platform/PlatformLoginPage";
import {
  platformApiClient,
  storePlatformToken,
} from "@/lib/platform-api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import { ApiError } from "@/lib/api-client";

vi.mock("@/lib/platform-api-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/platform-api-client")>();
  return {
    ...actual,
    platformApiClient: { login: vi.fn(), loginMfa: vi.fn() },
    storePlatformToken: vi.fn(),
  };
});

const NO_MFA = {
  access_token: null,
  token_type: "bearer",
  mfa_required: false,
  mfa_setup_required: false,
  mfa_token: null,
  otpauth_uri: null,
  mfa_secret: null,
};

describe("PlatformLoginPage", () => {
  it("renderiza campos de e-mail e senha (self-service, sem 'esqueci minha senha')", () => {
    renderWithProviders(<PlatformLoginPage />);
    expect(
      screen.getByLabelText("E-mail", { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Senha", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/esqueci minha senha/i)).not.toBeInTheDocument();
  });

  it("submeter chama platformApiClient.login e guarda o token retornado", async () => {
    vi.mocked(platformApiClient.login).mockResolvedValue({
      ...NO_MFA,
      access_token: "tok-123",
    });
    const user = userEvent.setup();
    renderWithProviders(<PlatformLoginPage />);

    await user.type(
      screen.getByLabelText("E-mail", { exact: false }),
      "equipe@insighta-rcm.com",
    );
    await user.type(
      screen.getByLabelText("Senha", { exact: false }),
      "senha-secreta",
    );
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(platformApiClient.login).toHaveBeenCalledWith(
      "equipe@insighta-rcm.com",
      "senha-secreta",
    );
    expect(storePlatformToken).toHaveBeenCalledWith("tok-123");
  });

  it("com MFA ativado, pede o código e só então guarda o token", async () => {
    vi.mocked(storePlatformToken).mockClear();
    vi.mocked(platformApiClient.login).mockResolvedValue({
      ...NO_MFA,
      mfa_required: true,
      mfa_token: "mfa-1",
    });
    vi.mocked(platformApiClient.loginMfa).mockResolvedValue({
      ...NO_MFA,
      access_token: "tok-mfa",
    });
    const user = userEvent.setup();
    renderWithProviders(<PlatformLoginPage />);

    await user.type(
      screen.getByLabelText("E-mail", { exact: false }),
      "equipe@insighta-rcm.com",
    );
    await user.type(
      screen.getByLabelText("Senha", { exact: false }),
      "senha-secreta",
    );
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(storePlatformToken).not.toHaveBeenCalled();

    await user.type(
      await screen.findByLabelText("Código", { exact: false }),
      "123456",
    );
    await user.click(screen.getByRole("button", { name: "Verificar" }));
    expect(platformApiClient.loginMfa).toHaveBeenCalledWith("mfa-1", "123456");
    expect(storePlatformToken).toHaveBeenCalledWith("tok-mfa");
  });

  it("mostra mensagem de erro genérica em caso de falha (401)", async () => {
    vi.mocked(platformApiClient.login).mockRejectedValue(
      new ApiError(401, {
        error_code: "credenciais_invalidas",
        message: "E-mail ou senha incorretos.",
        request_id: "-",
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<PlatformLoginPage />);

    await user.type(
      screen.getByLabelText("E-mail", { exact: false }),
      "equipe@insighta-rcm.com",
    );
    await user.type(
      screen.getByLabelText("Senha", { exact: false }),
      "senha-errada",
    );
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-mail ou senha incorretos.",
    );
  });

  it("não tem violações de acessibilidade", async () => {
    const { container } = renderWithProviders(<PlatformLoginPage />);
    await expectNoA11yViolations(container);
  });
});
