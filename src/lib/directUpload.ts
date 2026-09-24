import { ApiError, apiClient } from "@/lib/api-client";
import type { UploadIngestionFileResponse } from "@/lib/types";

/**
 * Bloco 4 — upload direto do navegador para o S3 (URL pré-assinada): a
 * API nunca segura o arquivo, e lote grande não estoura timeout. O worker
 * processa e a tela acompanha o status. Quando o recurso está desligado no
 * servidor (409) ou o envio ao armazenamento falha, devolve `null` e a tela
 * usa o upload pela API de sempre.
 */
interface DirectUploadCreated {
  upload_id: string;
  upload_url: string;
  method: string;
  headers: Record<string, string>;
}

interface DirectUploadStatus {
  upload_id: string;
  status: "aguardando_envio" | "na_fila" | "processando" | "processado" | "falhou";
  error: string | null;
  ingestion_file_id: string | null;
  row_count: number | null;
  error_row_count: number | null;
}

const POLL_MS = 2000;
const MAX_WAIT_MS = 10 * 60 * 1000;

export async function uploadViaS3(
  file: File,
  dataType: string,
  { sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)), put = fetch }: { sleep?: (ms: number) => Promise<unknown>; put?: typeof fetch } = {}
): Promise<UploadIngestionFileResponse | null> {
  let created: DirectUploadCreated;
  try {
    created = await apiClient.post<DirectUploadCreated>("/api/v1/ingestion/direct-uploads", {
      filename: file.name,
      data_type: dataType,
      size_bytes: file.size,
      content_type: file.type || null,
    });
  } catch (err) {
    // 409: desligado no servidor; 404/405: API ainda sem o recurso (front e
    // back publicados em momentos diferentes) — nos dois casos, upload pela API.
    if (err instanceof ApiError && [404, 405, 409].includes(err.status)) return null;
    throw err;
  }

  // Armazenamento recusou ou ficou inalcançável (CORS do bucket, rede): a
  // tela cai no upload pela API de sempre em vez de travar o usuário.
  let sent: Response | null = null;
  try {
    sent = await put(created.upload_url, { method: created.method, headers: created.headers, body: file });
  } catch {
    sent = null;
  }
  if (!sent?.ok) return null;

  let status = await apiClient.post<DirectUploadStatus>(`/api/v1/ingestion/direct-uploads/${created.upload_id}/complete`);
  const started = Date.now();
  while (status.status !== "processado" && status.status !== "falhou") {
    if (Date.now() - started > MAX_WAIT_MS) {
      throw new Error("O arquivo foi recebido e continua em processamento. Ele aparece no histórico assim que terminar.");
    }
    await sleep(POLL_MS);
    status = await apiClient.get<DirectUploadStatus>(`/api/v1/ingestion/direct-uploads/${created.upload_id}`);
  }
  if (status.status === "falhou") throw new Error(status.error ?? "Falha ao processar o arquivo.");
  return {
    id: status.ingestion_file_id ?? created.upload_id,
    file_format: "csv",
    data_type: dataType,
    status: "processed",
    row_count: status.row_count ?? 0,
    error_row_count: status.error_row_count ?? 0,
    received_at: new Date().toISOString(),
    already_processed: false,
    message: null,
  } as UploadIngestionFileResponse;
}
