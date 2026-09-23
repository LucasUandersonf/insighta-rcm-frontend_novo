import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BillingOperationsPage } from "@/pages/BillingOperationsPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { BillingSearchItem, Guia, InsurancePlan, PaginatedResponse } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

function makeResult(overrides: Partial<BillingSearchItem> = {}): BillingSearchItem {
  return {
    id: "b1",
    patient_name: "Maria da Silva Santos",
    procedure_code: "10101012",
    insurance_plan_name: "Unimed Nacional",
    charged_value: 150,
    status: "pending",
    denial_risk_level: "low",
    created_at: "2026-08-20T00:00:00Z",
    item_type: null,
    member_card_number: null,
    coparticipation_value: 25,
    coparticipation_received: null,
    clinical_documentation_confirmed: null,
    payment_method: null,
    ...overrides,
  };
}

function mockGetByPath(routes: Record<string, unknown>) {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    for (const [prefix, value] of Object.entries(routes)) {
      if (path.startsWith(prefix)) return Promise.resolve(value as never);
    }
    // BillingStatusHistoryTimeline busca isto automaticamente assim que
    // um faturamento é selecionado, em TODO teste deste arquivo — sem
    // isto, cada teste precisaria mockar a rota individualmente.
    // Default: sem histórico (o componente não renderiza nada).
    if (path.endsWith("/status-history")) return Promise.resolve([] as never);
    return Promise.reject(new Error(`Sem mock para ${path}`));
  });
}

// Achado da Auditoria Estratégica ("liquidar era ação financeira de mão
// única, sem confirmação e sem forma de reverter") — cobre o ConfirmDialog
// antes de registrar o pagamento e o fluxo de reverter uma liquidação já
// feita.
describe("BillingOperationsPage — aba Registrar pagamento", () => {
  // O mock de apiClient é um módulo compartilhado por todo o arquivo, e
  // este projeto não zera mocks entre testes (sem clearMocks no vitest
  // config) — sem isto, uma chamada de um teste anterior sobrevive no
  // histórico do mock e quebra a asserção `.not.toHaveBeenCalled()`
  // abaixo, que é a primeira deste tipo neste arquivo.
  beforeEach(() => {
    vi.mocked(apiClient.post).mockClear();
    vi.mocked(apiClient.get).mockClear();
  });

  it("pede confirmação antes de registrar o pagamento, e só chama o backend depois de confirmar", async () => {
    mockGetByPath({
      "/api/v1/billing/search": [makeResult({ status: "pending" })],
      "/api/v1/insurance-companies/plans": [],
      "/api/v1/guias": { items: [], total: 0, limit: 15, offset: 0 },
    });
    vi.mocked(apiClient.post).mockResolvedValue({});
    const user = userEvent.setup();

    renderWithProviders(<BillingOperationsPage />);
    await user.type(screen.getByLabelText(/Buscar faturamento/), "Maria da Silva");
    await waitFor(() => expect(screen.getByText("Maria da Silva Santos")).toBeInTheDocument(), { timeout: 2000 });
    await user.click(screen.getByText("Maria da Silva Santos"));

    await user.type(screen.getByLabelText(/Valor recebido/), "150");
    await user.click(screen.getByRole("button", { name: "Registrar pagamento" }));

    // O clique acima só abre o ConfirmDialog — nenhuma chamada ainda.
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(screen.getByText(/Confirma o registro de/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/billing/b1/settle", { received_value: 150 })
    );
  });

  it("mostra o histórico de transições do faturamento selecionado (transparência de acesso)", async () => {
    mockGetByPath({
      "/api/v1/billing/search": [makeResult({ status: "paid" })],
      "/api/v1/insurance-companies/plans": [],
      "/api/v1/guias": { items: [], total: 0, limit: 15, offset: 0 },
      "/api/v1/billing/b1/status-history": [
        {
          from_status: "pending",
          to_status: "paid",
          source: "human",
          reason: null,
          changed_by_name: "Ana Financeiro",
          created_at: "2026-08-21T14:30:00Z",
        },
        {
          from_status: null,
          to_status: "pending",
          source: "human",
          reason: null,
          changed_by_name: null,
          created_at: "2026-08-20T10:00:00Z",
        },
      ],
    });
    const user = userEvent.setup();

    renderWithProviders(<BillingOperationsPage />);
    await user.type(screen.getByLabelText(/Buscar faturamento/), "Maria da Silva");
    await waitFor(() => expect(screen.getByText("Maria da Silva Santos")).toBeInTheDocument(), { timeout: 2000 });
    await user.click(screen.getByText("Maria da Silva Santos"));

    await waitFor(() => expect(screen.getByText("Histórico deste faturamento")).toBeInTheDocument());
    expect(screen.getByText(/Ana Financeiro/)).toBeInTheDocument();
    expect(screen.getByText(/importação automática/)).toBeInTheDocument();
  });

  it("cancelar o ConfirmDialog não registra nada", async () => {
    mockGetByPath({
      "/api/v1/billing/search": [makeResult({ status: "pending" })],
      "/api/v1/insurance-companies/plans": [],
      "/api/v1/guias": { items: [], total: 0, limit: 15, offset: 0 },
    });
    const user = userEvent.setup();

    renderWithProviders(<BillingOperationsPage />);
    await user.type(screen.getByLabelText(/Buscar faturamento/), "Maria da Silva");
    await waitFor(() => expect(screen.getByText("Maria da Silva Santos")).toBeInTheDocument(), { timeout: 2000 });
    await user.click(screen.getByText("Maria da Silva Santos"));
    await user.type(screen.getByLabelText(/Valor recebido/), "150");
    await user.click(screen.getByRole("button", { name: "Registrar pagamento" }));

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(apiClient.post).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText(/Confirma o registro de/)).not.toBeInTheDocument());
  });

  it("faturamento já liquidado mostra o botão de reverter em vez do formulário", async () => {
    mockGetByPath({
      "/api/v1/billing/search": [makeResult({ status: "paid" })],
      "/api/v1/insurance-companies/plans": [],
      "/api/v1/guias": { items: [], total: 0, limit: 15, offset: 0 },
    });
    vi.mocked(apiClient.post).mockResolvedValue({});
    const user = userEvent.setup();

    renderWithProviders(<BillingOperationsPage />);
    await user.type(screen.getByLabelText(/Buscar faturamento/), "Maria da Silva");
    await waitFor(() => expect(screen.getByText("Maria da Silva Santos")).toBeInTheDocument(), { timeout: 2000 });
    await user.click(screen.getByText("Maria da Silva Santos"));

    expect(screen.getByText(/já foi liquidado/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Valor recebido")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reverter liquidação" }));
    await user.click(screen.getByRole("button", { name: "Reverter" }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/api/v1/billing/b1/unsettle"));
  });
});

