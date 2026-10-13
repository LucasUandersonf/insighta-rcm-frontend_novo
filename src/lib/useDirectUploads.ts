import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
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
  const { user } = useAuth();
  // UX-35: papel sem acesso à importação recebia 403 a cada tela aberta.
  const canSee = !!user && ["owner", "admin", "financeiro", "auditor"].includes(user.role);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: DIRECT_UPLOADS_QUERY_KEY,
    enabled: canSee,
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

  // S6: quando um envio que estava na fila/processando termina, os números
  // da clínica mudaram — renova os painéis e o selo "Dados atualizados" do
  // topo agora, em vez de esperar o próximo refetch deles.
  const activeIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const uploads = query.data ?? [];
    const finished = uploads.some((u) => activeIds.current.has(u.upload_id) && u.status === "processado");
    activeIds.current = new Set(uploads.filter((u) => ACTIVE_STATES.includes(u.status)).map((u) => u.upload_id));
    if (finished) {
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["ingestion-files"] });
    }
  }, [query.data, queryClient]);

  return query;
}
