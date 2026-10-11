import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { DataReadiness } from "@/lib/types";

/**
 * Fontes de dado que a clínica já importou (GET /analytics/data-readiness).
 *
 * UX2-07: estado vazio nunca pode ler como "tudo certo". Quem mostra "fila
 * limpa", "sob controle" ou "dentro do esperado" consulta aqui antes: sem
 * faturamento importado, o texto é "ainda não há dados".
 */
export function useDataReadiness() {
  return useQuery({
    queryKey: ["analytics", "data-readiness"],
    queryFn: () => apiClient.get<DataReadiness>("/api/v1/analytics/data-readiness"),
    retry: false,
  });
}

/** `true` só quando já se sabe que não há faturamento importado. */
export function useNoBillingData(): boolean {
  const { data } = useDataReadiness();
  // Resposta fora do formato (API antiga, falha parcial) não vira "sem dados".
  return Array.isArray(data?.sources) && !data.sources.includes("faturamento");
}

export const NO_DATA_TEXT =
  "Ainda não há dados para analisar. Importe o faturamento em Importar dados para ver onde a clínica perde dinheiro.";
