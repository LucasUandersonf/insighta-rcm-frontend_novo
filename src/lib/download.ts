import { apiClient } from "@/lib/api-client";

/** Baixa um arquivo autenticado da API e entrega ao navegador com o nome dado. */
export async function saveBlob(path: string, filename: string): Promise<void> {
  const blob = await apiClient.getBlob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
