import { useQuery } from "@tanstack/react-query";
import { ApiError, apiClient } from "@/lib/api-client";
import { ACTIVE_STATES, type DirectUploadStatus } from "@/lib/directUpload";

export const DIRECT_UPLOADS_QUERY_KEY = ["ingestion", "direct-uploads"] as const;

/**
 * Envios em segundo plano da clínica (em andamento e os que terminaram nos
 * últimos 30 min), com o progresso de cada um. Consulta a cada 2 s só
 * enquanto algum está na fila ou processando; parado, não consulta de novo
 * (quem inicia um envio invalida esta chave).
 */
export function useDirectUploads() {
  return useQuery({
    queryKey: DIRECT_UPLOADS_QUERY_KEY,
    queryFn: async () => {
      try {
        const uploads = await apiClient.get<DirectUploadStatus[]>("/api/v1/ingestion/direct-uploads");
        return Array.isArray(uploads) ? uploads : [];
      } catch (err) {
        // API ainda sem o recurso, ou papel sem acesso: só não mostra nada.
        if (err instanceof ApiError && [403, 404, 405].includes(err.status)) return [];
        throw err;
      }
    },
    refetchInterval: (query) => (query.state.data ?? []).some((u) => ACTIVE_STATES.includes(u.status)) ? 2000 : false,
    staleTime: 0,
    retry: false,
  });
}
