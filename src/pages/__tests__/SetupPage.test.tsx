import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { SetupPage } from "@/pages/SetupPage";
import { apiClient, ApiError } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { InsurancePlan, RejectedRow, ResolveByNameResponse, UnknownPlanGroup } from "@/lib/types";

// "Linhas para corrigir": convênios não cadastrados (contados no servidor,
// UX-05) resolvidos no próprio lugar (UX-06/07/08) e linhas com dado
// inválido pelo número da linha da planilha.
vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() },
  };
});

function apiError(message: string): ApiError {
  return new ApiError(400, { error_code: "erro_generico", message, request_id: "req-1" });
}

function makeRow(overrides: Partial<RejectedRow> = {}): RejectedRow {
  return {
    id: 4,
    ingestion_file_id: "file-1",
    row_number: 40,
    payload: {},
    reason: "validation_error",
    raw_value: "Data do atendimento: não é uma data.",
    created_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

function makeGroup(overrides: Partial<UnknownPlanGroup> = {}): UnknownPlanGroup {
  return {
    raw_value: "UNIMED REGIONAL XYZ",
    count: 1968,
    first_row_id: 1,
    last_received_at: "2026-09-01T10:00:00Z",
    data_types: ["faturamento"],
    samples: [{ patient_name: "Maria Silva", charged_value: 150.5 }],
    suggested_plan_id: null,
    suggested_plan_name: null,
    ...overrides,
  };
}

function makePlan(overrides: Partial<InsurancePlan> = {}): InsurancePlan {
  return {
    id: "plan-1",
    insurance_company_id: "company-1",
    display_name: "Unimed Regional",
    normalized_key: "unimed_regional",
    ans_registry: null,
    is_active: true,
    plan_type: "convenio",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mockGets({ groups = [] as UnknownPlanGroup[], rows = [] as RejectedRow[], plans = [] as InsurancePlan[] } = {}) {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url.includes("/rejected/unknown-plans")) return Promise.resolve(groups as never);
    if (url.includes("/insurance-companies/plans")) return Promise.resolve(plans as never);
    return Promise.resolve(rows as never);
  });
}

describe("SetupPage", () => {
  it("mostra os dois painéis vazios quando não há nada pendente", async () => {
    mockGets();
    renderWithProviders(<SetupPage />);
    expect(await screen.findByText("Nenhum convênio esperando cadastro.")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma linha com dado inválido.")).toBeInTheDocument();
  });

  it("mostra erro com botão de tentar de novo quando a busca falha", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(apiError("falha de rede"));
    renderWithProviders(<SetupPage />);
    expect(await screen.findByText("falha de rede")).toBeInTheDocument();
    mockGets();
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(await screen.findByText("Nenhum convênio esperando cadastro.")).toBeInTheDocument();
  });

  it("mostra a contagem TOTAL do servidor e a linha como na planilha", async () => {
    mockGets({ groups: [makeGroup(), makeGroup({ raw_value: "AMIL SAUDE ABC", count: 3 })], rows: [makeRow()] });
    renderWithProviders(<SetupPage />);

    expect(await screen.findByText("1.968 linhas")).toBeInTheDocument();
    expect(screen.getByText("3 linhas")).toBeInTheDocument();
    expect(screen.getByText(/1\.971 linhas esperando/)).toBeInTheDocument();
    // row_number 40 (0 = primeira linha de dados) → linha 41 da planilha.
    expect(screen.getByText("Linha 41")).toBeInTheDocument();
    expect(screen.getByText("Data do atendimento: não é uma data.")).toBeInTheDocument();
  });

  it("cadastra o convênio com o nome do arquivo e a lista atualiza", async () => {
    mockGets({ groups: [makeGroup()] });
    const response: ResolveByNameResponse = {
      raw_value: "UNIMED REGIONAL XYZ",
      plan_id: "plan-9",
      plan_name: "UNIMED REGIONAL XYZ",
      created_plan: true,
      resolved: 1968,
      still_rejected: 0,
      message: "Convênio “UNIMED REGIONAL XYZ” cadastrado. 1.968 linhas entraram no sistema.",
    };
    vi.mocked(apiClient.post).mockResolvedValue(response as never);

    renderWithProviders(<SetupPage />);
    await screen.findByText("1.968 linhas");
    mockGets();
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar “UNIMED REGIONAL XYZ”" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/ingestion/rejected/resolve-by-name",
        { raw_value: "UNIMED REGIONAL XYZ", create: true },
        expect.anything()
      )
    );
    expect(await screen.findByText(/1\.968 linhas entraram no sistema/)).toBeInTheDocument();
    expect(await screen.findByText("Nenhum convênio esperando cadastro.")).toBeInTheDocument();
  });

  it("diz que é outro nome de um convênio já cadastrado", async () => {
    mockGets({ groups: [makeGroup()], plans: [makePlan()] });
    vi.mocked(apiClient.post).mockResolvedValue({ message: "ok" } as never);
    renderWithProviders(<SetupPage />);
    await screen.findByText("1.968 linhas");
    fireEvent.click(screen.getByRole("button", { name: "É outro nome de um convênio que já tenho" }));
    await screen.findByRole("option", { name: "Unimed Regional" });
    fireEvent.change(screen.getByLabelText("Convênio já cadastrado"), { target: { value: "plan-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/ingestion/rejected/resolve-by-name",
        { raw_value: "UNIMED REGIONAL XYZ", insurance_plan_id: "plan-1" },
        expect.anything()
      )
    );
  });

  it("oferece o convênio parecido como sugestão de um clique", async () => {
    mockGets({ groups: [makeGroup({ suggested_plan_id: "plan-1", suggested_plan_name: "Unimed Regional" })] });
    renderWithProviders(<SetupPage />);
    expect(await screen.findByRole("button", { name: "É o convênio “Unimed Regional”" })).toBeInTheDocument();
  });

  it("resolve automaticamente o que já bate com convênio cadastrado", async () => {
    mockGets({ groups: [makeGroup()] });
    vi.mocked(apiClient.post).mockResolvedValue({ resolved: 0, names: [], message: "Nenhum nome bate ainda." } as never);
    renderWithProviders(<SetupPage />);
    await screen.findByText("1.968 linhas");
    fireEvent.click(screen.getByRole("button", { name: "Resolver automaticamente" }));
    expect(await screen.findByText("Nenhum nome bate ainda.")).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/ingestion/rejected/auto-resolve", {}, expect.anything());
  });

  it("mostra o erro quando resolver falha", async () => {
    mockGets({ groups: [makeGroup()] });
    vi.mocked(apiClient.post).mockRejectedValue(apiError("Convênio inválido."));
    renderWithProviders(<SetupPage />);
    await screen.findByText("1.968 linhas");
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar “UNIMED REGIONAL XYZ”" }));
    expect(await screen.findByText("Convênio inválido.")).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    mockGets({ groups: [makeGroup()], rows: [makeRow()] });
    const { container } = renderWithProviders(<SetupPage />);
    await screen.findByText("1.968 linhas");
    await expectNoA11yViolations(container);
  });
});
