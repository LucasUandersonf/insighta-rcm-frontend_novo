import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExecutiveOverviewPage } from "@/pages/ExecutiveOverviewPage";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { CurrentUser } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

// PriorityQueuePanel (aba "Hoje", agora a padrão) usa useAuth() pra
// decidir se mostra os botões de gestão (F1.2/F1.3) — mockado aqui
// pelo mesmo motivo de Sidebar.test.tsx: AuthContext não é montado de
// verdade nos testes de página (ver DECISÃO em test/utils.tsx).
vi.mock("@/context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/AuthContext")>();
  return { ...actual, useAuth: vi.fn() };
});

/**
 * Mock genérico por URL — a Sala de Comando 2.0 busca vários endpoints
 * ao mesmo tempo (executive-summary, smart-insights, health-score,
 * agenda-metrics, network-benchmark); este teste foca na ESTRUTURA de
 * abas, não no conteúdo detalhado de cada painel (já coberto pelos
 * testes próprios de cada painel).
 */
function mockAllEndpoints() {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url.includes("executive-summary")) {
      return Promise.resolve({
        total_billed: { value: 1000, delta_pct: null },
        total_value_saved: { value: 0, delta_pct: null },
        financial_hole: { value: 0, delta_pct: null },
        payment_gap: { value: 0, delta_pct: null },
        margin_vs_contracted_pct: null,
        avg_capacity_utilization: null,
        high_risk_pending_count: 0,
        appeals_due_soon_count: 0,
        denial_risk_pct: null,
        denial_at_risk_value: 0,
        avg_days_to_receive: null,
      } as never);
    }
    if (url.includes("smart-insights")) {
      return Promise.resolve({ period_start: "2026-01-01", period_end: "2026-01-07", insights: [] } as never);
    }
    if (url.includes("daily-summary")) {
      return Promise.resolve({ date: "2026-01-07", headline: "Nenhum atendimento agendado pra hoje ainda.", sentences: ["Nenhum atendimento agendado pra hoje ainda."] } as never);
    }
    if (url.includes("priority-queue")) {
      return Promise.resolve({ period_start: "2026-01-01", period_end: "2026-01-07", items: [], total_considered: 0 } as never);
    }
    if (url.includes("health-score")) {
      return Promise.resolve({ score: null, window_days: 90, components: [] } as never);
    }
    if (url.includes("agenda-metrics")) {
      return Promise.resolve({
        period_start: "2026-01-01",
        period_end: "2026-01-07",
        professionals: [],
        peak_hours: [],
        weekday_histogram: [],
        weekday_no_show_rates: [],
        weekday_cancellation_rates: [],
        weekday_squeeze_in_rates: [],
        no_show_risk_breakdown: [],
        estimated_revenue_at_risk: 0,
        patient_no_show_ranking: [],
        upcoming_risk_appointments: [],
        total_idle_minutes: 0,
        estimated_revenue_lost_to_idle_capacity: 0,
        professionals_without_availability_count: 0,
      } as never);
    }
    if (url.includes("network-benchmark")) {
      return Promise.resolve({ window_days: 90, metrics: [] } as never);
    }
    if (url.includes("oportunidades")) {
      return Promise.resolve({ window_days: 90, items: [] } as never);
    }
    if (url.includes("inactive-patients")) {
      return Promise.resolve({ total_count: 0, inactive_after_days: 365, items: [] } as never);
    }
    if (url.includes("crm-summary")) {
      return Promise.resolve({ avg_patient_age_years: null, avg_days_since_last_visit: null, return_rate: null, return_rate_sample_size: 0 } as never);
    }
    if (url.includes("patient-rfm")) {
      return Promise.resolve({
        as_of: "2026-01-07",
        total_patients: 0,
        segment_counts: [],
        action_items: [],
      } as never);
    }
    if (url.includes("financial-hole-billings")) {
      return Promise.resolve({ period_start: "2026-01-01", period_end: "2026-01-07", total_count: 0, total_hole_value: 0, items: [] } as never);
    }
    if (url.includes("capital-decision-base-data")) {
      return Promise.resolve({
        window_days: 180,
        period_start: "2026-01-01",
        period_end: "2026-01-07",
        available_specialties: [],
        specialty_requested: null,
        used_fallback_clinic_wide: false,
        sample_size: 0,
        min_sample: 2,
        avg_revenue_per_hour: null,
        has_cost_data: false,
        avg_margin_per_hour: null,
        belongs_to_organization: false,
        sibling_units_count: 0,
        avg_monthly_revenue_per_unit: null,
      } as never);
    }
    if (url.includes("/users/me")) {
      return Promise.resolve(null as never);
    }
    return Promise.reject(new Error(`URL não mockada: ${url}`));
  });
}

