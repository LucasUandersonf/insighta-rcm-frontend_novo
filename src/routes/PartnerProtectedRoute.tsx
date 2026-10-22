import { Navigate, Outlet } from "react-router-dom";
import { getStoredPartnerToken } from "@/lib/partner-api-client";

/** Carteira do parceiro (v1.1): só com o token do parceiro, que é outro
 * login, separado do login de clínica (ver partner-api-client.ts). */
export function PartnerProtectedRoute() {
  if (!getStoredPartnerToken()) return <Navigate to="/parceiro/login" replace />;
  return <Outlet />;
}
