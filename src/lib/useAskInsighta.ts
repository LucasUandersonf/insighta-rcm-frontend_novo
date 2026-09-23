import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { AiUsageSummary, AskResponse } from "@/lib/types";

/** "Pergunte ao Insighta" — POST /analytics/ask (ver
 * app/services/insighta_ask_service.py no backend). A IA só narra os
 * números que o próprio sistema já calculou; `sources` diz de onde. */
export function useAskInsighta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (question: string) => apiClient.post<AskResponse>("/api/v1/analytics/ask", { question }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["analytics", "ai-usage"] }),
  });
}

/** Bloco 3 — uso de IA da clínica no mês contra a cota (GET /analytics/ai-usage). */
export function useAiUsage(enabled = true) {
  return useQuery({
    queryKey: ["analytics", "ai-usage"],
    queryFn: () => apiClient.get<AiUsageSummary>("/api/v1/analytics/ai-usage"),
    enabled,
    staleTime: 60 * 1000,
    retry: false,
  });
}

/** "Restam 12 de 100 perguntas à IA este mês" — null quando não há cota. */
export function askQuotaNote(summary: AiUsageSummary | undefined): string | null {
  const ask = Array.isArray(summary?.items) ? summary.items.find((item) => item.kind === "ask") : undefined;
  if (!ask || ask.limit <= 0) return null;
  const left = Math.max(ask.limit - ask.used, 0);
  if (left === 0) return `A cota de ${ask.limit} perguntas à IA deste mês acabou.`;
  return `Restam ${left} de ${ask.limit} perguntas à IA este mês.`;
}