// Épico F4.2 do Plano Diretor ("Fechar lacunas operacionais") — confirmar
// se a coparticipação cobrada foi de fato recebida do paciente.
describe("BillingOperationsPage — aba Coparticipação", () => {
  it("busca um faturamento, mostra o valor cobrado e confirma como recebida", async () => {
    mockGetByPath({ "/api/v1/insurance-companies/plans": [], "/api/v1/guias": { items: [], total: 0, limit: 15, offset: 0 } });
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/billing/search")) return Promise.resolve([makeResult()] as never);
      if (path.startsWith("/api/v1/insurance-companies/plans")) return Promise.resolve([] as never);
      if (path.startsWith("/api/v1/guias")) return Promise.resolve({ items: [], total: 0, limit: 15, offset: 0 } as never);
      return Promise.reject(new Error(`Sem mock para ${path}`));
    });
    vi.mocked(apiClient.post).mockResolvedValue({});
    const user = userEvent.setup();

    renderWithProviders(<BillingOperationsPage />);
    await user.click(screen.getByRole("tab", { name: "Coparticipação" }));

    await user.type(screen.getByLabelText(/Buscar faturamento/), "Maria da Silva");
    await waitFor(() => expect(screen.getByText("Maria da Silva Santos")).toBeInTheDocument(), { timeout: 2000 });
    await user.click(screen.getByText("Maria da Silva Santos"));

    await waitFor(() => expect(screen.getByText("R$ 25,00")).toBeInTheDocument());
    expect(screen.getByText("Ainda não confirmado.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar recebida" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/billing/b1/confirm-coparticipation", {
        received: true,
        payment_method: null,
        installments: null,
      })
    );
  });

  it("captura forma de pagamento e parcelas ao confirmar como recebida", async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/billing/search")) return Promise.resolve([makeResult({ id: "b4" })] as never);
      if (path.startsWith("/api/v1/insurance-companies/plans")) return Promise.resolve([] as never);
      if (path.startsWith("/api/v1/guias")) return Promise.resolve({ items: [], total: 0, limit: 15, offset: 0 } as never);
      return Promise.reject(new Error(`Sem mock para ${path}`));
    });
    vi.mocked(apiClient.post).mockResolvedValue({});
    const user = userEvent.setup();

    renderWithProviders(<BillingOperationsPage />);
    await user.click(screen.getByRole("tab", { name: "Coparticipação" }));
    await user.type(screen.getByLabelText(/Buscar faturamento/), "Maria da Silva");
    await waitFor(() => expect(screen.getByText("Maria da Silva Santos")).toBeInTheDocument(), { timeout: 2000 });
    await user.click(screen.getByText("Maria da Silva Santos"));

    await user.selectOptions(await screen.findByLabelText(/Forma de pagamento/), "cartao_credito");
    await user.type(screen.getByLabelText(/Parcelas/), "2");
    await user.click(screen.getByRole("button", { name: "Confirmar recebida" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/billing/b4/confirm-coparticipation", {
        received: true,
        payment_method: "cartao_credito",
        installments: 2,
      })
    );
  });

  it("permite confirmar como NÃO recebida", async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/billing/search")) return Promise.resolve([makeResult({ id: "b2" })] as never);
      if (path.startsWith("/api/v1/insurance-companies/plans")) return Promise.resolve([] as never);
      if (path.startsWith("/api/v1/guias")) return Promise.resolve({ items: [], total: 0, limit: 15, offset: 0 } as never);
      return Promise.reject(new Error(`Sem mock para ${path}`));
    });
    vi.mocked(apiClient.post).mockResolvedValue({});
    const user = userEvent.setup();

    renderWithProviders(<BillingOperationsPage />);
    await user.click(screen.getByRole("tab", { name: "Coparticipação" }));
    await user.type(screen.getByLabelText(/Buscar faturamento/), "Maria da Silva");
    await waitFor(() => expect(screen.getByText("Maria da Silva Santos")).toBeInTheDocument(), { timeout: 2000 });
    await user.click(screen.getByText("Maria da Silva Santos"));

    await user.click(await screen.findByRole("button", { name: "Confirmar NÃO recebida" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/billing/b2/confirm-coparticipation", {
        received: false,
        payment_method: null,
        installments: null,
      })
    );
  });

  it("mostra mensagem honesta quando o faturamento não tem coparticipação cobrada", async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/billing/search")) return Promise.resolve([makeResult({ id: "b3", coparticipation_value: null })] as never);
      if (path.startsWith("/api/v1/insurance-companies/plans")) return Promise.resolve([] as never);
      if (path.startsWith("/api/v1/guias")) return Promise.resolve({ items: [], total: 0, limit: 15, offset: 0 } as never);
      return Promise.reject(new Error(`Sem mock para ${path}`));
    });
    const user = userEvent.setup();

    renderWithProviders(<BillingOperationsPage />);
    await user.click(screen.getByRole("tab", { name: "Coparticipação" }));
    await user.type(screen.getByLabelText(/Buscar faturamento/), "Maria da Silva");
    await waitFor(() => expect(screen.getByText("Maria da Silva Santos")).toBeInTheDocument(), { timeout: 2000 });
    await user.click(screen.getByText("Maria da Silva Santos"));

    await waitFor(() =>
      expect(screen.getByText("Este faturamento não tem coparticipação cobrada — nada para confirmar.")).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: "Confirmar recebida" })).not.toBeInTheDocument();
  });
});

