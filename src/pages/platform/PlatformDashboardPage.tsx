import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ShieldCheck, LogOut, BellRing } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ApiError } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { clearStoredPlatformToken, platformApiClient } from "@/lib/platform-api-client";
import { useToast } from "@/context/ToastContext";
import type { PlatformAlertRunResult, TenantEngagementStatus, TenantUsageSummary } from "@/lib/types";

function describeAlertRun(result: PlatformAlertRunResult): string {
  if (result.new_alerts.length === 0 && result.reminders_sent.length === 0 && result.recovered.length === 0) {
    return "Nenhuma mudança de status desde a última checagem.";
  }
  const parts: string[] = [];
  if (result.new_alerts.length > 0) parts.push(`${result.new_alerts.length} nova(s) em risco: ${result.new_alerts.join(", ")}`);
  if (result.reminders_sent.length > 0) parts.push(`${result.reminders_sent.length} lembrete(s) reenviado(s): ${result.reminders_sent.join(", ")}`);
  if (result.recovered.length > 0) parts.push(`${result.recovered.length} recuperada(s): ${result.recovered.join(", ")}`);
  return parts.join(" · ");
}

const STATUS_LABEL: Record<TenantEngagementStatus, string> = {
  engajado: "Engajado",
  atencao: "Atenção",
  risco: "Risco de cancelamento",
  novo: "Novo (implantação)",
  inativo: "Inativo",
};

const STATUS_TONE: Record<TenantEngagementStatus, BadgeTone> = {
  engajado: "revenue",
  atencao: "pending",
  risco: "denied",
  novo: "accent",
  inativo: "neutral",
};

function formatDate(iso: string | null): string {
  if (!iso) return "nunca";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso));
}

function formatDaysAgo(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

export function PlatformDashboardPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["platform", "tenants-usage"],
    queryFn: () => platformApiClient.getTenantsUsage(),
    retry: false,
  });

  // Disparo manual (ver POST /platform/alerts/run) — em produção isto
  // roda sozinho via app/worker/platform_risk_alert_job.py agendado
  // externamente; este botão é só para checar agora, sem esperar o
  // agendador (mesmo espírito do "Enviar agora" do relatório semanal).
  const runAlertsMutation = useMutation({
    mutationFn: () => platformApiClient.runAlerts(),
    onSuccess: (result) => {
      showSuccess(describeAlertRun(result));
      refetch();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  // Sessão inválida/expirada (401) — mesma lógica de app/api/deps.py: o
  // backend nunca diferencia "expirado" de "inválido", então aqui também
  // não tentamos adivinhar, só mandamos logar de novo.
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      clearStoredPlatformToken();
      navigate("/plataforma/login", { replace: true });
    }
  }, [error, navigate]);

  function handleLogout() {
    clearStoredPlatformToken();
    navigate("/plataforma/login", { replace: true });
  }

  const rows: TenantUsageSummary[] = data ?? [];
  const atRiskCount = rows.filter((r) => r.engagement_status === "risco").length;

  return (
    <div className="min-h-screen bg-canvas px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck aria-hidden size={18} className="text-accent" />
            <h1 className="text-base font-semibold text-ink">Customer Success — uso por clínica</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="flex items-center gap-1.5">
            <LogOut size={13} />
            Sair
          </Button>
        </div>

        {atRiskCount > 0 && (
          <div className="rounded-md border border-denied/25 bg-denied-bg px-4 py-2.5 text-sm text-denied">
            {atRiskCount} {atRiskCount === 1 ? "clínica está" : "clínicas estão"} sem nenhuma atividade nos últimos 30 dias.
          </div>
        )}

        <Panel
          title="Clínicas"
          subtitle="Mais em risco primeiro — ver PlatformReportingService para a régua de classificação."
          action={
            <Button
              variant="secondary"
              size="sm"
              disabled={runAlertsMutation.isPending}
              onClick={() => runAlertsMutation.mutate()}
              className="flex items-center gap-1.5"
            >
              <BellRing size={13} />
              {runAlertsMutation.isPending ? "Verificando..." : "Verificar alertas agora"}
            </Button>
          }
        >
          {isLoading && <LoadingState />}
          {error && !(error instanceof ApiError && error.status === 401) && <ErrorState message={getApiErrorMessage(error)} />}
          {!isLoading && !error && rows.length === 0 && <EmptyState message="Nenhuma clínica cadastrada ainda." />}
          {!isLoading && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2.5 font-medium">Clínica</th>
                    <th className="px-4 py-2.5 font-medium">Plano</th>
                    <th className="px-4 py-2.5 font-medium">Cliente desde</th>
                    <th className="px-4 py-2.5 font-medium">Usuários ativos</th>
                    <th className="px-4 py-2.5 font-medium">Última atividade</th>
                    <th className="px-4 py-2.5 font-medium">Eventos (30d)</th>
                    <th className="px-4 py-2.5 font-medium">Pacientes</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.tenant_id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                      <td className="px-4 py-2.5 text-ink">{r.trade_name}</td>
                      <td className="px-4 py-2.5 text-ink-muted capitalize">{r.plan_tier}</td>
                      <td className="tabular px-4 py-2.5 font-mono text-ink-muted">{formatDate(r.tenant_created_at)}</td>
                      <td className="tabular px-4 py-2.5 text-ink-muted">{r.active_users}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{formatDaysAgo(r.days_since_last_activity)}</td>
                      <td className="tabular px-4 py-2.5 text-ink-muted">{r.events_last_30d}</td>
                      <td className="tabular px-4 py-2.5 text-ink-muted">{r.patients_total}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={STATUS_TONE[r.engagement_status]}>{STATUS_LABEL[r.engagement_status]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
