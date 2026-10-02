import { describe, expect, it, vi } from "vitest";
import { processingPercent, startDirectUpload, type PutWithProgress } from "@/lib/directUpload";
import { ApiError, apiClient } from "@/lib/api-client";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

const file = new File(["a;b\n1;2\n"], "estoque.csv", { type: "text/csv" });

describe("startDirectUpload", () => {
  it.each([409, 404, 405])("devolve null quando o servidor não oferece upload direto (%i)", async (status) => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new ApiError(status, { detail: "x" } as never));
    expect(await startDirectUpload(file, "estoque")).toBeNull();
  });

  it("envia com porcentagem, confirma e devolve na hora (sem esperar o processamento)", async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ upload_id: "u1", upload_url: "https://s3/x", method: "PUT", headers: { "Content-Type": "text/csv" } })
      .mockResolvedValueOnce({ upload_id: "u1", status: "na_fila", error: null, ingestion_file_id: null, row_count: null, error_row_count: null });
    const put = vi.fn<PutWithProgress>(async (_url, _init, onProgress) => {
      onProgress(0.5);
      return true;
    });
    const progress: number[] = [];

    const queued = await startDirectUpload(file, "estoque", { put, onProgress: (f) => progress.push(f) });

    expect(put).toHaveBeenCalledWith("https://s3/x", expect.objectContaining({ method: "PUT", body: file }), expect.any(Function));
    expect(apiClient.post).toHaveBeenLastCalledWith("/api/v1/ingestion/direct-uploads/u1/complete");
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(queued).toMatchObject({ upload_id: "u1", status: "na_fila" });
    expect(progress).toEqual([0.5, 1]);
  });

  it("cai no envio pela API quando o armazenamento recusa ou a rede/CORS bloqueia", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ upload_id: "u3", upload_url: "https://s3/z", method: "PUT", headers: {} });
    expect(await startDirectUpload(file, "estoque", { put: async () => false })).toBeNull();
  });
});

describe("processingPercent", () => {
  const base = { upload_id: "u", error: null, ingestion_file_id: null, row_count: null, error_row_count: null };
  it("calcula pelo total de linhas; sem total ainda, null", () => {
    expect(processingPercent({ ...base, status: "processando", processed_rows: 5000, total_rows: 20000 })).toBe(25);
    expect(processingPercent({ ...base, status: "processando", processed_rows: 0, total_rows: null })).toBeNull();
    expect(processingPercent({ ...base, status: "processado" })).toBe(100);
  });
});