// Épico F2.3 do Plano Diretor ("Auditoria documental leve — prontuário ×
// conta") — confirmar se existe registro de prescrição/evolução no
// prontuário sustentando um item de OPME, antes de enviar a guia.
describe("BillingOperationsPage — aba Auditoria documental (OPME)", () => {
  it("busca um faturamento OPME, mostra o valor cobrado e confirma presente", async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/billing/search"))
        return Promise.resolve([makeResult({ item_type: "material_opme", charged_value: 900 })] as never);
      if (path.startsWith("/api/v1/insurance-companies/plans")) return Promise.resolve([] as never);
      if (path.startsWith("/api/v1/guias")) return Promise.resolve({ items: [], total: 0, limit: 15, offset: 0 } as never);
      return Promise.reject(new Error(`Sem mock para ${path}`));
    });
    vi.mocked(apiClient.post).mockResolvedValue({});
    const user = userEvent.setup();

    renderWithProviders(<BillingOperationsPage />);
    await user.click(screen.getByRole("tab", { name: "Auditoria documental (OPME)" }));

    await user.type(screen.getByLabelText(/Buscar faturamento/), "Maria da Silva");
    await waitFor(() => expect(screen.getByText("Maria da Silva Santos")).toBeInTheDocument(), { timeout: 2000 });
    await user.click(screen.getByText("Maria da Silva Santos"));

    await waitFor(() => expect(screen.getByText("R$ 900,00")).toBeInTheDocument());
    expect(screen.getByText("Ainda não conferido.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar presente" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/billing/b1/confirm-clinical-documentation", { found: true })
    );
  });

  it("permite confirmar como ausente", async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/billing/search"))
        return Promise.resolve([makeResult({ id: "b4", item_type: "material_opme" })] as never);
      if (path.startsWith("/api/v1/insurance-companies/plans")) return Promise.resolve([] as never);
      if (path.startsWith("/api/v1/guias")) return Promise.resolve({ items: [], total: 0, limit: 15, offset: 0 } as never);
      return Promise.reject(new Error(`Sem mock para ${path}`));
    });
    vi.mocked(apiClient.post).mockResolvedValue({});
    const user = userEvent.setup();

    renderWithProviders(<BillingOperationsPage />);
    await user.click(screen.getByRole("tab", { name: "Auditoria documental (OPME)" }));
    await user.type(screen.getByLabelText(/Buscar faturamento/), "Maria da Silva");
    await waitFor(() => expect(screen.getByText("Maria da Silva Santos")).toBeInTheDocument(), { timeout: 2000 });
    await user.click(screen.getByText("Maria da Silva Santos"));

    await user.click(await screen.findByRole("button", { name: "Confirmar ausente" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/billing/b4/confirm-clinical-documentation", { found: false })
    );
  });

  it("mostra mensagem honesta quando o faturamento não é um item de OPME", async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/billing/search"))
        return Promise.resolve([makeResult({ id: "b5", item_type: "procedimento" })] as never);
      if (path.startsWith("/api/v1/insurance-companies/plans")) return Promise.resolve([] as never);
      if (path.startsWith("/api/v1/guias")) return Promise.resolve({ items: [], total: 0, limit: 15, offset: 0 } as never);
      return Promise.reject(new Error(`Sem mock para ${path}`));
    });
    const user = userEvent.setup();

    renderWithProviders(<BillingOperationsPage />);
    await user.click(screen.getByRole("tab", { name: "Auditoria documental (OPME)" }));
    await user.type(screen.getByLabelText(/Buscar faturamento/), "Maria da Silva");
    await waitFor(() => expect(screen.getByText("Maria da Silva Santos")).toBeInTheDocument(), { timeout: 2000 });
    await user.click(screen.getByText("Maria da Silva Santos"));

    await waitFor(() =>
      expect(screen.getByText("Este faturamento não é um item de OPME — nada para conferir.")).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: "Confirmar presente" })).not.toBeInTheDocument();
  });
});

