import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/lib/types";

// Mesmo RBAC de Sala de Comando (ver App.tsx, rota /decisao, e
// CAN_VIEW_ANALYTICS em DashboardPage.tsx) — duplicado aqui de propósito
// (não importado de DashboardPage.tsx, que é lazy-loaded: importar de lá
// puxaria o chunk inteiro da página só por uma constante). Precisa ser
// role-aware porque RoleProtectedRoute manda QUALQUER papel sem acesso de
// volta pra "/" (ver ProtectedRoute.tsx) — se "/" mandasse todo mundo
// direto pra "/decisao" sem checar o papel, "atendimento" entraria num
// loop infinito (sem acesso a /decisao -> "/" -> "/decisao" -> ...).
const CAN_VIEW_SALA_DE_COMANDO: UserRole[] = ["owner", "admin", "financeiro", "auditor"];

/**
 * "Junta Técnica Insighta" — o Painel (BI tradicional) não deveria ser
 * "ponto de entrada padrão de quem abre o sistema de manhã", só destino
 * de drill-down a partir de um card do feed (ver _high_risk_billing_href,
 * backend). A raiz "/" agora sempre leva à Sala de Comando para quem tem
 * acesso a ela — nunca ao Painel diretamente — e só cai no Painel para o
 * papel que já não tinha acesso à Sala de Comando (mesmo fallback que já
 * existia antes desta mudança, só que hospedado em /painel em vez de na
 * própria raiz).
 */
export function RootRedirect() {
  const { user } = useAuth();
  const canViewSalaDeComando = !!user && CAN_VIEW_SALA_DE_COMANDO.includes(user.role);
  return <Navigate to={canViewSalaDeComando ? "/decisao" : "/painel"} replace />;
}
