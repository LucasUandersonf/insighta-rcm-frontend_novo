import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import type { UserRole } from "@/lib/types";

export const CHANGE_TEMPORARY_PASSWORD_PATH = "/trocar-senha";

/**
 * Redireciona para /login se não houver sessão válida, e para a troca de
 * senha enquanto a senha temporária não for trocada (o backend já responde
 * 403 a todo o resto nesse estado — ver deps.get_current_user).
 */
export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <TemporaryPasswordGate />;
}

function TemporaryPasswordGate() {
  const { data } = useCurrentUserProfile();
  const { pathname } = useLocation();
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
  if (!user || !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
