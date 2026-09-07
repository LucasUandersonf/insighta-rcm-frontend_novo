import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { firstNameFrom, initialsFrom, useCompleteOnboarding, useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import { apiClient } from "@/lib/api-client";
import type { PlatformUser } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const PROFILE: PlatformUser = {
  id: "u1",
  email: "dono@clinica.com",
  full_name: "Lucas Anderson",
  role: "owner",
  is_active: true,
  must_change_password: false,
  last_login_at: null,
  created_at: "2026-01-01T00:00:00Z",
  onboarding_completed_at: null,
};

describe("useCurrentUserProfile", () => {
  it("busca GET /api/v1/users/me e devolve o perfil", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(PROFILE);
    const { result } = renderHook(() => useCurrentUserProfile(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(PROFILE));
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/users/me");
  });
});

describe("useCompleteOnboarding", () => {
  it("chama POST /api/v1/users/me/onboarding-complete", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCompleteOnboarding(), { wrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/users/me/onboarding-complete");
  });
});

describe("firstNameFrom", () => {
  it("extrai o primeiro nome de um nome completo", () => {
    expect(firstNameFrom("Lucas Anderson")).toBe("Lucas");
  });

  it("devolve o próprio valor quando não há espaço", () => {
    expect(firstNameFrom("Lucas")).toBe("Lucas");
  });
});

describe("initialsFrom", () => {
  it("usa a primeira letra do primeiro e do último nome", () => {
    expect(initialsFrom("Lucas Anderson")).toBe("LA");
  });

  it("usa as duas primeiras letras quando há só um nome", () => {
    expect(initialsFrom("Lucas")).toBe("LU");
  });

  it("devolve '?' para uma string vazia", () => {
    expect(initialsFrom("")).toBe("?");
  });
});
