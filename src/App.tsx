import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { ModalStackProvider } from "@/context/ModalStackContext";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { RoleProtectedRoute } from "@/routes/ProtectedRoute";
import { PlatformProtectedRoute } from "@/routes/PlatformProtectedRoute";
import { isApiConfigured } from "@/lib/api-client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouteLoadingFallback } from "@/components/RouteLoadingFallback";

// Achado do Laudo de Vistoria Técnica (parecer UX): o pacote baixado
// pelo navegador crescia sem divisão por tela (quase 1MB) — pesado numa
// conexão ruim, realidade de muita clínica pequena no Brasil. Cada
// PÁGINA (não AppShell/rotas guardas, pequenas e sempre necessárias)
// agora é seu próprio chunk, baixado só quando a rota é de fato visitada
// — ver também `build.rollupOptions.output.manualChunks` em
// vite.config.ts, que separa as bibliotecas de terceiros do mesmo jeito.
const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const SignUpPage = lazy(() => import("@/pages/SignUpPage").then((m) => ({ default: m.SignUpPage })));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const ExecutiveOverviewPage = lazy(() => import("@/pages/ExecutiveOverviewPage").then((m) => ({ default: m.ExecutiveOverviewPage })));
const ContractsPage = lazy(() => import("@/pages/ContractsPage").then((m) => ({ default: m.ContractsPage })));
const DenialAppealsPage = lazy(() => import("@/pages/DenialAppealsPage").then((m) => ({ default: m.DenialAppealsPage })));
const AppointmentsPage = lazy(() => import("@/pages/AppointmentsPage").then((m) => ({ default: m.AppointmentsPage })));
const ProfessionalsPage = lazy(() => import("@/pages/ProfessionalsPage").then((m) => ({ default: m.ProfessionalsPage })));
const UploadCenterPage = lazy(() => import("@/pages/UploadCenterPage").then((m) => ({ default: m.UploadCenterPage })));
const SetupPage = lazy(() => import("@/pages/SetupPage").then((m) => ({ default: m.SetupPage })));
const UsersPage = lazy(() => import("@/pages/admin/UsersPage").then((m) => ({ default: m.UsersPage })));
const IntegrationsPage = lazy(() => import("@/pages/admin/IntegrationsPage").then((m) => ({ default: m.IntegrationsPage })));
const TenantPage = lazy(() => import("@/pages/admin/TenantPage").then((m) => ({ default: m.TenantPage })));
const ReportRecipientsPage = lazy(() => import("@/pages/admin/ReportRecipientsPage").then((m) => ({ default: m.ReportRecipientsPage })));
const AuditLogPage = lazy(() => import("@/pages/admin/AuditLogPage").then((m) => ({ default: m.AuditLogPage })));
const PlatformLoginPage = lazy(() => import("@/pages/platform/PlatformLoginPage").then((m) => ({ default: m.PlatformLoginPage })));
const PlatformDashboardPage = lazy(() => import("@/pages/platform/PlatformDashboardPage").then((m) => ({ default: m.PlatformDashboardPage })));

/**
 * Tela de erro REAL, visível, em vez de deixar a aplicação simplesmente
 * não renderizar nada — foi exatamente isso que aconteceu em produção
 * (VITE_API_BASE_URL ausente no build do Railway): tela preta, sem
 * nenhuma pista do que estava errado. Isso nunca mais deveria acontecer
 * silenciosamente.
 */
function ConfigurationErrorScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded border border-denied/30 bg-denied-bg p-6 text-center">
        <h1 className="mb-2 text-sm font-semibold text-denied">Configuração ausente</h1>
        <p className="text-sm text-ink-muted">
          A variável <code className="text-ink">VITE_API_BASE_URL</code> não foi definida neste ambiente.
        </p>
        <p className="mt-3 text-xs text-ink-faint">
          Variáveis do Vite são resolvidas em tempo de BUILD, não de execução — configure-a nas variáveis de
          ambiente do serviço (Railway → Variables) e faça um novo deploy, não só um restart.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  if (!isApiConfigured) return <ConfigurationErrorScreen />;

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <ModalStackProvider>
          {/* Migração v6 -> v7 (achado do Laudo de Vistoria Técnica, parecer
              AppSec: as duas CVEs abertas do react-router-dom só têm correção
              na v7, nenhum patch de v6 resolve). Passo 1 foi ligar as future
              flags v7_startTransition/v7_relativeSplatPath ainda na v6, rodar
              a suíte inteira e confirmar zero mudança de comportamento — na
              v7 esses dois comportamentos viram o único modo de operar (a
              prop `future` do BrowserRouter nem aceita mais essas duas
              chaves), então não há mais nada para configurar aqui. */}
          <BrowserRouter>
            <Suspense fallback={<RouteLoadingFallback fullScreen />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              {/* Painel interno de Customer Success — NUNCA linkado de
                  dentro do produto, fora do AuthContext/RBAC de clínica
                  de propósito (ver DECISÃO em src/routes/PlatformProtectedRoute.tsx
                  e app/api/platform_admin_auth.py no backend). */}
              <Route path="/plataforma/login" element={<PlatformLoginPage />} />
              <Route element={<PlatformProtectedRoute />}>
                <Route path="/plataforma" element={<PlatformDashboardPage />} />
              </Route>
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/appointments" element={<AppointmentsPage />} />
                {/* O CRUD operacional de Pacientes foi removido por decisão de produto
                    — o SaaS opera exclusivamente sobre dados consolidados do ERP
                    externo (ver auditoria Go-Live). /professionals é diferente:
                    voltou (achado F-02) porque o profissional já entra sozinho pela
                    própria ingestão de faturamento, mas SEMPRE sem grade semanal — um
                    CSV não carrega horário de atendimento. Sem esta tela, Agenda &
                    Capacidade fica estruturalmente inviável para quem opera só via
                    ingestão. Não é reintrodução do CRUD antigo, é configuração de um
                    parâmetro de cálculo que não tem outra fonte de dado possível (ver
                    ProfessionalsPage.tsx). O catch-all "*" abaixo cobre qualquer link
                    antigo para /patients.
                    RBAC: mesmo critério de escrita restrita de /upload e /contracts —
                    editar grade é ação administrativa, fora do alcance de atendimento. */}
                <Route element={<RoleProtectedRoute allowedRoles={["owner", "admin"]} />}>
                  <Route path="/professionals" element={<ProfessionalsPage />} />
                </Route>
                <Route element={<RoleProtectedRoute allowedRoles={["owner", "admin", "financeiro", "auditor"]} />}>
                  <Route path="/decisao" element={<ExecutiveOverviewPage />} />
                  <Route path="/contracts" element={<ContractsPage />} />
                  <Route path="/denial-appeals" element={<DenialAppealsPage />} />
                </Route>
                {/* Upload é ação de escrita — mesmo RBAC do backend em
                    ingestion.py/_CAN_MANAGE e contracts.py/_CAN_WRITE
                    (owner/admin/financeiro); sem auditor, que é só leitura. */}
                <Route element={<RoleProtectedRoute allowedRoles={["owner", "admin", "financeiro"]} />}>
                  <Route path="/upload" element={<UploadCenterPage />} />
                  {/* Destino que o próprio toast de sucesso da Central de Upload já
                      promete ("veja a tela de Setup") — mesmo RBAC de /upload
                      (ingestion.py/_CAN_MANAGE: owner/admin/financeiro). */}
                  <Route path="/setup" element={<SetupPage />} />
                </Route>
                <Route element={<RoleProtectedRoute allowedRoles={["owner", "admin"]} />}>
                  <Route path="/admin/users" element={<UsersPage />} />
                  <Route path="/admin/integrations" element={<IntegrationsPage />} />
                  <Route path="/admin/tenant" element={<TenantPage />} />
                  <Route path="/admin/report-recipients" element={<ReportRecipientsPage />} />
                </Route>
                {/* auditor também acessa a trilha de auditoria (RBAC igual ao backend em audit_log.py) */}
                <Route element={<RoleProtectedRoute allowedRoles={["owner", "admin", "auditor"]} />}>
                  <Route path="/admin/audit-log" element={<AuditLogPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
          </ModalStackProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
