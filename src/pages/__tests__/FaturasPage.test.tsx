import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { FaturasPage, parseMoney } from "@/pages/FaturasPage";
import { ApiError, apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { Fatura, InsurancePlan, Lote, PaginatedResponse } from "@/lib/types";

let mockRole = "financeiro";
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { sub: "u1", tenant_id: "t1", role: mockRole } }),
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() },
  };
});

const plan: InsurancePlan = {
  id: "plan-1",
  insurance_company_id: "company-1",
  display_name: "Unimed Nacional",
  normalized_key: "unimed_nacional",
  ans_registry: null,
  is_active: true,
  plan_type: "convenio",
  created_at: "2026-01-01T00:00:00Z",
};

function makeFatura(overrides: Partial<Fatura> = {}): Fatura {
  return {
    id: "fat-1",
    insurance_plan_id: "plan-1",
    serie: "NF",
    numero: "777",
    status: "emitida",
    data_emissao: "2026-10-01T12:00:00Z",
    valor_recebido: null,
    data_recebimento: null,
    created_at: "2026-10-01T12:00:00Z",
    valor_total: 300,
    cobrancas: 2,
    cobrancas_pendentes: 2,
    valor_negado: 0,
    ...overrides,
  };
}

function makeLote(overrides: Partial<Lote> = {}): Lote {
  return {
    id: "lote-1",
    insurance_plan_id: "plan-1",
    tipo: "consulta",
    status: "fechado",
    fatura_id: null,
    closed_at: "2026-09-30T12:00:00Z",
    created_at: "2026-09-01T00:00:00Z",
    guias_count: 2,
    ...overrides,
  };
}

function mockGet(faturas: Fatura[], lotes: Lote[] = []) {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path.startsWith("/api/v1/insurance-companies/plans")) return Promise.resolve([plan] as never);
    if (path.startsWith("/api/v1/faturas")) {
      const page: PaginatedResponse<Fatura> = { items: faturas, total: faturas.length, limit: 20, offset: 0 };
      return Promise.resolve(page as never);
    }
    if (path.startsWith("/api/v1/lotes")) {
      const page: PaginatedResponse<Lote> = { items: lotes, total: lotes.length, limit: 200, offset: 0 };
      return Promise.resolve(page as never);
    }
    return Promise.reject(new Error(`Sem mock para ${path}`));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  mockRole = "financeiro";
});

describe("parseMoney", () => {
  it("aceita formato brasileiro e com ponto", () => {
    expect(parseMoney("1.250,50")).toBe(1250.5);
    expect(parseMoney("R$ 300")).toBe(300);
    expect(parseMoney("99.9")).toBe(99.9);
    expect(parseMoney("abc")).toBeNaN();
    expect(parseMoney("")).toBeNaN();
  });
});

