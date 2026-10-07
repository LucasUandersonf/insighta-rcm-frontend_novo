import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import type { UserRole } from "@/lib/types";
import { SessionExpiredDialog } from "@/components/session/SessionExpiredDialog";
import { NoAccess } from "@/components/session/NoAccess";

export const CHANGE_TEMPORARY_PASSWORD_PATH = "/trocar-senha";

/**
 * Redireciona para /login se não houver sessão válida, e para a troca de
 * senha enquanto a senha temporária não for trocada (o backend já responde
 * 403 a todo o resto nesse estado — ver deps.get_current_user).
 */
export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const { pathname, search } = useLocation();
  if (!isAuthenticated) {
    // UX-24: depois de entrar, volta para a tela em que estava.
    const next = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return <Navigate to={`/login${next}`} replace />;
  }
  return (
    <>
      <SessionExpiredDialog />
      <TemporaryPasswordGate />
    </>
  );
}

function TemporaryPasswordGate() {
  const { data, isLoading } = useCurrentUserProfile();
  const { pathname } = useLocation();
  // Enquanto o perfil não chega, não monta as telas: com senha temporária o
  // backend responde 403 a tudo, e cada tela disparava suas chamadas à toa.
  if (isLoading && pathname !== CHANGE_TEMPORARY_PASSWORD_PATH) return null;
  if (data?.must_change_password && pathname !== CHANGE_TEMPORARY_PASSWORD_PATH) {
    return <Navigate to={CHANGE_TEMPORARY_PASSWORD_PATH} replace />;
  }
  return <Outlet />;
}

/**
 * Segunda camada de defesa no FRONTEND (espelhando require_role() do
 * backend — ver app/api/deps.py): esconder a rota não é o que impede o
 * acesso indevido (o backend já barra por conta própria com 403), só
 * evita renderizar uma tela cujas chamadas de API vão falhar de qualquer
 * forma. Deve ser usado DENTRO de <ProtectedRoute>, nunca no lugar dele.
 */
export function RoleProtectedRoute({ allowedRoles }: { allowedRoles: UserRole[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  // UX-25: antes voltava para a Home sem explicar (link compartilhado,
  // favorito antigo). Agora diz por quê e quem libera.
  if (!allowedRoles.includes(user.role)) return <NoAccess role={user.role} />;
  return <Outlet />;
}
