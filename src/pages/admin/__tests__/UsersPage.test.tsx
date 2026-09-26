import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UsersPage } from "@/pages/admin/UsersPage";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { PlatformUser } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));

const USERS: PlatformUser[] = [
  {
    id: "u1",
    email: "financeiro@clinica.com",
    full_name: "Ana Financeiro",
    role: "financeiro",
    is_active: true,
    must_change_password: false,
    last_login_at: "2026-09-20T10:00:00Z",
    created_at: "2026-08-01T10:00:00Z",
    onboarding_completed_at: "2026-08-01T10:00:00Z",
  },
];

describe("UsersPage", () => {
  it("lista os usuários da clínica", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { sub: "owner-1" } } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockResolvedValue(USERS as never);
    renderWithProviders(<UsersPage />);

    expect(await screen.findByText("Ana Financeiro")).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { sub: "owner-1" } } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockResolvedValue(USERS as never);
    const { container } = renderWithProviders(<UsersPage />);

    await screen.findByText("Ana Financeiro");
    await expectNoA11yViolations(container);
  });

  it("dono desliga o MFA de quem perdeu o celular, com confirmação", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { sub: "owner-1", role: "owner" } } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockResolvedValue([{ ...USERS[0], mfa_enabled_at: "2026-09-26T10:00:00Z" }] as never);
    vi.mocked(apiClient.post).mockResolvedValue(undefined as never);
    renderWithProviders(<UsersPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Desligar MFA" }));
    const buttons = await screen.findAllByRole("button", { name: "Desligar MFA" });
    await userEvent.click(buttons[buttons.length - 1]); // o do diálogo de confirmação
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/api/v1/auth/mfa/reset/u1"));
  });

  it("sem MFA ligado, o botão não aparece", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { sub: "owner-1", role: "owner" } } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockResolvedValue(USERS as never);
    renderWithProviders(<UsersPage />);
    await screen.findByText("Ana Financeiro");
    expect(screen.queryByRole("button", { name: "Desligar MFA" })).not.toBeInTheDocument();
  });
});
