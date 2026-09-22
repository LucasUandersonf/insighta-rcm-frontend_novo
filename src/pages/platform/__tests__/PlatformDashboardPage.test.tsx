import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { PlatformDashboardPage } from "@/pages/platform/PlatformDashboardPage";
import { platformApiClient } from "@/lib/platform-api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { PlatformAuditLogEntry, TenantUsageSummary } from "@/lib/types";

vi.mock("@/lib/platform-api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/platform-api-client")>();
  return {
    ...actual,
    platformApiClient: { getTenantsUsage: vi.fn(), getAuditLog: vi.fn(), runAlerts: vi.fn() },
    clearStoredPlatformToken: vi.fn(),
  };
});

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

const TENANTS: TenantUsageSummary[] = [
  {
    tenant_id: "t1",
    trade_name: "Clínica Vida Plena",
    plan_tier: "professional",
    tenant_is_active: true,
    tenant_created_at: "2026-01-10T10:00:00Z",
    active_users: 3,
    last_activity_at: "2026-09-20T10:00:00Z",
    events_last_30d: 42,
    patients_total: 120,
    appointments_last_30d: 30,
    billings_last_30d: 25,
    feature_usage_last_30d: { pacientes: 10, agenda: 8, faturamento: 5, recurso_de_glosa: 0, contratos: 0, usuarios: 1 },
    days_since_last_activity: 1,
    engagement_status: "engajado",
  },
];

const AUDIT_LOG: PlatformAuditLogEntry[] = [{ id: 1, actor_email: "equipe@insighta-rcm.com", action: "login", created_at: "2026-09-22T09:00:00Z" }];

function mockEndpoints() {
  vi.mocked(platformApiClient.getTenantsUsage).mockResolvedValue(TENANTS);
  vi.mocked(platformApiClient.getAuditLog).mockResolvedValue(AUDIT_LOG);
}

describe("PlatformDashboardPage", () => {
  it("lista as clínicas com o uso agregado", async () => {
    mockEndpoints();
    renderWithProviders(<PlatformDashboardPage />);

    expect(await screen.findByText("Clínica Vida Plena")).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    mockEndpoints();
    const { container } = renderWithProviders(<PlatformDashboardPage />);

    await screen.findByText("Clínica Vida Plena");
    await expectNoA11yViolations(container);
  });
});
