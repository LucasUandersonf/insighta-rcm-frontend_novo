import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { PlatformRetentionPanel } from "@/pages/platform/PlatformRetentionPanel";
import { PlatformSourceProfilesPanel } from "@/pages/platform/PlatformSourceProfilesPanel";
import { platformApiClient } from "@/lib/platform-api-client";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/lib/platform-api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/platform-api-client")>();
  return {
    ...actual,
    platformApiClient: { getRetention: vi.fn(), getSourceProfiles: vi.fn(), createSourceProfile: vi.fn(), addSourceProfileSample: vi.fn(), validateSourceProfile: vi.fn() },
  };
});

describe("painéis v1.1 da plataforma", () => {
  it("retenção mostra os sinais de quem está esfriando", async () => {
    vi.mocked(platformApiClient.getRetention).mockResolvedValue([
      {
        tenant_id: "t", trade_name: "Clínica Fria", plan_tier: "pro", billing_status: "active", tenant_age_days: 120,
        snapshot_date: "2026-10-22", oldest_load_days: 18, stale_level: 3, manager_active_days_7d: 0, stalled_demands: 5,
        open_demands: 7, roi_multiple: 0.4, recovered_cumulative: 900, risks: ["Sem importar há 18 dias", "5 demandas paradas"],
      },
    ]);
    renderWithProviders(<PlatformRetentionPanel />);
    expect(await screen.findByText("Clínica Fria")).toBeInTheDocument();
    expect(screen.getByText("Sem importar há 18 dias")).toBeInTheDocument();
    expect(screen.getByText("0 de 7")).toBeInTheDocument();
  });

  it("perfil em rascunho só valida com 3 amostras", async () => {
    vi.mocked(platformApiClient.getSourceProfiles).mockResolvedValue([
      { id: "p", vendor: "Sistema X", report_name: "Faturamento", data_type: "faturamento", status: "rascunho", samples: 2, columns: 9, created_at: "2026-10-22T00:00:00Z", validated_at: null },
    ]);
    renderWithProviders(<PlatformSourceProfilesPanel />);
    expect(await screen.findByText("Rascunho · 2/3 amostras")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validar" })).toBeDisabled();
  });
});
