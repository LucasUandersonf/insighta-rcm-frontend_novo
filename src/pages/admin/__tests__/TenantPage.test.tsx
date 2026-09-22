import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TenantPage } from "@/pages/admin/TenantPage";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { Tenant } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), patch: vi.fn(), post: vi.fn() } };
});

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));

// Épico F2.1 do Plano Diretor ("Calibração por especialidade/porte") —
// prova que a tela expõe specialty + os dois novos pares de limiar
// (risco de glosa, tetos da Nota de Saúde Financeira), todos null por
// padrão (default do módulo), editáveis só pelo owner.
function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: "t1",
    legal_name: "Clínica Teste Ltda",
    trade_name: "Clínica Teste",
    cnpj: "12.345.678/0001-90",
    plan_tier: "starter",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    annual_revenue_goal: null,
    no_show_low_threshold: null,
    no_show_medium_threshold: null,
    specialty: null,
    denial_risk_warning_threshold: null,
    denial_risk_critical_threshold: null,
    health_score_denial_ceiling: null,
    health_score_no_show_ceiling: null,
    ...overrides,
  };
}

/** Escopa dentro de UM Panel (identificado pelo título do header) — vários
 * painéis desta tela repetem os mesmos rótulos de botão ("Salvar
 * limiares", "Sugerir com base no histórico"), mesmo raciocínio de
 * `within(dialog)` usado em CostEntriesPage.test.tsx para modais. */
function panelFor(title: string): HTMLElement {
  const heading = screen.getByText(title);
  return heading.closest(".group") as HTMLElement;
}

function mockGetByPath(routes: Record<string, unknown>) {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    for (const [prefix, value] of Object.entries(routes)) {
      if (path.startsWith(prefix)) return Promise.resolve(value as never);
    }
    return Promise.reject(new Error(`Sem mock para ${path}`));
  });
}

