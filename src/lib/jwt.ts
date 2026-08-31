import type { CurrentUser } from "./types";

/**
 * Decodifica o PAYLOAD do JWT no navegador — sem validar assinatura.
 * Isso é só para exibir informação na UI (papel do usuário, tenant);
 * a validação de verdade (assinatura, expiração) sempre acontece no
 * backend, em toda requisição. Nunca confie neste decode para decisão
 * de segurança no cliente.
 */
export function decodeJwtPayload(token: string): CurrentUser | null {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as CurrentUser;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token) as (CurrentUser & { exp?: number }) | null;
  if (!payload?.exp) return true;
  return Date.now() >= payload.exp * 1000;
}
