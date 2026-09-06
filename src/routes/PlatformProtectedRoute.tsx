import { Navigate, Outlet } from "react-router-dom";
import { getStoredPlatformToken } from "@/lib/platform-api-client";

/**
 * Mesmo papel de ProtectedRoute.tsx, mas para o painel interno de
 * Customer Success (/plataforma) — checa a presença do token separado
 * (insighta_platform_admin_token), nunca o AuthContext de clínica. Só
 * confirma "existe um token guardado"; validade/expiração de verdade é
 * responsabilidade do backend a cada chamada (ver PlatformDashboardPage,
 * que trata 401 redirecionando de volta pra cá).
 */
export function PlatformProtectedRoute() {
  if (!getStoredPlatformToken()) return <Navigate to="/plataforma/login" replace />;
  return <Outlet />;
}
