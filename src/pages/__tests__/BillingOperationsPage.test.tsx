import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BillingOperationsPage } from "@/pages/BillingOperationsPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { BillingSearchItem } from "@/lib/types";

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
    ...overrides,
  };
}

function mockGetByPath(routes: Record<string, unknown>) {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    for (const [prefix, value] of Object.entries(routes)) {
      if (path.startsWith(prefix)) return Promise.resolve(value as never);
    }
    return Promise.reject(new Error(`Sem mock para ${path}`));
  });
}

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
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/billing/b1/confirm-coparticipation", { received: true })
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
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/billing/b2/confirm-coparticipation", { received: false })
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
