import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadCenterPage } from "@/pages/UploadCenterPage";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { startDirectUpload } from "@/lib/directUpload";
import { renderWithProviders } from "@/test/utils";
import { expectNoA11yViolations } from "@/test/a11y";
import type { Contract, IngestionFileEntry, InsurancePlan, PaginatedResponse, UploadIngestionFileResponse } from "@/lib/types";

// Achado da Auditoria de Prontidão v1: Central de Upload é a ÚNICA porta
// de entrada de dado real do produto (lotes operacionais + contratos de
// convênio) — sem nenhum teste de página até aqui, apesar de ser a
// espinha dorsal de tudo que a Sala de Comando depois analisa.
// Upload direto ao S3 desligado no servidor (409): a tela usa o upload pela API.
vi.mock("@/lib/directUpload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/directUpload")>();
  return { ...actual, startDirectUpload: vi.fn().mockResolvedValue(null) };
});

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));

function asRole(role: string) {
  vi.mocked(useAuth).mockReturnValue({ user: { sub: "u1", tenant_id: "t1", role } } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  asRole("owner");
  vi.mocked(startDirectUpload).mockResolvedValue(null);
});

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn(), upload: vi.fn(), delete: vi.fn() },
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

/** A tela confere o cabeçalho (preview-headers) antes do envio — o envio
 * de verdade é a chamada para /ingestion/upload. */
function uploadCall(): FormData {
  const call = vi.mocked(apiClient.upload).mock.calls.find((c) => c[0] === "/api/v1/ingestion/upload");
  if (!call) throw new Error("envio não foi chamado");
  return call[1] as FormData;
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error("input[type=file] não encontrado — Dropzone mudou de estrutura?");
  return input as HTMLInputElement;
}

