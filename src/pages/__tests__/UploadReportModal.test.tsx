import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { UploadReportModal } from "@/pages/UploadCenterPage";
import { apiClient } from "@/lib/api-client";
import { renderWithProviders } from "@/test/utils";
import type { IngestionValidationReport } from "@/lib/types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

describe("UploadReportModal", () => {
  it("mostra quantas linhas entraram e o motivo de cada rejeição", async () => {
    const report: IngestionValidationReport = {
      ingestion_file_id: "f1",
      original_filename: "faturamento.xlsx",
      data_type: "faturamento",
      total_rows: 100,
      accepted_rows: 97,
      rejected_rows: 3,
      pending_rows: 0,
      reasons: [{ reason: "Convênio não cadastrado: “Unimde”.", count: 3, rows: [4, 9, 12] }],
    };
    vi.mocked(apiClient.get).mockResolvedValue(report);
    renderWithProviders(<UploadReportModal fileId="f1" onClose={vi.fn()} />);

    expect(await screen.findByText(/Convênio não cadastrado: “Unimde”\./)).toBeInTheDocument();
    expect(screen.getByText(/de 100 linhas entraram — 3 linhas ficaram de fora/)).toBeInTheDocument();
    expect(screen.getByText("linhas 4, 9, 12 da planilha.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Baixar linhas rejeitadas/ })).toBeInTheDocument();
  });

  it("arquivo 100% rejeitado diz que nada foi importado e oferece resolver o convênio (UX-03/UX-06)", async () => {
    const report: IngestionValidationReport = {
      ingestion_file_id: "f2",
      original_filename: "faturamento.xlsx",
      data_type: "faturamento",
      total_rows: 8746,
      accepted_rows: 0,
      rejected_rows: 8746,
      pending_rows: 0,
      reasons: [
        {
          reason: "O convênio “Unimed Paulistana” ainda não existe na sua clínica.",
          count: 8746,
          rows: [2, 3, 4],
          action: "unknown_insurance_plan",
          raw_value: "Unimed Paulistana",
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(report);
    renderWithProviders(<UploadReportModal fileId="f2" onClose={vi.fn()} />);

    expect(await screen.findByText("nada foi importado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cadastrar “Unimed Paulistana”" })).toBeInTheDocument();
  });
});
