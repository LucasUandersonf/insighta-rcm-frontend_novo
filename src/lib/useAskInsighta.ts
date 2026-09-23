import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { AskResponse } from "@/lib/types";

/** "Pergunte ao Insighta" — POST /analytics/ask (ver
 * app/services/insighta_ask_service.py no backend). A IA só narra os
 * números que o próprio sistema já calculou; `sources` diz de onde. */
export function useAskInsighta() {
  return useMutation({
    mutationFn: (question: string) => apiClient.post<AskResponse>("/api/v1/analytics/ask", { question }),
  });
}
