import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { PlanGate } from "@/components/billing/PlanGate";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { PlanUsage } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

function usage(features: string[]): PlanUsage {
  const item = { used: 0, limit: null, state: "ok" as const };
  return {
    plan: features.length ? "pro" : "basic",
    plan_label: features.length ? "Pro" : "Basic",
    in_trial: false,
    trial_ends_at: null,
    features,
    history_months: 12,
    appointments: item,
    users: item,
    contract_payers: item,
    coordinator_sectors: item,
  };
}

describe("PlanGate", () => {
  it("no Basic mostra a prévia do Pro no lugar da tela", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(usage([]) as never);
    renderWithProviders(
      <PlanGate feature="margin_inventory">
        <p>Margem por procedimento</p>
      </PlanGate>,
    );
    expect(await screen.findByText("Margem, custos e estoque")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver o plano Pro/ })).toHaveAttribute("href", "/assinatura");
    expect(screen.queryByText("Margem por procedimento")).not.toBeInTheDocument();
  });

  it("no Pro mostra a tela", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(usage(["margin_inventory"]) as never);
    renderWithProviders(
      <PlanGate feature="margin_inventory">
        <p>Margem por procedimento</p>
      </PlanGate>,
    );
    expect(await screen.findByText("Margem por procedimento")).toBeInTheDocument();
  });
});
