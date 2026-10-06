import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BillingOperationsPage } from "@/pages/BillingOperationsPage";
import { ApiError, apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { BillingSearchItem, Glosa } from "@/lib/types";

// Auditoria V1, rodada 14 (M3): glosa avulsa lançada, corrigida e excluída pela tela.

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { sub: "u1", tenant_id: "t1", role: "financeiro" } }),
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

const billing: BillingSearchItem = {
  id: "b1",
  patient_name: "Maria da Silva Santos",
  procedure_code: "10101012",
  insurance_plan_name: "Unimed Nacional",
  charged_value: 100,
  received_value: 70,
  status: "paid",
  denial_risk_level: "low",
  created_at: "2026-08-20T00:00:00Z",
  item_type: null,
  member_card_number: null,
  coparticipation_value: null,
  coparticipation_received: null,
  clinical_documentation_confirmed: null,
  payment_method: null,
};

function glosa(overrides: Partial<Glosa> = {}): Glosa {
  return {
    id: "g1",
    billing_id: "b1",
    codigo_motivo: "1801",
    descricao_motivo: "Guia sem assinatura",
    valor_glosado: 30,
    data_recebimento: "2026-09-10T12:00:00Z",
    created_at: "2026-09-10T12:00:00Z",
    imported: false,
    ...overrides,
  };
}

function mockGlosas(items: Glosa[]) {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path.startsWith("/api/v1/billing/search")) return Promise.resolve([billing] as never);
    if (path.startsWith("/api/v1/glosas?billing_id=b1")) return Promise.resolve({ items, total: items.length, limit: 200, offset: 0 } as never);
    if (path.endsWith("/status-history")) return Promise.resolve([] as never);
    return Promise.reject(new Error(`Sem mock para ${path}`));
  });
}

async function openBilling() {
  const user = userEvent.setup();
  renderWithProviders(<BillingOperationsPage />);
  await user.click(screen.getByRole("tab", { name: "Glosas" }));
  await user.type(screen.getByLabelText(/Buscar faturamento/), "Maria da Silva");
  await waitFor(() => expect(screen.getByText("Maria da Silva Santos")).toBeInTheDocument(), { timeout: 2000 });
  await user.click(screen.getByText("Maria da Silva Santos"));
  return user;
}

describe("BillingOperationsPage — aba Glosas", () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.patch).mockReset();
    vi.mocked(apiClient.delete).mockReset();
  });

  it("lista as glosas da cobrança e lança uma nova", async () => {
    mockGlosas([glosa()]);
    vi.mocked(apiClient.post).mockResolvedValue(glosa({ id: "g2", valor_glosado: 12.5 }) as never);
    const user = await openBilling();

    await waitFor(() => expect(screen.getByText("Guia sem assinatura", { exact: false })).toBeInTheDocument());
    await user.type(screen.getByLabelText(/Valor glosado/), "12,50");
    await user.type(screen.getByLabelText("Motivo (opcional)"), "Procedimento não coberto");
    await user.click(screen.getByRole("button", { name: "Lançar glosa" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/glosas", {
        billing_id: "b1",
        valor_glosado: 12.5,
        codigo_motivo: null,
        descricao_motivo: "Procedimento não coberto",
      }),
    );
  });

  it("glosa importada não oferece corrigir nem excluir", async () => {
    mockGlosas([glosa({ imported: true })]);
    await openBilling();
    await waitFor(() => expect(screen.getByText("importada")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Corrigir valor" })).not.toBeInTheDocument();
    expect(screen.getByText(/desfaça a importação/)).toBeInTheDocument();
  });

  it("diminuir a glosa que explica a baixa pede confirmação e reenvia confirmado", async () => {
    mockGlosas([glosa()]);
    vi.mocked(apiClient.patch)
      .mockRejectedValueOnce(
        new ApiError(409, {
          error_code: "glosa_explica_baixa",
          message: "Esta glosa explica R$ 30,00 da baixa da fatura NF-7.",
          request_id: "req-1",
          confirm_field: "confirm_unexplained_difference",
        }),
      )
      .mockResolvedValueOnce(glosa({ valor_glosado: 5 }) as never);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = await openBilling();

    await user.click(await screen.findByRole("button", { name: "Corrigir valor" }));
    const input = screen.getAllByLabelText(/Valor glosado/)[0];
    await user.clear(input);
    await user.type(input, "5");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledTimes(2));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("explica R$ 30,00"));
    expect(apiClient.patch).toHaveBeenLastCalledWith("/api/v1/glosas/g1", { valor_glosado: 5, confirm_unexplained_difference: true });
    confirm.mockRestore();
  });
});