describe("TenantPage — Épico F2.1 do Plano Diretor (Calibração por especialidade/porte)", () => {
  it("owner vê os painéis de calibração com os defaults quando nada foi configurado", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { tenant_id: "t1", sub: "u1", role: "owner" } } as unknown as ReturnType<
      typeof useAuth
    >);
    mockGetByPath({
      "/api/v1/tenant/plans/available": [],
      "/api/v1/subscription/plans": [],
      "/api/v1/subscription": { plan_tier: "starter", pending_checkout_id: null },
      "/api/v1/tenant": makeTenant(),
    });

    renderWithProviders(<TenantPage />);

    await waitFor(() => expect(screen.getByLabelText("Especialidade predominante")).toBeInTheDocument());
    expect(screen.getByLabelText("Especialidade predominante")).toHaveValue("");
    expect(screen.getByText("Limiares de risco de glosa")).toBeInTheDocument();
    expect(screen.getByText(/acima de 15% = atenção, acima de 40% = crítico/)).toBeInTheDocument();
    expect(screen.getByText("Tetos da Nota de Saúde Financeira")).toBeInTheDocument();
    expect(screen.getByText(/25% de glosa, 40% de falta/)).toBeInTheDocument();
  });

  it("owner atualiza a especialidade da clínica", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { tenant_id: "t1", sub: "u1", role: "owner" } } as unknown as ReturnType<
      typeof useAuth
    >);
    mockGetByPath({
      "/api/v1/tenant/plans/available": [],
      "/api/v1/subscription/plans": [],
      "/api/v1/subscription": { plan_tier: "starter", pending_checkout_id: null },
      "/api/v1/tenant": makeTenant(),
    });
    vi.mocked(apiClient.patch).mockResolvedValue(makeTenant({ specialty: "odontologia" }));

    renderWithProviders(<TenantPage />);
    await waitFor(() => expect(screen.getByLabelText("Especialidade predominante")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Especialidade predominante"), { target: { value: "odontologia" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/api/v1/tenant",
        expect.objectContaining({ specialty: "odontologia" })
      )
    );
  });

  it("owner configura os limiares de risco de glosa", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { tenant_id: "t1", sub: "u1", role: "owner" } } as unknown as ReturnType<
      typeof useAuth
    >);
    mockGetByPath({
      "/api/v1/tenant/plans/available": [],
      "/api/v1/subscription/plans": [],
      "/api/v1/subscription": { plan_tier: "starter", pending_checkout_id: null },
      "/api/v1/tenant": makeTenant(),
    });
    vi.mocked(apiClient.patch).mockResolvedValue(
      makeTenant({ denial_risk_warning_threshold: 10, denial_risk_critical_threshold: 35 })
    );

    renderWithProviders(<TenantPage />);
    await waitFor(() => expect(screen.getByText("Limiares de risco de glosa")).toBeInTheDocument());
    const panel = panelFor("Limiares de risco de glosa");

    fireEvent.change(within(panel).getByLabelText("Atenção a partir de (%)"), { target: { value: "10" } });
    fireEvent.change(within(panel).getByLabelText("Crítico a partir de (%)"), { target: { value: "35" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Salvar limiares" }));

    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/tenant", {
        denial_risk_warning_threshold: 10,
        denial_risk_critical_threshold: 35,
      })
    );
  });

  it("owner vê a sugestão calculada e pode preencher os campos com ela", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { tenant_id: "t1", sub: "u1", role: "owner" } } as unknown as ReturnType<
      typeof useAuth
    >);
    mockGetByPath({
      "/api/v1/tenant/plans/available": [],
      "/api/v1/subscription/plans": [],
      "/api/v1/subscription": { plan_tier: "starter", pending_checkout_id: null },
      "/api/v1/tenant/denial-risk-thresholds/suggested": { warning_threshold: 12.5, critical_threshold: 38.2, sample_size: 8 },
      "/api/v1/tenant": makeTenant(),
    });

    renderWithProviders(<TenantPage />);
    await waitFor(() => expect(screen.getByText("Limiares de risco de glosa")).toBeInTheDocument());
    const panel = panelFor("Limiares de risco de glosa");

    fireEvent.click(within(panel).getByRole("button", { name: /sugerir com base no histórico/i }));
    await waitFor(() => expect(within(panel).getByText(/Sugestão \(baseada em 8 meses\)/)).toBeInTheDocument());

    fireEvent.click(within(panel).getByRole("button", { name: "Preencher campos" }));
    expect(within(panel).getByLabelText("Atenção a partir de (%)")).toHaveValue(12.5);
    expect(within(panel).getByLabelText("Crítico a partir de (%)")).toHaveValue(38.2);
  });

  it("owner vê e aplica a sugestão de meta anual (crescimento próprio e ritmo de rede)", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { tenant_id: "t1", sub: "u1", role: "owner" } } as unknown as ReturnType<
      typeof useAuth
    >);
    mockGetByPath({
      "/api/v1/tenant/plans/available": [],
      "/api/v1/subscription/plans": [],
      "/api/v1/subscription": { plan_tier: "starter", pending_checkout_id: null },
      "/api/v1/tenant/annual-goal/suggested": {
        trailing_12_months_total: 100_000,
        own_growth_rate: 0.2,
        own_trend_suggested_goal: 120_000,
        network_growth_median: 0.1,
        network_pace_suggested_goal: 110_000,
        network_cohort_size: 6,
      },
      "/api/v1/tenant": makeTenant(),
    });

    renderWithProviders(<TenantPage />);
    await waitFor(() => expect(screen.getByText("Meta de faturamento anual")).toBeInTheDocument());
    const panel = panelFor("Meta de faturamento anual");

    fireEvent.click(within(panel).getByRole("button", { name: /sugerir com base no histórico/i }));
    await waitFor(() => expect(within(panel).getByText(/Pelo seu crescimento \(20%\)/)).toBeInTheDocument());
    expect(within(panel).getByText(/Pelo ritmo da rede \(10%, 6 clínicas\)/)).toBeInTheDocument();

    const useButtons = within(panel).getAllByRole("button", { name: "Usar" });
    fireEvent.click(useButtons[0]);
    expect(within(panel).getByLabelText("Meta de faturamento anual (R$)")).toHaveValue(120000);

    fireEvent.click(useButtons[1]);
    expect(within(panel).getByLabelText("Meta de faturamento anual (R$)")).toHaveValue(110000);
  });

  it("mostra mensagem honesta quando a sugestão de meta anual não tem base suficiente", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { tenant_id: "t1", sub: "u1", role: "owner" } } as unknown as ReturnType<
      typeof useAuth
    >);
    mockGetByPath({
      "/api/v1/tenant/plans/available": [],
      "/api/v1/subscription/plans": [],
      "/api/v1/subscription": { plan_tier: "starter", pending_checkout_id: null },
      "/api/v1/tenant/annual-goal/suggested": {
        trailing_12_months_total: 50_000,
        own_growth_rate: null,
        own_trend_suggested_goal: null,
        network_growth_median: null,
        network_pace_suggested_goal: null,
        network_cohort_size: 0,
      },
      "/api/v1/tenant": makeTenant(),
    });

    renderWithProviders(<TenantPage />);
    await waitFor(() => expect(screen.getByText("Meta de faturamento anual")).toBeInTheDocument());
    const panel = panelFor("Meta de faturamento anual");

    fireEvent.click(within(panel).getByRole("button", { name: /sugerir com base no histórico/i }));
    await waitFor(() => expect(within(panel).getByText("sem histórico do período anterior suficiente")).toBeInTheDocument());
    expect(within(panel).getByText("sem clínicas suficientes na base ainda")).toBeInTheDocument();
  });

  it("não-owner vê os campos desabilitados e sem botão de salvar", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { tenant_id: "t1", sub: "u2", role: "financeiro" },
    } as unknown as ReturnType<typeof useAuth>);
    mockGetByPath({
      "/api/v1/tenant/plans/available": [],
      "/api/v1/subscription/plans": [],
      "/api/v1/subscription": { plan_tier: "starter", pending_checkout_id: null },
      "/api/v1/tenant": makeTenant(),
    });

    renderWithProviders(<TenantPage />);
    await waitFor(() => expect(screen.getByLabelText("Especialidade predominante")).toBeInTheDocument());

    expect(screen.getByLabelText("Especialidade predominante")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Salvar limiares" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar tetos" })).not.toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { tenant_id: "t1", sub: "u1", role: "owner" } } as unknown as ReturnType<
      typeof useAuth
    >);
    mockGetByPath({
      "/api/v1/tenant/plans/available": [],
      "/api/v1/subscription/plans": [],
      "/api/v1/subscription": { plan_tier: "starter", pending_checkout_id: null },
      "/api/v1/tenant": makeTenant(),
    });

    const { container } = renderWithProviders(<TenantPage />);

    await waitFor(() => expect(screen.getByLabelText("Especialidade predominante")).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});

