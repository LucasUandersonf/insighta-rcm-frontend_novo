import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { ContractsPage } from "@/pages/ContractsPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { Contract, InsuranceCompany, InsurancePlan, PaginatedResponse } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

function makeCompany(overrides: Partial<InsuranceCompany> = {}): InsuranceCompany {
  return {
    id: "company-1",
    name: "Unimed",
    ans_registry: null,
    default_appeal_deadline_days: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makePlan(overrides: Partial<InsurancePlan> = {}): InsurancePlan {
  return {
    id: "plan-1",
    insurance_company_id: "company-1",
    display_name: "Unimed Nacional",
    normalized_key: "unimed_nacional",
    ans_registry: null,
    is_active: true,
    plan_type: "convenio",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mockGetByPath(routes: Record<string, unknown>) {
  // Prefixos mais LONGOS (mais específicos) primeiro — evita que
  // "/api/v1/insurance-companies" (bare) capture por engano uma
  // requisição pra "/api/v1/insurance-companies/plans" só porque
  // Object.entries preserva a ordem de inserção, não de especificidade.
  const sortedRoutes = Object.entries(routes).sort(([a], [b]) => b.length - a.length);
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    for (const [prefix, value] of sortedRoutes) {
      if (path.startsWith(prefix)) return Promise.resolve(value as never);
    }
    return Promise.reject(new Error(`Sem mock para ${path}`));
  });
}

const EMPTY_CONTRACTS: PaginatedResponse<Contract> = { items: [], total: 0, limit: 20, offset: 0 };

describe("ContractsPage — plan_type (Onda 3 do Plano de Ação)", () => {
  it("mostra o selo 'Particular' para plano sem operadora", async () => {
    mockGetByPath({
      "/api/v1/insurance-companies?include_inactive=true": [makeCompany()],
      "/api/v1/insurance-companies/plans?include_inactive=true": [
        makePlan({ id: "plan-particular", display_name: "Convênio Particular", insurance_company_id: null, plan_type: "particular" }),
      ],
      "/api/v1/insurance-companies": [makeCompany()],
      "/api/v1/insurance-companies/plans": [makePlan()],
      "/api/v1/contracts": EMPTY_CONTRACTS,
    });

    renderWithProviders(<ContractsPage />, { route: "/convenios?tab=contratos" });

    await waitFor(() => expect(screen.getAllByText("Convênio Particular").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Particular").length).toBeGreaterThan(0);
  });

  it("esconde o seletor de operadora ao escolher tipo Particular e envia sem insurance_company_id", async () => {
    mockGetByPath({
      "/api/v1/insurance-companies?include_inactive=true": [makeCompany()],
      "/api/v1/insurance-companies/plans?include_inactive=true": [],
      "/api/v1/insurance-companies": [makeCompany()],
      "/api/v1/insurance-companies/plans": [],
      "/api/v1/contracts": EMPTY_CONTRACTS,
    });
    vi.mocked(apiClient.post).mockResolvedValue(makePlan({ plan_type: "particular" }));

    renderWithProviders(<ContractsPage />, { route: "/convenios?tab=contratos" });
    await waitFor(() => expect(screen.getByText("Nenhum plano cadastrado.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /novo plano/i }));
    const modalTitle = await screen.findByRole("heading", { name: "Novo plano" });
    const dialog = (modalTitle.closest('[role="dialog"]') ?? modalTitle.parentElement!) as HTMLElement;

    expect(within(dialog).getByLabelText(/Operadora/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Tipo/), { target: { value: "particular" } });
    expect(within(dialog).queryByLabelText(/Operadora/)).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/Nome do plano/), { target: { value: "Particular" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar plano" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/insurance-companies/plans",
        expect.objectContaining({ plan_type: "particular", insurance_company_id: null })
      )
    );
  });

  it("Novo convênio: um formulário só, sem registro ANS para particular (UX-07)", async () => {
    mockGetByPath({
      "/api/v1/insurance-companies?include_inactive=true": [],
      "/api/v1/insurance-companies/plans?include_inactive=true": [],
      "/api/v1/insurance-companies": [],
      "/api/v1/insurance-companies/plans": [],
      "/api/v1/contracts": EMPTY_CONTRACTS,
    });
    vi.mocked(apiClient.post).mockResolvedValue({ plan: makePlan({ display_name: "Unimed Nacional" }), resolved_rows: 12 });

    renderWithProviders(<ContractsPage />, { route: "/convenios?tab=contratos" });
    fireEvent.click(await screen.findByRole("button", { name: /novo convênio/i }));
    const modalTitle = await screen.findByRole("heading", { name: "Novo convênio" });
    const dialog = (modalTitle.closest('[role="dialog"]') ?? modalTitle.parentElement!) as HTMLElement;

    expect(within(dialog).getByLabelText(/Registro ANS/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText(/particular/i));
    expect(within(dialog).queryByLabelText(/Registro ANS/)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText(/particular/i));

    fireEvent.change(within(dialog).getByLabelText(/Nome do convênio/), { target: { value: "Unimed Nacional" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar convênio" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/insurance-companies/convenios",
        expect.objectContaining({ name: "Unimed Nacional", plan_type: "convenio" })
      )
    );
    expect(await screen.findByText(/12 linhas importadas que esperavam por ele entraram/)).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    mockGetByPath({
      "/api/v1/insurance-companies?include_inactive=true": [makeCompany()],
      "/api/v1/insurance-companies/plans?include_inactive=true": [
        makePlan({ id: "plan-particular", display_name: "Convênio Particular", insurance_company_id: null, plan_type: "particular" }),
      ],
      "/api/v1/insurance-companies": [makeCompany()],
      "/api/v1/insurance-companies/plans": [makePlan()],
      "/api/v1/contracts": EMPTY_CONTRACTS,
    });

    const { container } = renderWithProviders(<ContractsPage />, { route: "/convenios?tab=contratos" });
    await waitFor(() => expect(screen.getAllByText("Convênio Particular").length).toBeGreaterThan(0));

    await expectNoA11yViolations(container);
  });
});
