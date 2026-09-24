import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadCenterPage } from "@/pages/UploadCenterPage";
import { apiClient, ApiError } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { Contract, IngestionFileEntry, InsurancePlan, PaginatedResponse, UploadIngestionFileResponse } from "@/lib/types";

// Achado da Auditoria de Prontidão v1: Central de Upload é a ÚNICA porta
// de entrada de dado real do produto (lotes operacionais + contratos de
// convênio) — sem nenhum teste de página até aqui, apesar de ser a
// espinha dorsal de tudo que a Sala de Comando depois analisa.
// Upload direto ao S3 desligado no servidor (409): a tela usa o upload pela API.
vi.mock("@/lib/directUpload", () => ({ uploadViaS3: vi.fn().mockResolvedValue(null) }));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), upload: vi.fn() },
  };
});

function apiError(message: string): ApiError {
  return new ApiError(400, { error_code: "erro_generico", message, request_id: "req-1" });
}

function emptyHistory(): PaginatedResponse<IngestionFileEntry> {
  return { items: [], total: 0, limit: 15, offset: 0 };
}

function makeFileEntry(overrides: Partial<IngestionFileEntry> = {}): IngestionFileEntry {
  return {
    id: "file-1",
    original_filename: "faturamento-setembro.csv",
    file_format: "csv",
    data_type: "faturamento",
    status: "processed",
    row_count: 120,
    error_row_count: 0,
    error_message: null,
    received_at: "2026-09-01T10:00:00Z",
    processed_at: "2026-09-01T10:00:05Z",
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

function csvFile(name = "faturamento.csv"): File {
  return new File(["cpf,nome\n123,Maria"], name, { type: "text/csv" });
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error("input[type=file] não encontrado — Dropzone mudou de estrutura?");
  return input as HTMLInputElement;
}

describe("UploadCenterPage — aba Lotes Operacionais", () => {
  it("mostra o histórico vazio quando não há nenhum arquivo enviado ainda", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(emptyHistory() as never);

    renderWithProviders(<UploadCenterPage />);

    expect(
      await screen.findByText("Nenhum arquivo enviado ainda — o primeiro upload aparece aqui assim que for processado.")
    ).toBeInTheDocument();
  });

  it("mostra erro com tentar de novo quando o histórico falha ao carregar", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(apiError("Não foi possível carregar o histórico."));

    renderWithProviders(<UploadCenterPage />);

    expect(await screen.findByText("Não foi possível carregar o histórico.")).toBeInTheDocument();

    vi.mocked(apiClient.get).mockResolvedValue(emptyHistory() as never);
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));

    expect(
      await screen.findByText("Nenhum arquivo enviado ainda — o primeiro upload aparece aqui assim que for processado.")
    ).toBeInTheDocument();
  });

  it("envia um CSV de faturamento e mostra o toast avisando de linhas rejeitadas (rota certa para a tela de Setup)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(emptyHistory() as never);
    const uploadResponse: UploadIngestionFileResponse = {
      id: "file-1",
      file_format: "csv",
      data_type: "faturamento",
      status: "processed",
      row_count: 98,
      error_row_count: 2,
      received_at: "2026-09-01T10:00:00Z",
      already_processed: false,
      message: null,
    };
    vi.mocked(apiClient.upload).mockResolvedValue(uploadResponse as never);

    renderWithProviders(<UploadCenterPage />);
    await screen.findByText(/Nenhum arquivo enviado ainda/);

    const user = userEvent.setup();
    await user.upload(fileInput(), csvFile());

    expect(await screen.findByText("faturamento.csv")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar arquivo" }));

    await waitFor(() => expect(apiClient.upload).toHaveBeenCalledWith("/api/v1/ingestion/upload", expect.any(FormData)));
    const formData = vi.mocked(apiClient.upload).mock.calls[0][1] as FormData;
    expect(formData.get("data_type")).toBe("faturamento");
    expect((formData.get("file") as File).name).toBe("faturamento.csv");

    expect(
      await screen.findByText("Arquivo processado: 98 linha(s) lida(s), 2 rejeitada(s). Veja o motivo de cada uma no relatório.")
    ).toBeInTheDocument();
  });

  it("mostra erro da API sem travar a tela quando o upload falha", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(emptyHistory() as never);
    vi.mocked(apiClient.upload).mockRejectedValue(apiError("Arquivo maior que o limite de 20MB."));

    renderWithProviders(<UploadCenterPage />);
    await screen.findByText(/Nenhum arquivo enviado ainda/);

    const user = userEvent.setup();
    await user.upload(fileInput(), csvFile());
    fireEvent.click(screen.getByRole("button", { name: "Enviar arquivo" }));

    expect(await screen.findByText("Arquivo maior que o limite de 20MB.")).toBeInTheDocument();
    // A tela continua utilizável — o botão de enviar ainda existe.
    expect(screen.getByRole("button", { name: "Enviar arquivo" })).toBeInTheDocument();
  });

  it("lista o histórico com status, linhas importadas/rejeitadas e template", async () => {
    const history: PaginatedResponse<IngestionFileEntry> = {
      items: [
        makeFileEntry({ id: "a", original_filename: "agenda-agosto.xml", file_format: "xml", data_type: "agenda", status: "processed", row_count: 40, error_row_count: 0 }),
        makeFileEntry({ id: "b", original_filename: "glosa-julho.json", file_format: "json", data_type: "glosa", status: "failed", row_count: 0, error_row_count: 15 }),
      ],
      total: 2,
      limit: 15,
      offset: 0,
    };
    vi.mocked(apiClient.get).mockResolvedValue(history as never);

    renderWithProviders(<UploadCenterPage />);

    expect(await screen.findByText("agenda-agosto.xml")).toBeInTheDocument();
    expect(screen.getByText("glosa-julho.json")).toBeInTheDocument();
    expect(screen.getByText("Processado")).toBeInTheDocument();
    expect(screen.getByText("Falhou")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    const history: PaginatedResponse<IngestionFileEntry> = {
      items: [
        makeFileEntry({ id: "a", original_filename: "agenda-agosto.xml", file_format: "xml", data_type: "agenda", status: "processed", row_count: 40, error_row_count: 0 }),
        makeFileEntry({ id: "b", original_filename: "glosa-julho.json", file_format: "json", data_type: "glosa", status: "failed", row_count: 0, error_row_count: 15 }),
      ],
      total: 2,
      limit: 15,
      offset: 0,
    };
    vi.mocked(apiClient.get).mockResolvedValue(history as never);

    const { container } = renderWithProviders(<UploadCenterPage />);

    await screen.findByText("agenda-agosto.xml");
    await expectNoA11yViolations(container);
  });
});

