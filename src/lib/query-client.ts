import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

/**
 * Configuração única do react-query para o projeto todo.
 * - retry: false por padrão — erro de negócio (ApiError com status 4xx)
 *   nunca deveria ser retentado automaticamente (ex: senha errada não
 *   fica certa na segunda tentativa). Falhas de rede genuínas o usuário
 *   já pode tentar de novo manualmente pela própria ação da UI.
 * - staleTime moderado: dado de clínica (pacientes, profissionais) não
 *   muda a cada segundo — evita refetch agressivo desnecessário.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export function getApiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  // `new Error("...")` lançado pelo próprio app já vem em português para a
  // pessoa; TypeError/RangeError etc. são falhas internas e não aparecem.
  if (err instanceof Error && err.name === "Error" && err.message) return err.message;
  return "Algo deu errado. Tente novamente.";
}