function makeGuia(overrides: Partial<Guia> = {}): Guia {
  return {
    id: "g1",
    insurance_plan_id: "plan-1",
    tipo: "sadt",
    numero: "SADT-12345",
    senha: null,
    senha_validade: null,
    tabela_procedimento: null,
    lote_id: null,
    created_at: "2026-08-20T00:00:00Z",
    ...overrides,
  };
}

function makePlan(overrides: Partial<InsurancePlan> = {}): InsurancePlan {
  return {
    id: "plan-1",
    insurance_company_id: null,
    display_name: "Unimed Nacional",
    normalized_key: "unimed_nacional",
    ans_registry: null,
    is_active: true,
    plan_type: "convenio",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// Achado da Auditoria de Prontidão v1 ("busca ausente na aba de Guias
// do Faturamento") — antes só havia paginação cronológica.
describe("BillingOperationsPage — aba Guias", () => {
  it("busca por número da guia manda ?search= pro backend", async () => {
    const guiasPage: PaginatedResponse<Guia> = { items: [makeGuia()], total: 1, limit: 15, offset: 0 };
    mockGetByPath({
      "/api/v1/insurance-companies/plans": [makePlan()],
      "/api/v1/guias?limit=15&offset=0&search=": guiasPage,
    });
    const user = userEvent.setup();

    renderWithProviders(<BillingOperationsPage />);
    await user.click(screen.getByRole("tab", { name: "Guias" }));
    await waitFor(() => expect(screen.getByText("SADT-12345")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Buscar guia por número"), "12345");

    await waitFor(
      () => expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining("search=12345")),
      { timeout: 1000 }
    );
  });

  it("não tem violações de acessibilidade", async () => {
    const guiasPage: PaginatedResponse<Guia> = { items: [makeGuia()], total: 1, limit: 15, offset: 0 };
    mockGetByPath({
      "/api/v1/insurance-companies/plans": [makePlan()],
      "/api/v1/guias?limit=15&offset=0&search=": guiasPage,
    });
    const user = userEvent.setup();

    const { container } = renderWithProviders(<BillingOperationsPage />);
    await user.click(screen.getByRole("tab", { name: "Guias" }));
    await waitFor(() => expect(screen.getByText("SADT-12345")).toBeInTheDocument());

    await expectNoA11yViolations(container);
  });
});

describe("BillingOperationsPage — destino dos alertas", () => {
  it("abre direto na aba pedida pelo link (?tab=coparticipacao)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 } as never);
    renderWithProviders(<BillingOperationsPage />, { route: "/faturamento?tab=coparticipacao" });
    expect(await screen.findByRole("tab", { name: "Coparticipação" })).toHaveAttribute("aria-selected", "true");
  });

  it("aba desconhecida cai no padrão", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 } as never);
    renderWithProviders(<BillingOperationsPage />, { route: "/faturamento?tab=xyz" });
    expect(await screen.findByRole("tab", { name: "Registrar pagamento" })).toHaveAttribute("aria-selected", "true");
  });
});
