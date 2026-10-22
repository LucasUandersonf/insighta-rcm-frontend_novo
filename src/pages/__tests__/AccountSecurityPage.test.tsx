import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountSecurityPage } from "@/pages/AccountSecurityPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), patch: vi.fn() }, logoutAllSessionsRequest: vi.fn() };
});
vi.mock("qrcode", () => ({ toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,xx") }));

describe("AccountSecurityPage", () => {
  it("liga a verificação em duas etapas e mostra os códigos de recuperação", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ enabled: false, enabled_at: null, recovery_codes_left: 0 } as never);
    vi.mocked(apiClient.post).mockImplementation((path: string) => {
      if (path.endsWith("/setup")) return Promise.resolve({ secret: "ABCDEF", otpauth_uri: "otpauth://totp/x" } as never);
      if (path.endsWith("/enable")) return Promise.resolve({ recovery_codes: ["AAAA-BBBB", "CCCC-DDDD"] } as never);
      return Promise.reject(new Error(path));
    });

    renderWithProviders(<AccountSecurityPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Ligar verificação em duas etapas/ }));
    expect(await screen.findByText("ABCDEF")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Código do aplicativo"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/api/v1/auth/mfa/enable", { code: "123456" }));
    expect(await screen.findByText("AAAA-BBBB")).toBeInTheDocument();
  });

  it("com MFA ligado, pede um código para desligar", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ enabled: true, enabled_at: "2026-09-26T10:00:00Z", recovery_codes_left: 8 } as never);
    renderWithProviders(<AccountSecurityPage />);
    expect(await screen.findByText("Ligada")).toBeInTheDocument();
    expect(screen.getByText("8 códigos de recuperação restantes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desligar" })).toBeDisabled();
  });

  it("v1.1: salva o celular que recebe os avisos", async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) =>
      Promise.resolve(
        (path.endsWith("/users/me")
          ? { id: "u1", full_name: "Ana", email: "a@x.com", phone_whatsapp: null }
          : { enabled: false, enabled_at: null, recovery_codes_left: 0 }) as never
      )
    );
    vi.mocked(apiClient.patch).mockResolvedValue({ id: "u1", phone_whatsapp: "+5511912345678" } as never);
    renderWithProviders(<AccountSecurityPage />);
    await userEvent.type(await screen.findByLabelText("WhatsApp com DDI e DDD"), "+55 11 91234-5678");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/users/me/contact", { phone_whatsapp: "+55 11 91234-5678" })
    );
  });
});