// Achado da Auditoria Estratégica ("vinculação self-service de unidades
// multi-tenant") — ver DECISÃO completa em
// app/sql/062_organization_invites.sql (backend). O código do convite
// só aparece na resposta de POST /tenant/organization/invite, nunca
// recuperável depois — por isso o teste prova que ele fica visível +
// copiável na tela, não só que a chamada foi feita.
describe("TenantPage — vinculação self-service de unidades (Auditoria Estratégica)", () => {
  it("owner gera um código de convite e pode copiá-lo", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { tenant_id: "t1", sub: "u1", role: "owner" } } as unknown as ReturnType<
      typeof useAuth
    >);
    mockGetByPath({
      "/api/v1/tenant/plans/available": [],
      "/api/v1/subscription/plans": [],
      "/api/v1/subscription": { plan_tier: "starter", pending_checkout_id: null },
      "/api/v1/tenant": makeTenant(),
    });
    vi.mocked(apiClient.post).mockResolvedValue({
      code: "codigo-de-convite-bem-comprido-e-aleatorio",
      organization_name: "Clínica Teste",
      expires_at: "2026-06-15T10:00:00Z",
    });
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    renderWithProviders(<TenantPage />);
    await waitFor(() => expect(screen.getByText("Vincular outra unidade")).toBeInTheDocument());
    const panel = panelFor("Vincular outra unidade");

    await user.click(within(panel).getByRole("button", { name: "Gerar novo código" }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/api/v1/tenant/organization/invite"));
    expect(await within(panel).findByDisplayValue("codigo-de-convite-bem-comprido-e-aleatorio")).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Copiar" }));
    expect(writeText).toHaveBeenCalledWith("codigo-de-convite-bem-comprido-e-aleatorio");
  });

  it("owner entra em uma organização com um código recebido", async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { tenant_id: "t2", sub: "u2", role: "owner" } } as unknown as ReturnType<
      typeof useAuth
    >);
    mockGetByPath({
      "/api/v1/tenant/plans/available": [],
      "/api/v1/subscription/plans": [],
      "/api/v1/subscription": { plan_tier: "starter", pending_checkout_id: null },
      "/api/v1/tenant": makeTenant({ id: "t2" }),
    });
    vi.mocked(apiClient.post).mockResolvedValue({ organization_name: "Grupo Clínica Alfa" });
    const user = userEvent.setup();

    renderWithProviders(<TenantPage />);
    await waitFor(() => expect(screen.getByText("Vincular outra unidade")).toBeInTheDocument());
    const panel = panelFor("Vincular outra unidade");

    await user.type(within(panel).getByLabelText("Código de convite"), "codigo-recebido-por-whatsapp");
    await user.click(within(panel).getByRole("button", { name: "Vincular" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/tenant/organization/join", { code: "codigo-recebido-por-whatsapp" })
    );
  });

  it("não-owner vê a mensagem de permissão em vez dos controles de vinculação", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { tenant_id: "t1", sub: "u2", role: "financeiro" },
    } as unknown as ReturnType<typeof useAuth>);
    mockGetByPath({
      "/api/v1/tenant/plans/available": [],
      "/api/v1/subscription/plans": [],
      "/api/v1/subscription": { plan_tier: "starter", pending_checkout_id: null },
      "/api/v1/tenant": makeTenant(),
    });

    renderWithProviders(<TenantPage />);
    await waitFor(() => expect(screen.getByText("Vincular outra unidade")).toBeInTheDocument());
    const panel = panelFor("Vincular outra unidade");

    expect(within(panel).getByText(/Só o papel "owner" pode gerar convites/)).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Gerar novo código" })).not.toBeInTheDocument();
  });
});