describe("FaturasPage", () => {
  it("lista faturas com total, recebido e cobranças em aberto", async () => {
    mockGet([makeFatura(), makeFatura({ id: "fat-2", numero: "778", status: "paga", valor_recebido: 300, cobrancas_pendentes: 0 })]);
    const { container } = renderWithProviders(<FaturasPage />);

    const row = (await screen.findByText(/NF-777/)).closest("tr")!;
    expect(within(row).getByText("Unimed Nacional")).toBeInTheDocument();
    expect(within(row).getByText("2 de 2")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Dar baixa" })).toBeInTheDocument();
    const paid = screen.getByText(/NF-778/).closest("tr")!;
    expect(within(paid).getByRole("button", { name: "Corrigir baixa" })).toBeInTheDocument();
    expect(within(paid).queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("gera fatura só com lotes do mesmo convênio", async () => {
    mockGet([], [makeLote(), makeLote({ id: "lote-2", insurance_plan_id: "plan-2" })]);
    vi.mocked(apiClient.post).mockResolvedValue(makeFatura() as never);
    renderWithProviders(<FaturasPage />);

    fireEvent.click(await screen.findByRole("button", { name: /nova fatura/i }));
    const boxes = await screen.findAllByRole("checkbox");
    fireEvent.click(boxes[0]);
    expect(boxes[1]).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Série"), { target: { value: "NF" } });
    fireEvent.change(screen.getByLabelText("Número"), { target: { value: "777" } });
    fireEvent.click(screen.getByRole("button", { name: "Gerar fatura" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/faturas", { lote_ids: ["lote-1"], serie: "NF", numero: "777" })
    );
  });

  it("baixa abaixo do total pede confirmação e reenvia com o campo", async () => {
    mockGet([makeFatura()]);
    vi.mocked(apiClient.post)
      .mockRejectedValueOnce(
        new ApiError(409, {
          error_code: "recebimento_abaixo_do_cobrado",
          message: "O valor recebido (R$ 250,00) é menor que o total cobrado nesta fatura (R$ 300,00).",
          request_id: "r1",
          confirm_field: "confirm_underpayment",
        })
      )
      .mockResolvedValueOnce(makeFatura({ status: "paga", valor_recebido: 250, cobrancas_pendentes: 0 }) as never);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithProviders(<FaturasPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Dar baixa" }));
    fireEvent.change(screen.getByLabelText(/Valor recebido/), { target: { value: "250,00" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar baixa" }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
    expect(confirmSpy).toHaveBeenCalled();
    expect(vi.mocked(apiClient.post).mock.calls[1]).toEqual([
      "/api/v1/faturas/fat-1/baixar",
      { valor_recebido: 250, is_partial: false, correction: false, confirm_underpayment: true },
    ]);
  });

  it("valor inválido não chama a API", async () => {
    mockGet([makeFatura()]);
    renderWithProviders(<FaturasPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Dar baixa" }));
    fireEvent.change(screen.getByLabelText(/Valor recebido/), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar baixa" }));
    expect(await screen.findByText(/Informe o valor recebido/)).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("cancela a fatura depois de confirmar", async () => {
    mockGet([makeFatura()]);
    vi.mocked(apiClient.post).mockResolvedValue(makeFatura({ status: "cancelada" }) as never);
    renderWithProviders(<FaturasPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar fatura" }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/api/v1/faturas/fat-1/cancelar", {}));
  });
});

describe("FaturasPage — rodada 11", () => {
  it("auditor vê as faturas, mas não as ações", async () => {
    mockRole = "auditor";
    mockGet([makeFatura()]);
    renderWithProviders(<FaturasPage />);
    await screen.findByText(/NF-777/);
    expect(screen.queryByRole("button", { name: /nova fatura/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dar baixa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
  });

  it("mostra o recebido em baixas parciais e o valor negado", async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/insurance-companies/plans")) return Promise.resolve([plan] as never);
      if (path === "/api/v1/faturas/resumo")
        return Promise.resolve({ emitidas: 1, emitidas_valor: 300, parciais: 1, parciais_recebido: 120, parciais_a_receber: 180 } as never);
      if (path.startsWith("/api/v1/faturas"))
        return Promise.resolve({ items: [makeFatura({ valor_negado: 50 })], total: 1, limit: 20, offset: 0 } as never);
      return Promise.reject(new Error(`Sem mock para ${path}`));
    });
    renderWithProviders(<FaturasPage />);
    expect(await screen.findByText(/em 1 fatura\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/negado/)).toBeInTheDocument();
  });

  it("cancelar com baixa parcial pede confirmação e reenvia com o campo", async () => {
    mockGet([makeFatura({ status: "parcialmente_paga", valor_recebido: 120 })]);
    vi.mocked(apiClient.post)
      .mockRejectedValueOnce(
        new ApiError(409, {
          error_code: "fatura_com_baixa_parcial",
          message: "Esta fatura já tem R$ 120,00 recebidos em baixa parcial.",
          request_id: "r2",
          confirm_field: "confirm_discard_partial",
        })
      )
      .mockResolvedValueOnce(makeFatura({ status: "cancelada" }) as never);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithProviders(<FaturasPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar fatura" }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(apiClient.post).mock.calls[1]).toEqual(["/api/v1/faturas/fat-1/cancelar", { confirm_discard_partial: true }]);
  });
});
