import { ApiError, apiClient } from "@/lib/api-client";

/**
 * Upload direto do navegador para o armazenamento (URL pré-assinada): a API
 * nunca segura o arquivo e o worker processa em segundo plano.
 *
 * `startDirectUpload` envia o arquivo (com a porcentagem do envio), confirma
 * e devolve na hora — a pessoa não fica presa na tela esperando o
 * processamento. O andamento (linhas processadas / total) é acompanhado por
 * `useDirectUploads` (lib/useDirectUploads.ts), no painel "Em processamento"
 * e no indicador que aparece em qualquer tela.
 *
 * Devolve `null` quando o servidor não oferece upload direto (409 desligado;
 * 404/405 API antiga) ou o armazenamento recusa o envio (CORS, rede): a tela
 * usa o envio pela API, que só aceita arquivos pequenos.
 */
interface DirectUploadCreated {
  upload_id: string;
  upload_url: string;
  method: string;
  headers: Record<string, string>;
}

export type DirectUploadState = "aguardando_envio" | "na_fila" | "processando" | "processado" | "falhou";

export interface DirectUploadStatus {
  upload_id: string;
  status: DirectUploadState;
  error: string | null;
  ingestion_file_id: string | null;
  row_count: number | null;
  error_row_count: number | null;
  already_processed?: boolean;
  message?: string | null;
  original_filename?: string | null;
  data_type?: string | null;
  processed_rows?: number;
  total_rows?: number | null;
  created_at?: string | null;
  completed_at?: string | null;
}

/** Limite do envio pela API (espelha INGESTION_SYNC_MAX_MB do backend):
 * acima disso o arquivo só é aceito pelo upload direto. */
export const SYNC_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;

export const LARGE_FILE_UNAVAILABLE_MESSAGE =
  "Arquivos acima de 3 MB são processados em segundo plano, e esse envio não está disponível agora. " +
  "Divida o arquivo em partes menores e envie uma de cada vez, ou tente de novo em alguns minutos.";

export const ACTIVE_STATES: DirectUploadState[] = ["aguardando_envio", "na_fila", "processando"];

/** PUT com porcentagem do envio (fetch não informa progresso de upload). */
export type PutWithProgress = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: Blob },
  onProgress: (fraction: number) => void
) => Promise<boolean>;

export const xhrPut: PutWithProgress = (url, { method, headers, body }, onProgress) =>
  new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false); // CORS do bucket ou rede: a tela decide o que fazer
    xhr.onabort = () => resolve(false);
    xhr.send(body);
  });

export async function startDirectUpload(
  file: File,
  dataType: string,
  { onProgress = () => undefined, put = xhrPut }: { onProgress?: (fraction: number) => void; put?: PutWithProgress } = {}
): Promise<DirectUploadStatus | null> {
  let created: DirectUploadCreated;
  try {
    created = await apiClient.post<DirectUploadCreated>("/api/v1/ingestion/direct-uploads", {
      filename: file.name,
      data_type: dataType,
      size_bytes: file.size,
      content_type: file.type || null,
    });
  } catch (err) {
    if (err instanceof ApiError && [404, 405, 409].includes(err.status)) return null;
    throw err;
  }

  const sent = await put(created.upload_url, { method: created.method, headers: created.headers, body: file }, onProgress);
  if (!sent) return null;
  onProgress(1);
  return apiClient.post<DirectUploadStatus>(`/api/v1/ingestion/direct-uploads/${created.upload_id}/complete`);
}

/** Porcentagem do processamento (0–100) ou null enquanto o total ainda não é conhecido. */
export function processingPercent(upload: DirectUploadStatus): number | null {
  if (upload.status === "processado") return 100;
  if (!upload.total_rows) return null;
  return Math.min(100, Math.round(((upload.processed_rows ?? 0) / upload.total_rows) * 100));
}
