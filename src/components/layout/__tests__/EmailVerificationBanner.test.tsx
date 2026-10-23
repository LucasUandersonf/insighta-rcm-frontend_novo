import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { EmailVerificationBanner } from "@/components/layout/EmailVerificationBanner";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { tenant_id: "t1", sub: "u1", role: "owner" } }),
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

const profile = (email_verified_at: string | null | undefined) => ({ id: "u1", email: "ana@clinica.com.br", full_name: "Ana", email_verified_at });

describe("EmailVerificationBanner", () => {
  it("aparece enquanto o e-mail não foi confirmado e reenvia o link", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(profile(null) as never);
    vi.mocked(apiClient.post).mockResolvedValue({ status: "enviado", email: "ana@clinica.com.br" } as never);
    renderWithProviders(<EmailVerificationBanner />);

    fireEvent.click(await screen.findByRole("button", { name: "Reenviar confirmação" }));
    expect(await screen.findByText("Enviamos um novo link para ana@clinica.com.br.")).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/auth/verify-email/resend");
  });

  it.each([["2026-10-01T10:00:00Z"], [undefined]])("some com e-mail confirmado (ou API antiga): %s", async (value) => {
    vi.mocked(apiClient.get).mockResolvedValue(profile(value) as never);
    const { container } = renderWithProviders(<EmailVerificationBanner />);
    await vi.waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(container.textContent).not.toContain("Confirme seu e-mail");
  });
});
