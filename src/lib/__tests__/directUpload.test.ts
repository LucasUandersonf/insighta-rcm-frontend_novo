import { describe, expect, it, vi } from "vitest";
import { uploadViaS3 } from "@/lib/directUpload";
import { ApiError, apiClient } from "@/lib/api-client";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

const file = new File(["a;b\n1;2\n"], "estoque.csv", { type: "text/csv" });

describe("uploadViaS3", () => {
  it.each([409, 404, 405])("devolve null quando o servidor não oferece upload direto (%i)", async (status) => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new ApiError(status, { detail: "x" } as never));
    expect(await uploadViaS3(file, "estoque")).toBeNull();
  });

  it("envia ao S3, confirma e acompanha até processar", async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ upload_id: "u1", upload_url: "https://s3/x", method: "PUT", headers: { "Content-Type": "text/csv" } })
      .mockResolvedValueOnce({ upload_id: "u1", status: "na_fila", error: null, ingestion_file_id: null, row_count: null, error_row_count: null });
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      upload_id: "u1",
      status: "processado",
      error: null,
      ingestion_file_id: "f1",
      row_count: 10,
      error_row_count: 1,
    });
    const put = vi.fn().mockResolvedValue({ ok: true });

    const result = await uploadViaS3(file, "estoque", { sleep: async () => undefined, put: put as unknown as typeof fetch });

    expect(put).toHaveBeenCalledWith("https://s3/x", expect.objectContaining({ method: "PUT", body: file }));
    expect(result).toMatchObject({ id: "f1", row_count: 10, error_row_count: 1, data_type: "estoque" });
  });

  it("falha visível quando o processamento falha", async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ upload_id: "u2", upload_url: "https://s3/y", method: "PUT", headers: {} })
      .mockResolvedValueOnce({ upload_id: "u2", status: "falhou", error: "Planilha vazia.", ingestion_file_id: null, row_count: null, error_row_count: null });
    const put = vi.fn().mockResolvedValue({ ok: true });
    await expect(uploadViaS3(file, "estoque", { sleep: async () => undefined, put: put as unknown as typeof fetch })).rejects.toThrow("Planilha vazia.");
  });

  it("cai no upload pela API quando o armazenamento recusa ou a rede/CORS bloqueia", async () => {
    for (const put of [vi.fn().mockResolvedValue({ ok: false }), vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))]) {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ upload_id: "u3", upload_url: "https://s3/z", method: "PUT", headers: {} });
      expect(await uploadViaS3(file, "estoque", { sleep: async () => undefined, put: put as unknown as typeof fetch })).toBeNull();
    }
  });
});