describe("ExecutiveOverviewPage", () => {
  it("tem só as 5 abas enxutas (Hoje, Faturamento, Agenda, Estoque, Prontuário) e troca entre elas", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { tenant_id: "t1", id: "u1", role: "owner" } as unknown as CurrentUser,
    } as unknown as ReturnType<typeof useAuth>);
    mockAllEndpoints();
    const user = userEvent.setup();
    renderWithProviders(<ExecutiveOverviewPage />);

    expect(await screen.findByText(/Nenhuma ação prioritária agora/)).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent?.trim())).toEqual(["Hoje", "Faturamento", "Agenda", "Estoque", "Prontuário"]);
    for (const removed of [/Diagnóstico/, /CRM/, /Comparativo/, /Simulador/, /Capital/, /ROI/]) {
      expect(screen.queryByRole("tab", { name: removed })).not.toBeInTheDocument();
    }

    await user.click(screen.getByRole("tab", { name: "Faturamento" }));
    expect(await screen.findByRole("heading", { name: "Contratos para renegociar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contas abaixo do combinado" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Agenda" }));
    expect(await screen.findByRole("heading", { name: "Ocupação e faltas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pacientes a reativar" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Contratos para renegociar" })).not.toBeInTheDocument();
  });

  it("links antigos (?tab=crm) caem na aba nova onde o conteúdo foi parar (Agenda)", async () => {
    mockAllEndpoints();
    renderWithProviders(<ExecutiveOverviewPage />, { route: "/decisao?tab=crm" });

    await waitFor(() => expect(screen.getByText("Nenhum paciente parado há mais de 1 ano — sua carteira está ativa.")).toBeInTheDocument());
    expect(screen.getByRole("tab", { name: "Agenda" })).toHaveAttribute("aria-selected", "true");
  });

  it("?tab=diagnostico vira Faturamento; ?tab= inválido abre em Hoje (fallback seguro)", async () => {
    mockAllEndpoints();
    const { unmount } = renderWithProviders(<ExecutiveOverviewPage />, { route: "/decisao?tab=diagnostico" });
    expect(await screen.findByRole("heading", { name: "Contas abaixo do combinado" })).toBeInTheDocument();
    unmount();

    renderWithProviders(<ExecutiveOverviewPage />, { route: "/decisao?tab=algo-que-nao-existe" });
    expect(await screen.findByRole("tab", { name: "Hoje" })).toHaveAttribute("aria-selected", "true");
  });

  it("com ?weekday=/?professional=/?scrollTo= na URL, carrega sem quebrar", async () => {
    mockAllEndpoints();
    vi.mocked(useAuth).mockReturnValue({
      user: { tenant_id: "t1", id: "u1", role: "owner" } as unknown as CurrentUser,
    } as unknown as ReturnType<typeof useAuth>);
    renderWithProviders(<ExecutiveOverviewPage />, { route: "/decisao?weekday=3&scrollTo=agenda-resumo" });

    // Épico F1.1: "Hoje" é a página inicial agora
    expect(await screen.findByText(/Nenhuma ação prioritária agora|Ações prioritárias/)).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { tenant_id: "t1", id: "u1", role: "owner" } as unknown as CurrentUser,
    } as unknown as ReturnType<typeof useAuth>);
    mockAllEndpoints();

    const { container } = renderWithProviders(<ExecutiveOverviewPage />);
    expect(await screen.findByText(/Nenhuma ação prioritária agora/)).toBeInTheDocument();

    await expectNoA11yViolations(container);
  });
});
