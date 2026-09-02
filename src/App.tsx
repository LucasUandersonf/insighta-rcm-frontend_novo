import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { SignUpPage } from "@/pages/SignUpPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ExecutiveOverviewPage } from "@/pages/ExecutiveOverviewPage";
import { ContractsPage } from "@/pages/ContractsPage";
import { DenialAppealsPage } from "@/pages/DenialAppealsPage";
import { AppointmentsPage } from "@/pages/AppointmentsPage";
import { UploadCenterPage } from "@/pages/UploadCenterPage";
import { UsersPage } from "@/pages/admin/UsersPage";
import { IntegrationsPage } from "@/pages/admin/IntegrationsPage";
import { TenantPage } from "@/pages/admin/TenantPage";
import { ReportRecipientsPage } from "@/pages/admin/ReportRecipientsPage";
import { AuditLogPage } from "@/pages/admin/AuditLogPage";
import { RoleProtectedRoute } from "@/routes/ProtectedRoute";
import { isApiConfigured } from "@/lib/api-client";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/appointments" element={<AppointmentsPage />} />
                {/* Módulos operacionais de Profissionais/Pacientes foram removidos por
                    decisão de produto — o SaaS opera exclusivamente sobre dados
                    consolidados do ERP externo (ver auditoria Go-Live). O catch-all
                    "*" abaixo já cobre qualquer link antigo para /patients ou
                    /professionals, então não é necessária uma rota dedicada aqui. */}
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
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
