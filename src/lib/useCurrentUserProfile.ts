import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { PlatformUser } from "@/lib/types";

/**
 * Perfil do PRÓPRIO usuário autenticado (nome completo, e-mail) — o JWT
 * (ver AuthContext/jwt.ts) só carrega tenant_id/role/sub, não é suficiente
 * pra "identificação do usuário" (avatar + nome) pedida para a barra
 * superior. GET /api/v1/users/me é liberado para qualquer papel
 * autenticado (self-service, não é a gestão de usuários de UsersPage).
 *
 * staleTime alto de propósito: o próprio nome/e-mail não muda a cada
 * navegação de tela — não faz sentido essa chamada competir com o
 * refetch de dado operacional (billing, agenda) toda vez que o usuário
 * troca de rota.
 */
export function useCurrentUserProfile() {
  return useQuery({
    queryKey: ["users", "me"],
    queryFn: () => apiClient.get<PlatformUser>("/api/v1/users/me"),
    staleTime: 5 * 60 * 1000,
  });
}

/** Primeiro nome, a partir de "full_name" — usado na saudação da Sala de
 * Comando ("Bom dia, Lucas") sem repetir o nome completo em um contexto
 * curto e informal. */
export function firstNameFrom(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** Iniciais (1 ou 2 letras) a partir de "full_name" — alimenta o avatar
 * textual do usuário (sem foto: este produto não tem upload de avatar,
 * e um retrato genérico de placeholder violaria o princípio "zero
 * mocks" já seguido no resto da UI — ver DashboardPage.tsx). */
export function initialsFrom(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}
