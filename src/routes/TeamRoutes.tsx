import { lazy } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { RouteLoadingFallback } from "@/components/RouteLoadingFallback";
import { isManagerProfile, useTeamProfile } from "@/lib/team";

const HomePage = lazy(() => import("@/pages/HomePage").then((m) => ({ default: m.HomePage })));
const CoordinatorHomePage = lazy(() => import("@/pages/CoordinatorHomePage").then((m) => ({ default: m.CoordinatorHomePage })));

/**
 * Equipe (Redesign 2026): "cada coordenador não deve ter a visão geral do
 * gestor, mas sim cada setor com seus b.o.s". A Home do gestor (briefing
 * da clínica inteira) e a do coordenador (só as demandas e o radar do
 * setor dele) são telas diferentes na MESMA rota "/".
 */
export function HomeRouter() {
  const { profile, isLoading } = useTeamProfile();
  if (isLoading || !profile) return <RouteLoadingFallback />;
  return isManagerProfile(profile) ? <HomePage /> : <CoordinatorHomePage />;
}

/** Visões gerais (Sala de Comando, Painel, Consolidado) só para o gestor —
 * o coordenador volta para a própria Home. */
export function ManagerProfileRoute() {
  const { profile, isLoading } = useTeamProfile();
  if (isLoading || !profile) return <RouteLoadingFallback />;
  if (!isManagerProfile(profile)) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Redireciona uma rota que saiu (ex.: "/painel") mantendo a query string
 * — os insights antigos mandam filtros como `?insurance_plan_id=`. */
export function LegacyRedirect({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}
