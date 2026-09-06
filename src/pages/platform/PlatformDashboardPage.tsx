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
import type { FeatureUsageKey, PlatformAlertRunResult, PlatformAuditLogEntry, TenantEngagementStatus, TenantUsageSummary } from "@/lib/types";

const ACTION_LABEL: Record<string, string> = {
  login: "Entrou no painel",
  alerts_run: "Verificou alertas manualmente",
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

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

// Mesmas 6 chaves de app/sql/030_platform_feature_usage.sql — mede
// MUTAÇÃO (ação real de escrita), não navegação/leitura de tela.
const FEATURE_LABEL: Record<FeatureUsageKey, string> = {
  pacientes: "Pacientes",
  agenda: "Agenda",
  faturamento: "Faturamento",
  recurso_de_glosa: "Recurso de glosa",
  contratos: "Contratos",
  usuarios: "Usuários",
};
const FEATURE_KEYS = Object.keys(FEATURE_LABEL) as FeatureUsageKey[];

/** "Mais usa" de uma clínica: os 1-2 recursos com mais mutação nos
 * últimos 30 dias, ou "—" quando não há nenhuma (clínica nova/inativa). */
function topFeatureSummary(usage: Record<FeatureUsageKey, number>): string {
  const entries = FEATURE_KEYS.map((key) => [key, usage[key] ?? 0] as const).filter(([, count]) => count > 0);
  entries.sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "—";
  return entries.slice(0, 2).map(([key, count]) => `${FEATURE_LABEL[key]} (${count})`).join(", ");
}

/** Soma feature_usage_last_30d de TODAS as clínicas — o ranking "o que a
 * base inteira mais usa", o sinal mais direto para priorização de
 * backlog (ver Laudo de Vistoria Técnica, parecer PM/PO). */
function aggregateFeatureUsage(rows: TenantUsageSummary[]): (readonly [FeatureUsageKey, number])[] {
  const totals = Object.fromEntries(FEATURE_KEYS.map((key) => [key, 0])) as Record<FeatureUsageKey, number>;
  for (const row of rows) {
    for (const key of FEATURE_KEYS) totals[key] += row.feature_usage_last_30d[key] ?? 0;
  }
  return FEATURE_KEYS.map((key) => [key, totals[key]] as const).sort((a, b) => b[1] - a[1]);
}

export function PlatformDashboardPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["platform", "tenants-usage"],
    queryFn: () => platformApiClient.getTenantsUsage(),
    retry: false,
  });

  const { data: auditLog, refetch: refetchAuditLog } = useQuery({
    queryKey: ["platform", "audit-log"],
    queryFn: () => platformApiClient.getAuditLog(),
    retry: false,
    enabled: !(error instanceof ApiError && error.status === 401),
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
      refetchAuditLog();
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
  const auditRows: PlatformAuditLogEntry[] = auditLog ?? [];
  const featureRanking = aggregateFeatureUsage(rows);
  const maxFeatureCount = Math.max(1, ...featureRanking.map(([, count]) => count));

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

        {!isLoading && rows.length > 0 && (
          <Panel
            title="Recursos mais usados na plataforma"
            subtitle="Soma de todas as clínicas nos últimos 30 dias — mede mutação (ação real), não navegação. Usar para priorizar backlog."
          >
            <ul className="space-y-2.5">
              {featureRanking.map(([key, count]) => (
                <li key={key} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-xs text-ink-muted">{FEATURE_LABEL[key]}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-canvas-inset">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(2, (count / maxFeatureCount) * 100)}%` }}
                    />
                  </span>
                  <span className="tabular w-10 shrink-0 text-right text-xs font-medium text-ink">{count}</span>
                </li>
              ))}
            </ul>
          </Panel>
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
                    <th className="px-4 py-2.5 font-medium">Mais usa (30d)</th>
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
                      <td className="px-4 py-2.5 text-ink-muted">{topFeatureSummary(r.feature_usage_last_30d)}</td>
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

        {auditRows.length > 0 && (
          <Panel title="Histórico" subtitle="Quem fez o quê neste painel — login individual, ver core.platform_audit_log.">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2.5 font-medium">Quem</th>
                    <th className="px-4 py-2.5 font-medium">Ação</th>
                    <th className="px-4 py-2.5 font-medium">Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRows.map((entry) => (
                    <tr key={entry.id} className="border-b border-border-hairline last:border-0">
                      <td className="px-4 py-2.5 text-ink">{entry.actor_email}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{ACTION_LABEL[entry.action] ?? entry.action}</td>
                      <td className="tabular px-4 py-2.5 font-mono text-ink-muted">{formatDateTime(entry.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
