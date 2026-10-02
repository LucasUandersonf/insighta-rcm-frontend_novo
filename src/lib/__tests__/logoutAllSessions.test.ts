import { describe, expect, it, vi } from "vitest";
import { apiClient, getStoredToken, logoutAllSessionsRequest, storeToken } from "@/lib/api-client";

describe("logoutAllSessionsRequest", () => {
  it("guarda os tokens novos para este aparelho continuar conectado", async () => {
    storeToken("token-antigo");
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({ revoked_count: 2, access_token: "token-novo", refresh_token: "refresh-novo" });

    const result = await logoutAllSessionsRequest();

    expect(post).toHaveBeenCalledWith("/api/v1/auth/logout-all-sessions");
    expect(result.revoked_count).toBe(2);
    expect(getStoredToken()).toBe("token-novo");
    post.mockRestore();
  });
});
