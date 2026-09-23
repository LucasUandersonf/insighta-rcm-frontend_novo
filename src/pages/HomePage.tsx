import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUp, ChevronDown, CheckCircle2, UploadCloud } from "lucide-react";
import { LoadingState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/components/dashboard/SmartInsightsFeed";
import { AssignModal, insightItemKey, toQueueItem, useInsightWorkflow } from "@/components/dashboard/InsightWorkflowActions";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { describeTrend } from "@/lib/narrative";
import { useAskInsighta } from "@/lib/useAskInsighta";
import { firstNameFrom, useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/cn";
import { useTeamOverview } from "@/lib/team";
import { TeamUpdatesStrip } from "@/components/team/TeamUpdatesStrip";
import type {
  BriefingEmailResult,
  ExecutiveNarrative,
  ExecutiveSummary,
  HealthScore,
  IngestionFileEntry,
  InsightCategory,
  InsightSeverity,
  NavigationSummary,
  PaginatedResponse,
  PayerOverview,
  PeriodKpi,
  RecoveredValue,
  SmartInsight,
  Tenant,
  TodayAgenda,
} from "@/lib/types";

/**
 * Home — "Briefing do dia" (canvas "Insighta RCM — Redesign 2026",
 * artboard "Início — briefing do dia"). Lê-se como uma página: tarja de
 * urgência, cabeçalho executivo, manchete (insight nº 1), panorama em
 * frases, "Também hoje", a agenda de hoje, boas notícias e "Ficou com
 * dúvida?". Todo número vem de uma rota real do backend — nenhum valor
 * de exemplo do canvas é reproduzido; um dado ausente some da tela.
 */

// Mesmo RBAC de /upload (ingestion.py/_CAN_MANAGE).
const _CAN_UPLOAD_ROLES = ["owner", "admin", "financeiro"];
// Mesmo RBAC de analytics.py/_CAN_VIEW.
const _CAN_VIEW_ANALYTICS = ["owner", "admin", "financeiro", "auditor"];
// Recarrega o briefing a cada 30 min (o rodapé promete a próxima leitura).
const REFRESH_MS = 30 * 60 * 1000;

const CATEGORY_LABELS: Record<InsightCategory, string> = {
  faturamento: "Faturamento",
  agenda: "Agenda",
  estoque: "Estoque",
  prontuario: "Prontuário",
  estrategia: "Estratégia",
};

const SEVERITY_TONE: Record<InsightSeverity, { text: string; dropCap: string }> = {
  critical: { text: "text-denied", dropCap: "first-letter:text-denied" },
  warning: { text: "text-pending", dropCap: "first-letter:text-pending" },
  positive: { text: "text-revenue", dropCap: "first-letter:text-revenue" },
  comparativo: { text: "text-tier1", dropCap: "first-letter:text-tier1" },
};

const AGENDA_DOT: Record<TodayAgenda["periods"][number]["tone"], string> = {
  positive: "text-revenue",
  warning: "text-pending",
  critical: "text-denied",
  neutral: "text-ink-soft",
};

/** "Comparar com:" do cabeçalho — define a janela do panorama. */
const COMPARE_OPTIONS = [
  { id: "ontem", label: "ontem", days: 1, panorama: "hoje" },
  { id: "semana", label: "semana anterior", days: 7, panorama: "últimos 7 dias" },
  { id: "mes", label: "mês anterior", days: 30, panorama: "últimos 30 dias" },
] as const;
type CompareId = (typeof COMPARE_OPTIONS)[number]["id"];

const compactCurrency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function windowFor(days: number, offsetDays = 0): { from: string; to: string } {
  const end = new Date();
  end.setDate(end.getDate() - offsetDays);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

/**
 * Uma rota real ("/...") navega direto; destino "#..." vira query string
 * que a Sala de Comando resolve na montagem (ver ExecutiveOverviewPage).
 */
function resolveHref(href: string): string {
  if (href.startsWith("/")) return href;
  if (href.startsWith("#tab:")) return `/decisao?tab=${href.slice("#tab:".length)}`;
  if (href.startsWith("#weekday:")) return `/decisao?weekday=${href.slice("#weekday:".length)}&scrollTo=agenda-resumo`;
  if (href.startsWith("#professional:")) return `/decisao?professional=${href.slice("#professional:".length)}&scrollTo=agenda-resumo`;
  if (href.startsWith("#")) return `/decisao?scrollTo=${href.slice(1)}`;
  return "/decisao";
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function FirstRunWizard({ canUpload }: { canUpload: boolean }) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col items-start gap-3 rounded-[20px] border border-accent/25 bg-accent-bg p-6"
    >
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas-surface/70 text-accent">
        <UploadCloud size={18} strokeWidth={2} />
      </span>
      <div>
        <p className="text-[15px] font-medium text-ink">Vamos começar? Sua clínica ainda não tem nenhum dado importado.</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          {canUpload
            ? "Suba sua agenda, faturamento ou tabela de convênio na Central de Upload — é o primeiro passo para a Sala de Comando começar a gerar insights de verdade."
            : "Peça para o owner, administrador(a) ou financeiro da clínica subir os primeiros dados na Central de Upload — depois disso, esta tela passa a mostrar as prioridades reais do dia."}
        </p>
      </div>
      {canUpload && (
        <Button type="button" onClick={() => navigate("/upload")} className="inline-flex items-center gap-1.5">
          Ir para Central de Upload
          <ArrowRight aria-hidden size={13} />
        </Button>
      )}
    </motion.div>
  );
}

function Kicker({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("text-xs font-bold uppercase tracking-[0.12em]", className)}>{children}</span>;
}

function Rule({ strong = false }: { strong?: boolean }) {
  return <div aria-hidden className={cn("h-px", strong ? "bg-ink/35" : "bg-border-hairline")} />;
}

function Headline({ insight, onAssign, canAssign }: { insight: SmartInsight; onAssign: () => void; canAssign: boolean }) {
  const navigate = useNavigate();
  const tone = SEVERITY_TONE[insight.severity];
  return (
    <article className="flex flex-col gap-[18px] lg:pr-12">
      <Kicker className={tone.text}>Manchete · {CATEGORY_LABELS[insight.category] ?? "Destaque"}</Kicker>
      <h2 className="font-serif text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] text-ink sm:text-[44px] xl:text-[54px]">
        {insight.title}
      </h2>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <p
          className={cn(
            "font-serif text-[19px] leading-[1.6] text-ink",
            "first-letter:float-left first-letter:mr-2.5 first-letter:mt-1.5 first-letter:text-[62px] first-letter:font-semibold first-letter:leading-[0.9]",
            tone.dropCap
          )}
        >
          {insight.message}
        </p>
        <p className="font-serif text-[19px] leading-[1.6] text-ink-soft">
          {impactSentence(insight)}
          {insight.why_now} {insight.what_to_do}
        </p>
      </div>
      {(insight.evidence || insight.track_record) && (
        <p className="text-xs leading-relaxed text-ink-faint">
          {insight.evidence}
          {insight.evidence && insight.track_record ? " · " : ""}
          {insight.track_record}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-5 pt-1.5">
        {insight.action_href && (
          <Button
            type="button"
            title={insight.action_label ?? undefined}
            onClick={() => navigate(resolveHref(insight.action_href!))}
            className="inline-flex h-11 items-center gap-2 text-sm"
          >
            Resolver agora
            <ArrowRight aria-hidden size={14} />
          </Button>
        )}
        <span className="text-[13px] text-ink-muted">
          {insight.estimated_minutes ? `Leva cerca de ${insight.estimated_minutes} minutos` : "Veja os casos na Sala de Comando"}
          {canAssign && (
            <>
              {" · "}
              <button type="button" onClick={onAssign} className="text-ink-muted underline underline-offset-2 hover:text-ink">
                atribuir a alguém
              </button>
            </>
          )}
        </span>
      </div>
    </article>
  );
}

/** "Nota 9": a frase do valor respeita o que ele é — perda, referência ou ganho. */
function impactSentence(insight: SmartInsight): string {
  if (insight.financial_impact === null) return "";
  const value = formatCurrency(insight.financial_impact);
  if (insight.impact_kind === "ganho") return `São ${value} a seu favor. `;
  if (insight.impact_kind === "referencia") return `Envolve ${value}. `;
  return `São ${value} em jogo. `;
}

function CalmHeadline() {
  return (
    <article className="flex flex-col gap-[18px] lg:pr-12">
      <Kicker className="text-revenue">Manchete · Dia tranquilo</Kicker>
      <h2 className="font-serif text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] text-ink sm:text-[44px] xl:text-[54px]">
        Nada pegando fogo hoje. Bom dia para adiantar o que costuma ficar para depois.
      </h2>
      <p className="font-serif text-[21px] leading-[1.55] text-ink-soft">Nenhuma prioridade urgente agora — tudo dentro do esperado.</p>
      <Link to="/decisao?tab=agenda" className="self-start text-[15px] font-medium text-accent-muted hover:underline">
        Ver a fila de reativação →
      </Link>
    </article>
  );
}

function SecondaryStory({ insight }: { insight: SmartInsight }) {
  const navigate = useNavigate();
  const tone = SEVERITY_TONE[insight.severity];
  return (
    <article className="flex flex-col gap-3">
      <Kicker className={cn("text-[11px]", tone.text)}>Também hoje · {CATEGORY_LABELS[insight.category] ?? "Destaque"}</Kicker>
      <h3 className="font-serif text-[26px] font-semibold leading-[1.2] text-ink">{insight.title}</h3>
      <p className="text-[15px] leading-[1.6] text-ink-soft">
        {insight.message}
        {insight.financial_impact !== null && <> {impactSentence(insight).trim()}</>}
      </p>
      {insight.action_label && insight.action_href && (
        <button
          type="button"
          onClick={() => navigate(resolveHref(insight.action_href!))}
          className={cn("inline-flex items-center gap-1.5 self-start text-sm font-medium hover:underline", tone.text)}
        >
          {insight.action_label} →
        </button>
      )}
    </article>
  );
}

interface PanoramaRow {
  label: string;
  value: string;
  delta: string;
  favorable: boolean | null;
  read: string;
}

function kpiDelta(kpi: PeriodKpi, higherIsBetter: boolean): { delta: string; favorable: boolean | null } {
  if (kpi.delta_pct === null) return { delta: "—", favorable: null };
  if (Math.abs(kpi.delta_pct) < 0.5) return { delta: "=", favorable: null };
  const arrow = kpi.delta_pct > 0 ? "▲" : "▼";
  return {
    delta: `${arrow} ${Math.abs(kpi.delta_pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
    favorable: higherIsBetter ? kpi.delta_pct > 0 : kpi.delta_pct < 0,
  };
}

function Panorama({ rows, windowLabel }: { rows: PanoramaRow[]; windowLabel: string }) {
  return (
    <aside aria-labelledby="panorama" className="flex flex-col lg:border-l lg:border-border-hairline lg:pl-9">
      <h2 id="panorama" className="mb-2.5 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">
        O panorama · {windowLabel}
      </h2>
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-1.5 border-b border-border-hairline py-3.5">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[13px] text-ink-muted">{row.label}</span>
            <span className="tabular ml-auto text-xl font-semibold tracking-[-0.01em] text-ink">{row.value}</span>
            <span
              className={cn(
                "min-w-[52px] text-right text-xs font-semibold",
                row.favorable === null ? "text-ink-muted" : row.favorable ? "text-revenue" : "text-denied"
              )}
            >
              {row.delta}
            </span>
          </div>
          <span className="text-[13px] leading-[1.45] text-ink-soft">{row.read}</span>
        </div>
      ))}
      <Link to="/decisao" className="mt-3 text-[13px] font-medium text-accent-muted hover:underline">
        Todos os números na Sala de Comando →
      </Link>
    </aside>
  );
}

function SeverityChips({ critical, warning, positive }: { critical: number; warning: number; positive: number }) {
  const chips = [
    { count: critical, label: critical === 1 ? "crítico" : "críticos", cls: "border-denied/25 bg-denied/10 text-denied", dot: "bg-denied" },
    { count: warning, label: "atenção", cls: "border-pending/25 bg-pending/10 text-pending", dot: "bg-pending" },
    { count: positive, label: positive === 1 ? "positivo" : "positivos", cls: "border-revenue/20 bg-revenue/10 text-revenue", dot: "bg-revenue" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span key={chip.label} className={cn("flex h-[30px] items-center gap-2 rounded-lg border px-3 text-xs", chip.cls)}>
          <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", chip.dot)} />
          {chip.count} {chip.label}
        </span>
      ))}
    </div>
  );
}

function CompareSelect({ value, onChange }: { value: CompareId; onChange: (id: CompareId) => void }) {
  const current = COMPARE_OPTIONS.find((o) => o.id === value)!;
  return (
    <label className="relative flex h-[38px] cursor-pointer items-center gap-2 rounded-[11px] border border-border-hairline bg-canvas-raised/40 px-3.5 text-[13px] text-ink">
      <span>Comparar com: {current.label}</span>
      <ChevronDown aria-hidden size={14} className="text-ink-muted" />
      <select
        aria-label="Comparar com"
        value={value}
        onChange={(e) => onChange(e.target.value as CompareId)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {COMPARE_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AskBox() {
  const [question, setQuestion] = useState("");
  const ask = useAskInsighta();
  function submit(e: FormEvent) {
    e.preventDefault();
    if (question.trim().length >= 3) ask.mutate(question.trim());
  }
  return (
    <aside aria-labelledby="pergunta" className="flex flex-col gap-3">
      <h2 id="pergunta" className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-muted">
        Ficou com dúvida?
      </h2>
      <p className="text-sm leading-normal text-ink-soft">Pergunte sobre qualquer notícia desta edição.</p>
      <form onSubmit={submit} className="flex h-11 items-center gap-2.5 rounded-xl border border-border-default bg-canvas-raised/40 pl-3.5 pr-2">
        <input
          type="text"
          aria-label="Sua pergunta"
          placeholder="Por que a glosa subiu este mês?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        <button
          type="submit"
          aria-label="Enviar pergunta"
          disabled={ask.isPending}
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-brand text-white disabled:opacity-60"
        >
          <ArrowUp aria-hidden size={13} strokeWidth={2.4} />
        </button>
      </form>
      {(ask.isPending || ask.data || ask.error) && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5 text-sm leading-relaxed">
          {ask.isPending && <p className="text-ink-muted">Consultando os números da clínica…</p>}
          {ask.data && (
            <>
              <p className="text-ink">{ask.data.answer}</p>
              <p className="text-xs text-ink-faint">{ask.data.sources}</p>
            </>
          )}
          {ask.error && <p className="text-denied">{getApiErrorMessage(ask.error)}</p>}
        </div>
      )}
    </aside>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const { data: profile } = useCurrentUserProfile();
  const workflow = useInsightWorkflow();
  const isManager = !!user && ["owner", "admin", "auditor"].includes(user.role);
  const canManageTeam = !!user && ["owner", "admin"].includes(user.role);
  const { data: teamOverview } = useTeamOverview(isManager);
  const canViewAnalytics = !!user && _CAN_VIEW_ANALYTICS.includes(user.role);
  const canUpload = !!user && _CAN_UPLOAD_ROLES.includes(user.role);
  const [compare, setCompare] = useState<CompareId>("mes");
  const compareOption = COMPARE_OPTIONS.find((o) => o.id === compare)!;
  const current = windowFor(compareOption.days);
  const previous = windowFor(compareOption.days, compareOption.days);

  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "executive-narrative"],
    queryFn: () => apiClient.get<ExecutiveNarrative>("/api/v1/analytics/executive-narrative"),
    retry: false,
    refetchInterval: REFRESH_MS,
  });
  const { data: ingestionHistory, isLoading: isLoadingIngestion } = useQuery({
    queryKey: ["ingestion-files", "first-run-check"],
    queryFn: () => apiClient.get<PaginatedResponse<IngestionFileEntry>>("/api/v1/ingestion/files?limit=1&offset=0"),
  });
  const { data: tenant } = useQuery({ queryKey: ["tenant"], queryFn: () => apiClient.get<Tenant>("/api/v1/tenant"), retry: false });
  const { data: nav } = useQuery({
    queryKey: ["analytics", "navigation-summary"],
    queryFn: () => apiClient.get<NavigationSummary>("/api/v1/analytics/navigation-summary"),
    retry: false,
  });
  const { data: summary } = useQuery({
    queryKey: ["analytics", "executive-summary", current.from, current.to],
    queryFn: () => apiClient.get<ExecutiveSummary>(`/api/v1/analytics/executive-summary?date_from=${current.from}&date_to=${current.to}`),
    enabled: canViewAnalytics,
    retry: false,
  });
  const { data: payers } = useQuery({
    queryKey: ["analytics", "payer-overview", current.from, current.to],
    queryFn: () => apiClient.get<PayerOverview>(`/api/v1/analytics/payer-overview?date_from=${current.from}&date_to=${current.to}`),
    enabled: canViewAnalytics,
    retry: false,
  });
  const { data: previousPayers } = useQuery({
    queryKey: ["analytics", "payer-overview", previous.from, previous.to],
    queryFn: () => apiClient.get<PayerOverview>(`/api/v1/analytics/payer-overview?date_from=${previous.from}&date_to=${previous.to}`),
    enabled: canViewAnalytics,
    retry: false,
  });
  const { data: health } = useQuery({
    queryKey: ["analytics", "health-score"],
    queryFn: () => apiClient.get<HealthScore>("/api/v1/analytics/health-score"),
    enabled: canViewAnalytics,
    retry: false,
  });
  const { data: agenda } = useQuery({
    queryKey: ["analytics", "today-agenda"],
    queryFn: () => apiClient.get<TodayAgenda>("/api/v1/analytics/today-agenda"),
    enabled: canViewAnalytics,
    retry: false,
    refetchInterval: REFRESH_MS,
  });
  const { data: recovered } = useQuery({
    queryKey: ["analytics", "recovered-value"],
    queryFn: () => apiClient.get<RecoveredValue>("/api/v1/analytics/recovered-value"),
    enabled: canViewAnalytics,
    retry: false,
  });
  const emailBriefing = useMutation({
    mutationFn: () => apiClient.post<BriefingEmailResult>("/api/v1/analytics/briefing/email", {}),
    onSuccess: (result) =>
      result.delivered
        ? showSuccess(`Briefing enviado para ${result.sent_to}.`)
        : showSuccess(`Briefing gerado para ${result.sent_to} — o envio de e-mail ainda não está configurado neste ambiente.`),
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const priorities = data?.top_priorities ?? [];
  const recentlyResolved = data?.recently_resolved ?? [];
  const firstName = profile ? firstNameFrom(profile.full_name) : null;
  const isFirstRun = !isLoadingIngestion && ingestionHistory?.total === 0;
  const [headline, ...others] = priorities;
  const secondary = others.slice(0, 2);

  // ---- panorama (5 linhas do canvas) ----
  const rows: PanoramaRow[] = [];
  if (summary) {
    rows.push({
      label: "Faturado",
      value: compactCurrency.format(summary.total_billed.value),
      ...kpiDelta(summary.total_billed, true),
      read: describeTrend("o faturamento", summary.total_billed.value, summary.total_billed.delta_pct, { shape: "currency" }),
    });
  }
  if (payers) {
    const prev = previousPayers?.total_denied ?? null;
    const deltaPct = prev ? ((payers.total_denied - prev) / prev) * 100 : null;
    const topDenied = [...payers.rows].sort((a, b) => b.denied_value - a.denied_value)[0];
    const topShare = topDenied && payers.total_denied > 0 ? (topDenied.denied_value / payers.total_denied) * 100 : 0;
    rows.push({
      label: "Glosado",
      value: compactCurrency.format(payers.total_denied),
      ...kpiDelta({ value: payers.total_denied, previous_value: prev ?? 0, delta_pct: deltaPct }, false),
      read:
        payers.total_denied === 0
          ? "Nenhuma recusa de convênio no período."
          : topShare >= 40
            ? `${Math.round(topShare)}% disso vem de um só convênio: ${topDenied.name}.`
            : describeTrend("o valor glosado", payers.total_denied, deltaPct, { shape: "currency" }),
    });
  }
  if (summary?.avg_days_to_receive) {
    const kpi = summary.avg_days_to_receive;
    const slow = payers?.verdicts.find((v) => v.kind === "slowest");
    rows.push({
      label: "Recebido no prazo",
      value: `${kpi.value.toFixed(0)} dias`,
      ...kpiDelta(kpi, false),
      read: slow ? `${describeTrend("o prazo médio", kpi.value, kpi.delta_pct, { shape: "duration" })} Só ${slow.name} continua lento.` : describeTrend("o prazo médio", kpi.value, kpi.delta_pct, { shape: "duration" }),
    });
  }
  if (summary?.avg_capacity_utilization) {
    const kpi = summary.avg_capacity_utilization;
    rows.push({
      label: "Agenda ocupada",
      value: `${(kpi.value * 100).toFixed(0)}%`,
      ...kpiDelta(kpi, true),
      read: `${(100 - kpi.value * 100).toFixed(0)}% da grade ficou vaga no período.`,
    });
  }
  if (health?.score !== null && health?.score !== undefined) {
    const trend = health.trend;
    rows.push({
      label: "Saúde do faturamento",
      value: `${Math.round(health.score)}/100`,
      delta: trend ? `${trend.delta >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(trend.delta))}` : "—",
      favorable: trend ? trend.delta >= 0 : null,
      read: trend
        ? `${trend.delta >= 0 ? "Subiu" : "Caiu"} ${Math.abs(Math.round(trend.delta))} pontos desde ${new Date(trend.reference_month).toLocaleDateString("pt-BR", { month: "long" })}.`
        : "Nota combinando glosa, faltas e recursos dos últimos meses.",
    });
  }

  // ---- boas notícias ----
  const goodNews = rows.filter((row) => row.favorable === true && row.label !== "Saúde do faturamento").slice(0, 2);
  const goodItems: { value: string; text: string }[] = goodNews.map((row) => ({ value: row.value, text: row.read }));
  if (recovered && recovered.total > 0) {
    goodItems.push({ value: formatCurrency(recovered.total), text: "recuperados este mês com decisões que você tomou aqui." });
  }
  for (const title of recentlyResolved) {
    if (goodItems.length >= 3) break;
    goodItems.push({ value: "Resolvido", text: title });
  }

  const critical = priorities.filter((p) => p.severity === "critical").length;
  const warning = priorities.filter((p) => p.severity === "warning").length;
  const positive = priorities.filter((p) => p.severity === "positive" || p.severity === "comparativo").length + goodItems.length;

  const now = new Date();
  const dateLine = capitalize(now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  const updatedAt = data?.generated_at ? new Date(data.generated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
  const nextUpdate = new Date(now.getTime() + REFRESH_MS).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const countsSentence = `${plural(critical, "ponto crítico", "pontos críticos")}, ${warning} de atenção e ${plural(positive, "boa notícia", "boas notícias")} desde ontem.`;
  const subtitle = isFirstRun
    ? "Sua clínica ainda não tem dado importado — vamos resolver isso."
    : error
      ? "Bem-vindo de volta. Os números de hoje já estão prontos na Sala de Comando."
      : priorities.length === 0
        ? "Tudo tranquilo por aqui — nada precisou da sua atenção nesta janela."
        : "Aqui está o resumo de hoje — confira as prioridades abaixo.";

  const urgentText =
    nav?.urgent?.text ??
    (summary?.appeals_due_soon_count
      ? `${plural(summary.appeals_due_soon_count, "recurso de glosa está", "recursos de glosa estão")} com o prazo vencendo ou já vencido.`
      : null);

  return (
    <div className="flex flex-col">
      <div className="-mt-8 mb-2 flex flex-col">
      {urgentText && (
        <div role="status" className="-mx-4 flex flex-wrap items-center gap-3.5 border-b border-denied/20 bg-denied/[0.09] px-4 py-2.5 sm:-mx-8 sm:px-8">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-denied">
            <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-denied" />
            Urgente
          </span>
          <span className="text-sm text-ink">{urgentText}</span>
          <Link to={nav?.urgent?.action_href ?? "/denial-appeals"} className="ml-auto text-[13px] font-medium text-denied hover:underline">
            {nav?.urgent?.action_label ?? "Abrir recurso"} →
          </Link>
        </div>
      )}
      {/* Equipe (Redesign 2026): "quando a situação é resolvida, o gestor
          recebe o aviso na tela de Home" — resolvida, devolvida,
          confirmada pelos dados ou que voltou. */}
      {isManager && <TeamUpdatesStrip updates={Array.isArray(teamOverview?.updates) ? teamOverview.updates : []} canAcknowledge={canManageTeam} max={3} />}
      </div>

      {/* Cabeçalho executivo */}
      <header className="flex flex-col gap-6 border-b border-border-hairline pb-7 pt-4 lg:flex-row lg:items-end">
        <div className="flex max-w-4xl flex-col gap-2">
          <span className="flex flex-wrap items-center gap-2.5 text-xs font-medium text-ink-faint">
            <span className="font-semibold uppercase tracking-[0.08em] text-accent-muted">Briefing do dia</span>
            <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-ink-faint" />
            {dateLine}
            {updatedAt && (
              <>
                <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-ink-faint" />
                Atualizado às {updatedAt}
              </>
            )}
          </span>
          <h1 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink sm:text-4xl">
            {timeOfDayGreeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          {isLoading || isLoadingIngestion ? (
            <LoadingState rows={2} />
          ) : (
            <>
              <p className="text-[15px] leading-relaxed text-ink-muted">
                {!isFirstRun && !error ? `Resumo de ${tenant?.trade_name ?? "sua clínica"}: ${countsSentence}` : subtitle}
              </p>
              {!isFirstRun && !error && (
                <p className="max-w-3xl text-[15px] leading-relaxed text-ink-soft">{data?.narrative ?? subtitle}</p>
              )}
            </>
          )}
        </div>
        {!isFirstRun && !isLoading && (
          <div className="flex flex-col gap-3.5 lg:ml-auto lg:items-end">
            <SeverityChips critical={critical} warning={warning} positive={positive} />
            {canViewAnalytics && (
              <div className="flex flex-wrap gap-2.5">
                <CompareSelect value={compare} onChange={setCompare} />
                <Button type="button" variant="secondary" onClick={() => emailBriefing.mutate()} disabled={emailBriefing.isPending} className="inline-flex h-[38px] items-center gap-2">
                  <ArrowUp aria-hidden size={14} className="rotate-45" />
                  Enviar por e-mail
                </Button>
              </div>
            )}
          </div>
        )}
      </header>

      {isFirstRun ? (
        <div className="py-9">
          <FirstRunWizard canUpload={canUpload} />
        </div>
      ) : isLoading ? null : (
        <>
          {/* Manchete + panorama */}
          <div className={cn("grid grid-cols-1 gap-10 py-9", rows.length > 0 && "lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-0")}>
            {headline ? (
              <Headline
                insight={headline}
                canAssign={workflow.canManage && !workflow.actionedKeys[insightItemKey(headline)]}
                onAssign={() => workflow.setAssigningItem(toQueueItem(headline))}
              />
            ) : (
              <CalmHeadline />
            )}
            {rows.length > 0 && <Panorama rows={rows} windowLabel={compareOption.panorama} />}
          </div>

          <Rule strong />

          {/* Também hoje + a agenda de hoje */}
          {(secondary.length > 0 || agenda) && (
            <>
              <div className="grid grid-cols-1 gap-8 py-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-border-hairline">
                {secondary.map((insight, index) => (
                  <div key={insight.title} className={cn(index === 0 ? "md:pr-8" : "md:px-8")}>
                    <SecondaryStory insight={insight} />
                  </div>
                ))}
                {agenda && (
                  <aside
                    aria-labelledby="agenda-de-hoje"
                    className={cn("flex flex-col gap-3", secondary.length > 0 && "md:pl-8", secondary.length === 0 && "md:col-span-3", secondary.length === 1 && "md:col-span-2")}
                  >
                    <h3 id="agenda-de-hoje" className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                      A agenda de hoje
                    </h3>
                    <p className="font-serif text-[22px] leading-[1.35] text-ink">{agenda.headline}</p>
                    <div className="flex flex-col gap-2.5">
                      {agenda.periods.map((period) => (
                        <div key={period.label} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 text-sm leading-normal">
                          <span className="tabular text-ink-faint">{period.label}</span>
                          <span className="text-ink-soft">
                            {period.text}{" "}
                            {period.action_label && period.action_href && (
                              <Link to={period.action_href} className={cn("hover:underline", AGENDA_DOT[period.tone])}>
                                {period.action_label}
                              </Link>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </aside>
                )}
              </div>
              <Rule strong />
            </>
          )}

          {/* Boas notícias + Ficou com dúvida? */}
          <div className="grid grid-cols-1 gap-8 py-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-0">
            <section aria-labelledby="boas-noticias" className="flex flex-col gap-4 lg:pr-8">
              <h2 id="boas-noticias" className="text-[11px] font-bold uppercase tracking-[0.12em] text-revenue">
                Boas notícias
              </h2>
              {goodItems.length > 0 ? (
                <div className="grid grid-cols-1 gap-7 sm:grid-cols-3">
                  {goodItems.map((item) => (
                    <div key={item.text} className="flex flex-col gap-2">
                      <span className="flex items-center gap-2 font-serif text-[30px] font-semibold text-revenue">
                        {item.value === "Resolvido" && <CheckCircle2 aria-hidden size={22} />}
                        {item.value}
                      </span>
                      <span className="text-sm leading-[1.55] text-ink-soft">{item.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-muted">Nenhum indicador melhorou nesta janela ainda — as boas notícias aparecem aqui assim que surgirem.</p>
              )}
            </section>
            {canViewAnalytics && (
              <div className="lg:border-l lg:border-border-hairline lg:pl-8">
                <AskBox />
              </div>
            )}
          </div>

          <Rule strong />
          <footer className="flex flex-wrap items-center gap-4 pt-5 text-[13px] text-ink-faint">
            <span>Próxima atualização às {nextUpdate}, ou antes se algo urgente aparecer.</span>
            {canViewAnalytics && (
              <Link to="/decisao" className="ml-auto font-medium text-accent-muted hover:underline">
                Ir para a Sala de Comando →
              </Link>
            )}
          </footer>
        </>
      )}

      <AssignModal
        item={workflow.assigningItem}
        onClose={() => workflow.setAssigningItem(null)}
        onAssigned={(item) => workflow.setActionedKeys((prev) => ({ ...prev, [insightItemKey(item)]: "atribuido" }))}
      />
    </div>
  );
}
