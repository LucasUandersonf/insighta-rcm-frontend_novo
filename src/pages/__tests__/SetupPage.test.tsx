import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { SetupPage } from "@/pages/SetupPage";
import { apiClient, ApiError } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { InsurancePlan, RejectedRow, ResolveInsurancePlanResponse } from "@/lib/types";

// Achado da Auditoria de Prontidão v1: SetupPage é o único jeito de
// resolver uma linha rejeitada na importação (convênio não reconhecido
// ou erro estrutural) — parte da espinha dorsal de entrada de dado do
// produto, sem nenhum teste de página até aqui.
vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() },
  };
});

// getApiErrorMessage (query-client.ts) só preserva a mensagem de uma
// ApiError de verdade — qualquer outro Error vira o fallback genérico
// "Algo deu errado. Tente novamente." Por isso os testes de erro abaixo
// usam esta fábrica, não `new Error(...)` cru.
function apiError(message: string): ApiError {
  return new ApiError(400, { error_code: "erro_generico", message, request_id: "req-1" });
}

function makeRejectedRow(overrides: Partial<RejectedRow> = {}): RejectedRow {
  return {
    id: 1,
    ingestion_file_id: "file-1",
    row_number: 12,
    payload: { patient_name: "Maria Silva", charged_value: 150.5 },
    reason: "unknown_insurance_plan",
    raw_value: "UNIMED REGIONAL XYZ",
    created_at: "2026-09-01T10:00:00Z",
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
    plan_type: "particular",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("SetupPage", () => {
  it("mostra loading e depois os dois painéis vazios quando não há nada pendente", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([] as never);

    renderWithProviders(<SetupPage />);

    expect(await screen.findByText("Nenhum convênio pendente de mapeamento no momento.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum erro estrutural pendente no momento.")).toBeInTheDocument();
  });

  it("mostra erro com botão de tentar de novo quando a busca falha", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(apiError("falha de rede"));

    renderWithProviders(<SetupPage />);

    expect(await screen.findByText("falha de rede")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: /tentar novamente/i });

    vi.mocked(apiClient.get).mockResolvedValue([] as never);
    fireEvent.click(retryButton);

    expect(await screen.findByText("Nenhum convênio pendente de mapeamento no momento.")).toBeInTheDocument();
  });

  it("agrupa linhas rejeitadas por convênio não reconhecido pelo MESMO raw_value, e lista erros estruturais à parte", async () => {
    const rows: RejectedRow[] = [
      makeRejectedRow({ id: 1, raw_value: "UNIMED REGIONAL XYZ", payload: { patient_name: "Maria Silva" } }),
      makeRejectedRow({ id: 2, raw_value: "UNIMED REGIONAL XYZ", payload: { patient_name: "João Souza" } }),
      makeRejectedRow({ id: 3, raw_value: "AMIL SAUDE ABC", payload: { patient_name: "Ana Costa" } }),
      makeRejectedRow({
        id: 4,
        reason: "validation_error",
        raw_value: "data de nascimento inválida",
        row_number: 40,
      }),
    ];
    vi.mocked(apiClient.get).mockResolvedValue(rows as never);

    renderWithProviders(<SetupPage />);

    // Dois grupos distintos por raw_value — não quatro linhas soltas.
    expect(await screen.findByText("UNIMED REGIONAL XYZ")).toBeInTheDocument();
    expect(screen.getByText("AMIL SAUDE ABC")).toBeInTheDocument();
    // O grupo "UNIMED REGIONAL XYZ" tem 2 lançamentos pendentes (badge).
    expect(screen.getByText("2")).toBeInTheDocument();

    // Erro estrutural aparece no painel separado, pela linha/número.
    expect(screen.getByText("#40")).toBeInTheDocument();
    expect(screen.getByText("data de nascimento inválida")).toBeInTheDocument();
  });

  it("mapeia um convênio: abre o modal, escolhe o plano, confirma, e a lista atualiza (grupo resolvido some)", async () => {
    const rows: RejectedRow[] = [
      makeRejectedRow({ id: 1, raw_value: "UNIMED REGIONAL XYZ" }),
      makeRejectedRow({ id: 2, raw_value: "UNIMED REGIONAL XYZ" }),
    ];
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/insurance-companies/plans")) return Promise.resolve([makePlan()] as never);
      return Promise.resolve(rows as never);
    });

    const resolveResponse: ResolveInsurancePlanResponse = { row_id: 1, resolved: true, additionally_resolved_count: 1 };
    vi.mocked(apiClient.post).mockResolvedValue(resolveResponse as never);

    renderWithProviders(<SetupPage />);

    await screen.findByText("UNIMED REGIONAL XYZ");
    fireEvent.click(screen.getByRole("button", { name: "Mapear convênio" }));

    expect(await screen.findByText("Mapear convênio não reconhecido")).toBeInTheDocument();
    const select = await screen.findByLabelText(/Convênio correto/);
    // As opções do <select> chegam via useQuery assíncrona (enabled:
    // isOpen) — precisa esperar a option de verdade existir antes de
    // mudar o valor, senão fireEvent.change não seleciona nada.
    await screen.findByRole("option", { name: "Unimed Regional" });
    fireEvent.change(select, { target: { value: "plan-1" } });

    // Depois de resolver, a próxima busca de "rejected-rows" volta vazia
    // (mesmo raciocínio de invalidateQueries -> refetch da tela real).
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/insurance-companies/plans")) return Promise.resolve([makePlan()] as never);
      return Promise.resolve([] as never);
    });

    fireEvent.click(screen.getByRole("button", { name: "Mapear e promover" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/ingestion/rejected/1/resolve-insurance-plan", {
        insurance_plan_id: "plan-1",
      })
    );

    // Toast de sucesso conta o total (resolved + additionally_resolved_count = 2).
    expect(await screen.findByText(/2 lançamentos de "UNIMED REGIONAL XYZ" foram mapeados/)).toBeInTheDocument();
    // A lista se atualiza sozinha (query invalidada) — grupo resolvido some.
    await waitFor(() => expect(screen.queryByText("UNIMED REGIONAL XYZ")).not.toBeInTheDocument());
  });

  it("mostra erro no modal quando o mapeamento falha, sem fechar nem perder a seleção", async () => {
    const rows: RejectedRow[] = [makeRejectedRow({ id: 1, raw_value: "UNIMED REGIONAL XYZ" })];
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/insurance-companies/plans")) return Promise.resolve([makePlan()] as never);
      return Promise.resolve(rows as never);
    });
    vi.mocked(apiClient.post).mockRejectedValue(apiError("Plano inválido para este tenant."));

    renderWithProviders(<SetupPage />);

    await screen.findByText("UNIMED REGIONAL XYZ");
    fireEvent.click(screen.getByRole("button", { name: "Mapear convênio" }));
    const select = await screen.findByLabelText(/Convênio correto/);
    await screen.findByRole("option", { name: "Unimed Regional" });
    fireEvent.change(select, { target: { value: "plan-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Mapear e promover" }));

    expect(await screen.findByText("Plano inválido para este tenant.")).toBeInTheDocument();
    // Modal continua aberto — usuário não perde o contexto ao ver o erro.
    expect(screen.getByText("Mapear convênio não reconhecido")).toBeInTheDocument();
  });
});
