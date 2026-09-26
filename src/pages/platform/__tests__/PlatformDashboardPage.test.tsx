import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { PlatformDashboardPage } from "@/pages/platform/PlatformDashboardPage";
import { platformApiClient } from "@/lib/platform-api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { PilotMetrics, PlatformAuditLogEntry, TenantUsageSummary } from "@/lib/types";

vi.mock("@/lib/platform-api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/platform-api-client")>();
  return {
    ...actual,
    platformApiClient: { getTenantsUsage: vi.fn(), getAuditLog: vi.fn(), runAlerts: vi.fn(), getPilotMetrics: vi.fn() },
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

const PILOT: PilotMetrics[] = [
  {
    tenant_id: "t1",
    trade_name: "Clínica Aurora",
    tenant_created_at: "2026-09-01T10:00:00Z",
    first_upload_at: "2026-09-03T10:00:00Z",
    days_to_first_upload: 2,
    upload_days_total: 3,
    upload_days_after_first: 2,
    active_weeks_last_4: 3,
    last_login_at: "2026-09-25T10:00:00Z",
    insights_tracked: 4,
    value_found: 5200,
    value_recovered: 1800,
    appeals_created: 2,
    criterio_dados_em_7_dias: true,
    criterio_autonomia: true,
    criterio_uso_semanal: false,
    criterio_valor_3x_mensalidade: true,
    criterio_acao_tomada: true,
    criterios_atingidos: 4,
  },
];

function mockEndpoints() {
  vi.mocked(platformApiClient.getPilotMetrics).mockResolvedValue(PILOT);
  vi.mocked(platformApiClient.getTenantsUsage).mockResolvedValue(TENANTS);
  vi.mocked(platformApiClient.getAuditLog).mockResolvedValue(AUDIT_LOG);
}

describe("PlatformDashboardPage", () => {
  it("lista as clínicas com o uso agregado", async () => {
    mockEndpoints();
    renderWithProviders(<PlatformDashboardPage />);

    expect(await screen.findByText("Clínica Vida Plena")).toBeInTheDocument();
  });

  it("mostra as métricas do piloto por clínica", async () => {
    mockEndpoints();
    renderWithProviders(<PlatformDashboardPage />);

    expect(await screen.findByText("Métricas do piloto")).toBeInTheDocument();
    expect(screen.getByText("4 de 5")).toBeInTheDocument();
    expect(screen.getByText(/5\.200/)).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    mockEndpoints();
    const { container } = renderWithProviders(<PlatformDashboardPage />);

    await screen.findByText("Clínica Vida Plena");
    await expectNoA11yViolations(container);
  });
});
