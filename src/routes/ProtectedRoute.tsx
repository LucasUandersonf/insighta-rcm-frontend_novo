import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/lib/types";

/** Redireciona para /login se não houver sessão válida. */
export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
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