describe("UploadCenterPage — aba Contratos de Convênio", () => {
  async function goToContractsTab() {
    fireEvent.click(screen.getByRole("tab", { name: "Contratos de Convênio" }));
    await screen.findByText("Upload de contratos de convênio");
  }

  it("valida campos obrigatórios no cliente antes de chamar a API (plano, vigência e arquivo)", async () => {
    // Os mocks de apiClient.* não são resetados entre testes deste
    // arquivo (sem clearMocks no vitest.config) — só a CONTAGEM de
    // chamadas persiste, cada teste já reatribui mockImplementation/
    // mockResolvedValue do zero. Limpa aqui porque este é o único teste
    // que afirma "nunca foi chamado".
    vi.mocked(apiClient.upload).mockClear();
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/insurance-companies/plans")) return Promise.resolve([makePlan()] as never);
      return Promise.resolve(emptyHistory() as never);
    });

    renderWithProviders(<UploadCenterPage />);
    await goToContractsTab();

    // Dispara o evento `submit` direto no <form> em vez de clicar no
    // botão: os campos de plano/vigência usam `required` NATIVO do
    // HTML — um clique real no botão seria bloqueado pela validação
    // nativa do navegador (e do jsdom) ANTES do onSubmit do React
    // rodar, então nunca chegaria na validação em JS que este teste
    // quer cobrir. fireEvent.submit contorna isso, é o jeito padrão de
    // testar o onSubmit em si quando os campos também têm `required`.
    const form = screen.getByRole("button", { name: "Enviar contrato" }).closest("form")!;
    fireEvent.submit(form);

    expect(await screen.findByText("Selecione um plano.")).toBeInTheDocument();
    expect(screen.getByText("Informe a vigência inicial.")).toBeInTheDocument();
    expect(screen.getByText("Selecione o PDF do contrato.")).toBeInTheDocument();
    expect(apiClient.upload).not.toHaveBeenCalled();
  });

  it("envia o PDF do contrato com plano e vigência preenchidos", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/insurance-companies/plans")) return Promise.resolve([makePlan()] as never);
      return Promise.resolve(emptyHistory() as never);
    });
    const contract: Contract = {
      id: "contract-1",
      insurance_plan_id: "plan-1",
      valid_from: "2026-10-01",
      valid_until: null,
      status: "em_revisao",
      pdf_s3_key: "contracts/contrato.pdf",
      items: [],
      created_at: "2026-09-01T00:00:00Z",
    };
    vi.mocked(apiClient.upload).mockResolvedValue(contract as never);

    renderWithProviders(<UploadCenterPage />);
    await goToContractsTab();

    const planSelect = await screen.findByLabelText(/Plano/);
    await screen.findByRole("option", { name: "Unimed Regional" });
    fireEvent.change(planSelect, { target: { value: "plan-1" } });
    fireEvent.change(screen.getByLabelText(/Vigência a partir de/), { target: { value: "2026-10-01" } });

    const user = userEvent.setup();
    const pdf = new File(["%PDF-1.4"], "contrato.pdf", { type: "application/pdf" });
    await user.upload(fileInput(), pdf);

    fireEvent.click(screen.getByRole("button", { name: "Enviar contrato" }));

    await waitFor(() => expect(apiClient.upload).toHaveBeenCalledWith("/api/v1/contracts/upload", expect.any(FormData)));
    const formData = vi.mocked(apiClient.upload).mock.calls[0][1] as FormData;
    expect(formData.get("insurance_plan_id")).toBe("plan-1");
    expect(formData.get("valid_from")).toBe("2026-10-01");
    expect((formData.get("file") as File).name).toBe("contrato.pdf");

    expect(
      await screen.findByText("PDF enviado. Vá até Convênios & Contratos para extrair a tabela de preços com IA e homologar.")
    ).toBeInTheDocument();
  });
});
