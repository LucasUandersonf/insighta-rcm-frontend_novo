import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CancelSubscriptionPanel } from "@/components/billing/CancelSubscriptionPanel";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

describe("CancelSubscriptionPanel", () => {
  it("só cancela depois de digitar o nome da clínica", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ trade_name: "Clínica Sol" } as never);
    vi.mocked(apiClient.post).mockResolvedValue({
      status: "canceling",
      access_until: "2026-11-01T03:00:00Z",
      provider_confirmed: true,
      message: "Assinatura cancelada.",
    } as never);
    const user = userEvent.setup();
    renderWithProviders(<CancelSubscriptionPanel />);

    await user.click(screen.getByRole("button", { name: "Cancelar assinatura" }));
    const submit = await screen.findByRole("button", { name: "Cancelar assinatura" });
    expect(submit).toBeDisabled();

    await waitFor(() => expect(screen.getByLabelText(/digite o nome da clínica: Clínica Sol/)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/digite o nome da clínica/), "clínica sol");
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/subscription/cancel", { confirm_trade_name: "clínica sol", reason: null })
    );
  });
});