describe("UploadCenterPage — aba Planilhas", () => {
  it("mostra o histórico vazio quando não há nenhum arquivo enviado ainda", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(emptyHistory() as never);

    renderWithProviders(<UploadCenterPage />);

    expect(
      await screen.findByText("Nenhum arquivo enviado ainda — o primeiro aparece aqui assim que for processado.")
    ).toBeInTheDocument();
  });

  it("mostra erro com tentar de novo quando o histórico falha ao carregar", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(apiError("Não foi possível carregar o histórico."));

    renderWithProviders(<UploadCenterPage />);

    expect(await screen.findByText("Não foi possível carregar o histórico.")).toBeInTheDocument();

    vi.mocked(apiClient.get).mockResolvedValue(emptyHistory() as never);
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));

    expect(
      await screen.findByText("Nenhum arquivo enviado ainda — o primeiro aparece aqui assim que for processado.")
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
    const formData = uploadCall();
    expect(formData.get("data_type")).toBe("faturamento");
    expect((formData.get("file") as File).name).toBe("faturamento.csv");

    // UX-03: o aviso diz o que entrou e o que ficou de fora, em português comum.
    expect(await screen.findByText("96 linhas entraram; 2 ficaram de fora. Veja o motivo e como resolver no relatório.")).toBeInTheDocument();
  });

  it("arquivo grande pela API entra na fila (202) e a tela libera na hora", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(emptyHistory() as never);
    vi.mocked(apiClient.upload).mockResolvedValue({
      upload_id: "up-1",
      status: "na_fila",
      error: null,
      ingestion_file_id: null,
      row_count: null,
      error_row_count: null,
      already_processed: false,
      message: null,
      processed_rows: 0,
      total_rows: null,
      ignored_columns: [],
    } as never);

    renderWithProviders(<UploadCenterPage />);
    await screen.findByText(/Nenhum arquivo enviado ainda/);
    const user = userEvent.setup();
    await user.upload(fileInput(), csvFile());
    fireEvent.click(screen.getByRole("button", { name: "Enviar arquivo" }));

    expect(await screen.findByText(/Arquivo recebido. Acompanhe o andamento logo abaixo/)).toBeInTheDocument();
    expect(screen.queryByText(/linhas entraram/)).not.toBeInTheDocument();
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

    // Tabela (tela larga) e cartões (celular, UX-27) ficam os dois no DOM.
    expect((await screen.findAllByText("agenda-agosto.xml")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("glosa-julho.json").length).toBeGreaterThan(0);
    // UX-03: o selo diz o que entrou, não só que o processamento terminou.
    expect(screen.getAllByText("Importado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Falhou").length).toBeGreaterThan(0);
  });

  it("arquivo acima de 3 MB sem upload direto disponível: avisa sem mandar para a API", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(emptyHistory() as never);
    renderWithProviders(<UploadCenterPage />);
    await screen.findByText(/Nenhum arquivo enviado ainda/);

    const big = new File(["x".repeat(3 * 1024 * 1024 + 10)], "grande.csv", { type: "text/csv" });
    const user = userEvent.setup();
    await user.upload(fileInput(), big);
    fireEvent.click(screen.getByRole("button", { name: "Enviar arquivo" }));

    expect(await screen.findByText(/Arquivos acima de 3 MB são processados em segundo plano/)).toBeInTheDocument();
    expect(apiClient.upload).not.toHaveBeenCalledWith("/api/v1/ingestion/upload", expect.anything());
  });

  it("upload direto: libera a tela na hora e mostra o progresso do processamento em segundo plano", async () => {
    let uploads: unknown[] = [];
    vi.mocked(apiClient.get).mockImplementation(((url: string) =>
      Promise.resolve(url.includes("direct-uploads") ? uploads : emptyHistory())) as never);
    vi.mocked(startDirectUpload).mockImplementation(async (_file, _type, options) => {
      options?.onProgress?.(0.4);
      uploads = [
        {
          upload_id: "u1",
          status: "processando",
          error: null,
          ingestion_file_id: null,
          row_count: null,
          error_row_count: null,
          original_filename: "faturamento.csv",
          data_type: "faturamento",
          processed_rows: 15000,
          total_rows: 60000,
        },
      ];
      return { upload_id: "u1", status: "na_fila", error: null, ingestion_file_id: null, row_count: null, error_row_count: null };
    });
    renderWithProviders(<UploadCenterPage />);
    await screen.findByText(/Nenhum arquivo enviado ainda/);

    const user = userEvent.setup();
    await user.upload(fileInput(), csvFile());
    fireEvent.click(screen.getByRole("button", { name: "Enviar arquivo" }));

    expect(await screen.findByText(/Arquivo recebido. Acompanhe o andamento logo abaixo/)).toBeInTheDocument();
    expect(await screen.findByText("Em andamento")).toBeInTheDocument();
    expect(screen.getByText("15.000 de 60.000 linhas (25%)")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progresso de faturamento.csv" })).toHaveAttribute("aria-valuenow", "25");
    expect(apiClient.upload).not.toHaveBeenCalledWith("/api/v1/ingestion/upload", expect.anything());
    // O botão volta a ficar livre: dá para enviar o próximo arquivo.
    expect(screen.getByRole("button", { name: "Enviar arquivo" })).toBeInTheDocument();
  });

  it("painel mostra o resultado de uma importação em segundo plano concluída, com relatório", async () => {
    vi.mocked(apiClient.get).mockImplementation(((url: string) =>
      Promise.resolve(
        url.includes("direct-uploads")
          ? [
              {
                upload_id: "u2",
                status: "processado",
                error: null,
                ingestion_file_id: "file-9",
                row_count: 300000,
                error_row_count: 12,
                original_filename: "ano-inteiro.xlsx",
                data_type: "faturamento",
                processed_rows: 300000,
                total_rows: 300000,
              },
              {
                upload_id: "u3",
                status: "falhou",
                error: "Faltam colunas obrigatórias do modelo de faturamento: data_atendimento.",
                ingestion_file_id: null,
                row_count: null,
                error_row_count: null,
                original_filename: "agenda-errada.csv",
                data_type: "faturamento",
              },
            ]
          : emptyHistory()
      )) as never);
    renderWithProviders(<UploadCenterPage />);

    expect(await screen.findByText("299.988 linhas entraram; 12 ficaram de fora.")).toBeInTheDocument();
    expect(screen.getByText(/Faltam colunas obrigatórias/)).toBeInTheDocument();
    expect(screen.getByText("Importado em parte")).toBeInTheDocument();
    expect(screen.getByText("Falhou")).toBeInTheDocument();
  });

  it("desfaz uma importação depois de mostrar a prévia do que será apagado", async () => {
    const history: PaginatedResponse<IngestionFileEntry> = { items: [makeFileEntry()], total: 1, limit: 15, offset: 0 };
    vi.mocked(apiClient.get).mockImplementation(((url: string) =>
      Promise.resolve(
        url.includes("undo-preview")
          ? { ingestion_file_id: "file-1", deleted: { "cobranças": 120, pacientes: 0 }, restored: 3, appeals_removed: 2, message: "" }
          : history
      )) as never);
    vi.mocked(apiClient.post).mockResolvedValue({
      ingestion_file_id: "file-1",
      deleted: { "cobranças": 120 },
      restored: 3,
      appeals_removed: 2,
      message: "Importação desfeita: 120 cobranças.",
    } as never);

    renderWithProviders(<UploadCenterPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Desfazer importação de faturamento-setembro.csv" }))[0]);

    expect(await screen.findByText("cobranças")).toBeInTheDocument();
    expect(screen.queryByText("pacientes")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("2 recursos de glosa abertos");
    fireEvent.click(screen.getByRole("button", { name: "Desfazer importação" }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/api/v1/ingestion/files/file-1/undo", undefined, { timeoutMs: 300_000 }));
    expect(await screen.findByText("Importação desfeita: 120 cobranças.")).toBeInTheDocument();
  });

  it("bloqueia o desfazer quando registros desta importação mudaram depois dela", async () => {
    const history: PaginatedResponse<IngestionFileEntry> = { items: [makeFileEntry()], total: 1, limit: 15, offset: 0 };
    vi.mocked(apiClient.get).mockImplementation(((url: string) =>
      Promise.resolve(
        url.includes("undo-preview")
          ? { ingestion_file_id: "file-1", deleted: { "cobranças": 10 }, restored: 4, appeals_removed: 0, conflicts: 2, edited_after_import: 0, message: "" }
          : history
      )) as never);

    renderWithProviders(<UploadCenterPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Desfazer importação de faturamento-setembro.csv" }))[0]);

    expect(await screen.findByText(/Não é possível desfazer agora/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desfazer importação" })).toBeDisabled();
  });

  it("exige confirmar a perda de edições feitas depois da importação", async () => {
    const history: PaginatedResponse<IngestionFileEntry> = { items: [makeFileEntry()], total: 1, limit: 15, offset: 0 };
    vi.mocked(apiClient.get).mockImplementation(((url: string) =>
      Promise.resolve(
        url.includes("undo-preview")
          ? { ingestion_file_id: "file-1", deleted: { "cobranças": 10 }, restored: 0, appeals_removed: 0, conflicts: 0, edited_after_import: 3, message: "" }
          : history
      )) as never);

    renderWithProviders(<UploadCenterPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Desfazer importação de faturamento-setembro.csv" }))[0]);

    const confirm = await screen.findByRole("checkbox");
    const undo = screen.getByRole("button", { name: "Desfazer importação" });
    expect(undo).toBeDisabled();
    fireEvent.click(confirm);
    expect(undo).toBeEnabled();
  });

  it("importação desfeita aparece como 'Desfeita' e sem botão de desfazer", async () => {
    const history: PaginatedResponse<IngestionFileEntry> = {
      items: [makeFileEntry({ undone_at: "2026-09-02T10:00:00Z" })],
      total: 1,
      limit: 15,
      offset: 0,
    };
    vi.mocked(apiClient.get).mockResolvedValue(history as never);
    renderWithProviders(<UploadCenterPage />);
    expect((await screen.findAllByText("Desfeita")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Desfazer importação de/ })).not.toBeInTheDocument();
  });

  it("rodada 8 (M1): worker parado troca o 'começa em instantes' pelo aviso de atraso", async () => {
    vi.mocked(apiClient.get).mockImplementation(((url: string) =>
      Promise.resolve(
        url.includes("direct-uploads")
          ? [
              {
                upload_id: "u4",
                status: "na_fila",
                error: null,
                ingestion_file_id: null,
                row_count: null,
                error_row_count: null,
                original_filename: "grande.csv",
                data_type: "faturamento",
                queue_delayed: true,
                queue_message: "O processamento está atrasado. Já fomos avisados e o arquivo continua guardado.",
              },
            ]
          : emptyHistory(),
      )) as never);
    renderWithProviders(<UploadCenterPage />);
    expect(await screen.findByText(/O processamento está atrasado/)).toBeInTheDocument();
    expect(screen.queryByText(/começa em instantes/)).not.toBeInTheDocument();
  });

  it("rodada 8 (B2): auditor vê o histórico e o relatório, sem enviar nem desfazer", async () => {
    asRole("auditor");
    const history: PaginatedResponse<IngestionFileEntry> = { items: [makeFileEntry()], total: 1, limit: 15, offset: 0 };
    vi.mocked(apiClient.get).mockResolvedValue(history as never);
    renderWithProviders(<UploadCenterPage />);
    await screen.findAllByText("faturamento-setembro.csv");
    expect(screen.getByRole("heading", { name: "Importações" })).toBeInTheDocument();
    expect(screen.queryByText("Enviar planilha")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Contratos de convênio (PDF)" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Relatório" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Desfazer importação de/ })).not.toBeInTheDocument();
  });

  it("quem não é dono nem administrador não vê o botão de desfazer", async () => {
    asRole("viewer");
    const history: PaginatedResponse<IngestionFileEntry> = { items: [makeFileEntry()], total: 1, limit: 15, offset: 0 };
    vi.mocked(apiClient.get).mockResolvedValue(history as never);
    renderWithProviders(<UploadCenterPage />);
    await screen.findAllByText("faturamento-setembro.csv");
    expect(screen.queryByRole("button", { name: /Desfazer importação de/ })).not.toBeInTheDocument();
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

    await screen.findAllByText("agenda-agosto.xml");
    await expectNoA11yViolations(container);
  });
});

describe("UploadCenterPage — aba Contratos de convênio (PDF)", () => {
  async function goToContractsTab() {
    fireEvent.click(screen.getByRole("tab", { name: "Contratos de convênio (PDF)" }));
    await screen.findByText("Enviar contrato de convênio");
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
      await screen.findByText("PDF enviado. Em Convênios › Contratos, leia a tabela de preços e aprove.")
    ).toBeInTheDocument();
  });
});


// Auditoria V1, rodada 14 (B2): mapeamento salvo visível e removível.
describe("UploadCenterPage — mapeamentos salvos", () => {
  it("lista o mapeamento salvo do modelo e esquece com um clique", async () => {
    vi.mocked(apiClient.get).mockImplementation((path: string) => {
      if (path.startsWith("/api/v1/ingestion/column-aliases"))
        return Promise.resolve([
          { id: "al-1", data_type: "faturamento", source_header: "Vlr Pago", canonical_field: "valor_cobrado", created_at: "2026-09-01T00:00:00Z" },
        ] as never);
      return Promise.resolve(emptyHistory() as never);
    });
    vi.mocked(apiClient.delete).mockResolvedValue(undefined as never);
    const user = userEvent.setup();

    renderWithProviders(<UploadCenterPage />);

    await user.click(await screen.findByText(/Colunas que você já mapeou para este tipo \(1\)/));
    expect(screen.getByText("Vlr Pago")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remover" }));

    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/ingestion/column-aliases/al-1"));
  });
});
