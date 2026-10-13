import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface Capabilities {
  email_enabled: boolean;
  billing_enabled: boolean;
}

/**
 * O que está ligado nesta instalação (GET /auth/capabilities, público).
 *
 * UX3-06: com o e-mail desligado, nenhuma tela diz "enviamos"; sem cobrança
 * ativa, nenhuma tela fala de assinatura. `undefined` = API antiga ou falha:
 * quem usa trata como "não sei" e mantém o comportamento de antes.
 */
export function useCapabilities() {
  return useQuery({
    queryKey: ["auth", "capabilities"],
    queryFn: () => apiClient.get<Capabilities>("/api/v1/auth/capabilities", { skipAuth: true }),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}
