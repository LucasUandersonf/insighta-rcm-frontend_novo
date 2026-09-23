import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, CheckCircle2, UploadCloud } from "lucide-react";
import { LoadingState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/components/dashboard/SmartInsightsFeed";
import { apiClient } from "@/lib/api-client";
import { describeTrend } from "@/lib/narrative";
import { firstNameFrom, useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import { useDateWindow } from "@/lib/useDateWindow";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/cn";
import type {
  DailySummary,
  ExecutiveNarrative,
  ExecutiveSummary,
  IngestionFileEntry,
  InsightCategory,
  InsightSeverity,
  PaginatedResponse,
  PeriodKpi,
  SmartInsight,
  Tenant,
} from "@/lib/types";

// Achado ALTO da Auditoria de Prontidão v1 ("sem wizard de tenant novo"):
// mesmo RBAC de /upload (ingestion.py/_CAN_MANAGE) — quem não pode subir
// dado (atendimento/auditor) recebe uma mensagem diferente, pedindo pra
// avisar quem pode, em vez de um botão que levaria a uma tela 403.
const _CAN_UPLOAD_ROLES = ["owner", "admin", "financeiro"];
// Mesmo RBAC de analytics.py/_CAN_VIEW — o panorama e o resumo do dia só
// são buscados para quem o backend deixaria ler (sem 403 à toa).
const _CAN_VIEW_ANALYTICS = ["owner", "admin", "financeiro", "auditor"];

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

/**
 * DECISÃO — a Home não tem abas nem seções locais como a Sala de Comando
 * (ver InsightActionButton em SmartInsightsFeed.tsx, que interpreta
 * "#tab:"/"#weekday:"/"#professional:"/"#id" DENTRO da própria tela). Uma
 * rota real ("/...") navega direto; qualquer destino "#..." vira uma
 * query string que a Sala de Comando lê na montagem (ver DECISÃO em
 * ExecutiveOverviewPage.tsx) e resolve pro mesmo lugar que resolveria se
 * o clique tivesse acontecido lá dentro.
 */
function resolveHref(href: string): string {
  if (href.startsWith("/")) return href;
  if (href.startsWith("#tab:")) return `/decisao?tab=${href.slice("#tab:".length)}`;
  if (href.startsWith("#weekday:")) return `/decisao?weekday=${href.slice("#weekday:".length)}&scrollTo=agenda-resumo`;
  if (href.startsWith("#professional:")) return `/decisao?professional=${href.slice("#professional:".length)}&scrollTo=agenda-resumo`;
  if (href.startsWith("#")) return `/decisao?scrollTo=${href.slice(1)}`;
  return "/decisao";
}

/**
 * Achado ALTO da Auditoria de Prontidão v1: uma clínica nova (nenhum
 * arquivo importado) precisa saber "por onde eu começo", não ver "tudo
 * tranquilo". Mesmo sinal de UploadCenterPage (GET /ingestion/files).
 */
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

function Headline({ insight }: { insight: SmartInsight }) {
  const navigate = useNavigate();
  const tone = SEVERITY_TONE[insight.severity];
  return (
    <article className="flex flex-col gap-[18px]">
      <Kicker className={tone.text}>Manchete · {CATEGORY_LABELS[insight.category] ?? "Destaque"}</Kicker>
      <h2 className="font-serif text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] text-ink sm:text-[44px] xl:text-[54px]">
        {insight.title}
      </h2>
      <p
        className={cn(
          "max-w-3xl font-serif text-[19px] leading-[1.6] text-ink",
          "first-letter:float-left first-letter:mr-2.5 first-letter:mt-1.5 first-letter:text-[62px] first-letter:font-semibold first-letter:leading-[0.9]",
          tone.dropCap
        )}
      >
        {insight.message}
      </p>
      {insight.financial_impact !== null && (
        <p className="font-serif text-[19px] leading-[1.6] text-ink-soft">
          São <span className={cn("font-semibold", tone.text)}>{formatCurrency(insight.financial_impact)}</span> em jogo.
        </p>
      )}
      {insight.action_label && insight.action_href && (
        <div className="flex flex-wrap items-center gap-5 pt-1.5">
          <Button
            type="button"
            onClick={() => navigate(resolveHref(insight.action_href!))}
            className="inline-flex h-11 items-center gap-2 text-sm"
          >
            {insight.action_label}
            <ArrowRight aria-hidden size={14} />
          </Button>
        </div>
      )}
    </article>
  );
}

function CalmHeadline() {
  return (
    <article className="flex flex-col gap-[18px]">
      <Kicker className="text-revenue">Manchete · Dia tranquilo</Kicker>
      <h2 className="font-serif text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] text-ink sm:text-[44px] xl:text-[54px]">
        Nada pegando fogo hoje.
      </h2>
      <p className="max-w-3xl font-serif text-[21px] leading-[1.55] text-ink-soft">
        Nenhuma prioridade urgente agora — tudo dentro do esperado.
      </p>
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
        {insight.financial_impact !== null && <> Impacto estimado: {formatCurrency(insight.financial_impact)}.</>}
      </p>
      {insight.action_label && insight.action_href && (
        <button
          type="button"
          onClick={() => navigate(resolveHref(insight.action_href!))}
          className={cn("inline-flex items-center gap-1.5 self-start text-sm font-medium hover:underline", tone.text)}
        >
          {insight.action_label}
          <ArrowRight aria-hidden size={13} />
        </button>
      )}
    </article>
  );
}

interface PanoramaRow {
  label: string;
  value: string;
  kpi: PeriodKpi;
  /** true = subir é bom (faturamento); false = cair é bom (buraco, prazo). */
  higherIsBetter: boolean;
  read: string;
}

function deltaLabel(kpi: PeriodKpi): string {
  if (kpi.delta_pct === null) return "—";
  if (Math.abs(kpi.delta_pct) < 0.5) return "=";
  const arrow = kpi.delta_pct > 0 ? "▲" : "▼";
  return `${arrow} ${Math.abs(kpi.delta_pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function isFavorable(row: PanoramaRow): boolean | null {
  const d = row.kpi.delta_pct;
  if (d === null || Math.abs(d) < 0.5) return null;
  return row.higherIsBetter ? d > 0 : d < 0;
}

function panoramaRows(summary: ExecutiveSummary): PanoramaRow[] {
  const rows: PanoramaRow[] = [
    {
      label: "Faturado",
      value: compactCurrency.format(summary.total_billed.value),
      kpi: summary.total_billed,
      higherIsBetter: true,
      read: describeTrend("o faturamento", summary.total_billed.value, summary.total_billed.delta_pct, { shape: "currency" }),
    },
    {
      label: "Caixa protegido",
      value: compactCurrency.format(summary.total_value_saved.value),
      kpi: summary.total_value_saved,
      higherIsBetter: true,
      read: describeTrend("o caixa protegido pelo motor de glosa", summary.total_value_saved.value, summary.total_value_saved.delta_pct, { shape: "currency" }),
    },
    {
      label: "Buraco financeiro",
      value: compactCurrency.format(summary.financial_hole.value),
      kpi: summary.financial_hole,
      higherIsBetter: false,
      read: describeTrend("o que foi cobrado abaixo do contratado", summary.financial_hole.value, summary.financial_hole.delta_pct, { shape: "currency" }),
    },
  ];
  if (summary.avg_capacity_utilization) {
    const kpi = summary.avg_capacity_utilization;
    rows.push({
      label: "Agenda ocupada",
      value: `${(kpi.value * 100).toFixed(0)}%`,
      kpi,
      higherIsBetter: true,
      read: describeTrend("a ocupação da agenda", kpi.value, kpi.delta_pct, { shape: "percentage-higher-is-better", unit: "%" }),
    });
  }
  if (summary.avg_days_to_receive) {
    const kpi = summary.avg_days_to_receive;
    rows.push({
      label: "Prazo de recebimento",
      value: `${kpi.value.toFixed(0)} dias`,
      kpi,
      higherIsBetter: false,
      read: describeTrend("o prazo médio de recebimento", kpi.value, kpi.delta_pct, { shape: "duration" }),
    });
  }
  return rows;
}

function Panorama({ rows }: { rows: PanoramaRow[] }) {
  return (
    <aside aria-labelledby="panorama" className="flex flex-col lg:border-l lg:border-border-hairline lg:pl-9">
      <h2 id="panorama" className="mb-2.5 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">
        O panorama · últimos 30 dias
      </h2>
      {rows.map((row) => {
        const favorable = isFavorable(row);
        return (
          <div key={row.label} className="flex flex-col gap-1.5 border-b border-border-hairline py-3.5">
            <div className="flex items-baseline gap-2.5">
              <span className="text-[13px] text-ink-muted">{row.label}</span>
              <span className="tabular ml-auto text-xl font-semibold tracking-[-0.01em] text-ink">{row.value}</span>
              <span
                className={cn(
                  "min-w-[52px] text-right text-xs font-semibold",
                  favorable === null ? "text-ink-muted" : favorable ? "text-revenue" : "text-denied"
                )}
              >
                {deltaLabel(row.kpi)}
              </span>
            </div>
            <span className="text-[13px] leading-[1.45] text-ink-soft">{row.read}</span>
          </div>
        );
      })}
      <Link to="/decisao" className="mt-3 text-[13px] font-medium text-accent-muted hover:underline">
        Todos os números na Sala de Comando →
      </Link>
    </aside>
  );
}

function SeverityChips({ priorities }: { priorities: SmartInsight[] }) {
  const critical = priorities.filter((p) => p.severity === "critical").length;
  const warning = priorities.filter((p) => p.severity === "warning").length;
  const positive = priorities.filter((p) => p.severity === "positive" || p.severity === "comparativo").length;
  const chips = [
    { count: critical, label: critical === 1 ? "crítico" : "críticos", cls: "border-denied/25 bg-denied/10 text-denied", dot: "bg-denied" },
    { count: warning, label: "atenção", cls: "border-pending/25 bg-pending/10 text-pending", dot: "bg-pending" },
    { count: positive, label: positive === 1 ? "positivo" : "positivos", cls: "border-revenue/20 bg-revenue/10 text-revenue", dot: "bg-revenue" },
  ].filter((chip) => chip.count > 0);

  if (chips.length === 0) {
    chips.push({ count: 0, label: "Nenhum alerta", cls: "border-revenue/20 bg-revenue/10 text-revenue", dot: "bg-revenue" });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span key={chip.label} className={cn("flex h-[30px] items-center gap-2 rounded-lg border px-3 text-xs", chip.cls)}>
          <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", chip.dot)} />
          {chip.count > 0 ? `${chip.count} ${chip.label}` : chip.label}
        </span>
      ))}
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useCurrentUserProfile();
  const canViewAnalytics = !!user && _CAN_VIEW_ANALYTICS.includes(user.role);
  const { dateFrom, dateTo } = useDateWindow(30);

  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "executive-narrative"],
    queryFn: () => apiClient.get<ExecutiveNarrative>("/api/v1/analytics/executive-narrative"),
    retry: false,
  });
  // Achado ALTO da Auditoria de Prontidão v1 — mesmo sinal que
  // UploadCenterPage já usa pro próprio estado vazio.
  const { data: ingestionHistory, isLoading: isLoadingIngestion } = useQuery({
    queryKey: ["ingestion-files", "first-run-check"],
    queryFn: () => apiClient.get<PaginatedResponse<IngestionFileEntry>>("/api/v1/ingestion/files?limit=1&offset=0"),
  });
  const { data: tenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => apiClient.get<Tenant>("/api/v1/tenant"),
    retry: false,
  });
  // Mesma queryKey da Sala de Comando — ir de uma tela à outra reaproveita o cache.
  const { data: summary } = useQuery({
    queryKey: ["analytics", "executive-summary", dateFrom, dateTo],
    queryFn: () => apiClient.get<ExecutiveSummary>(`/api/v1/analytics/executive-summary?date_from=${dateFrom}&date_to=${dateTo}`),
    enabled: canViewAnalytics,
    retry: false,
  });
  const { data: daily } = useQuery({
    queryKey: ["analytics", "daily-summary"],
    queryFn: () => apiClient.get<DailySummary>("/api/v1/analytics/daily-summary"),
    enabled: canViewAnalytics,
    retry: false,
  });

  const priorities = data?.top_priorities ?? [];
  const recentlyResolved = data?.recently_resolved ?? [];
  const firstName = profile ? firstNameFrom(profile.full_name) : null;
  const isFirstRun = !isLoadingIngestion && ingestionHistory?.total === 0;
  const canUpload = !!user && _CAN_UPLOAD_ROLES.includes(user.role);
  const [headline, ...others] = priorities;
  const secondary = others.slice(0, 2);
  const rows = summary ? panoramaRows(summary) : [];
  const goodNews = rows.filter((row) => isFavorable(row) === true).slice(0, 3);
  const dailySentences = daily ? daily.sentences.filter((s) => s !== daily.headline) : [];

  const now = new Date();
  const dateLine = capitalize(now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  const updatedAt = data?.generated_at
    ? new Date(data.generated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  const subtitle = isFirstRun
    ? "Sua clínica ainda não tem dado importado — vamos resolver isso."
    : data?.narrative
      ? data.narrative
      : error
        ? "Bem-vindo de volta. Os números de hoje já estão prontos na Sala de Comando."
        : priorities.length === 0
          ? "Tudo tranquilo por aqui — nada precisou da sua atenção nesta janela."
          : "Aqui está o resumo de hoje — confira as prioridades abaixo.";

  return (
    <div className="flex flex-col">
      {/* Tarja de urgência — só existe quando há prazo de recurso de glosa vencendo. */}
      {!!summary?.appeals_due_soon_count && (
        <div role="status" className="-mx-4 -mt-8 mb-2 flex flex-wrap items-center gap-3.5 border-b border-denied/20 bg-denied/[0.09] px-4 py-2.5 sm:-mx-8 sm:px-8">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-denied">
            <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-denied" />
            Urgente
          </span>
          <span className="text-sm text-ink">
            {summary.appeals_due_soon_count === 1
              ? "1 recurso de glosa está com o prazo vencendo ou já vencido."
              : `${summary.appeals_due_soon_count} recursos de glosa estão com o prazo vencendo ou já vencido.`}
          </span>
          <Link to="/denial-appeals" className="ml-auto text-[13px] font-medium text-denied hover:underline">
            Abrir recurso →
          </Link>
        </div>
      )}

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
            <motion.p
              key={subtitle}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="text-[15px] leading-relaxed text-ink-muted"
            >
              {tenant?.trade_name && !data?.narrative && !isFirstRun && <>Resumo de {tenant.trade_name}. </>}
              {subtitle}
            </motion.p>
          )}
        </div>
        {!isFirstRun && !isLoading && (
          <div className="flex flex-col gap-3.5 lg:ml-auto lg:items-end">
            <SeverityChips priorities={priorities} />
            {canViewAnalytics && (
              <Button type="button" variant="secondary" onClick={() => navigate("/decisao")} className="inline-flex items-center gap-2 self-start lg:self-end">
                Ver tudo na Sala de Comando
                <ArrowUpRight aria-hidden size={14} />
              </Button>
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
          <div
            className={cn(
              "grid grid-cols-1 gap-10 border-b border-border-hairline py-9",
              rows.length > 0 && "lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-0"
            )}
          >
            <div className={cn(rows.length > 0 && "lg:pr-12")}>{headline ? <Headline insight={headline} /> : <CalmHeadline />}</div>
            {rows.length > 0 && <Panorama rows={rows} />}
          </div>

          {/* Também hoje + o dia de hoje */}
          {(secondary.length > 0 || daily) && (
            <div className="grid grid-cols-1 gap-8 border-b border-border-hairline py-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-border-hairline">
              {secondary.map((insight, index) => (
                <div key={insight.title} className={cn(index === 0 ? "md:pr-8" : "md:px-8")}>
                  <SecondaryStory insight={insight} />
                </div>
              ))}
              {daily && (
                <aside aria-labelledby="dia-de-hoje" className={cn("flex flex-col gap-3", secondary.length > 0 && "md:pl-8", secondary.length === 1 && "md:col-span-2")}>
                  <h3 id="dia-de-hoje" className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                    O dia de hoje
                  </h3>
                  <p className="font-serif text-[22px] leading-[1.35] text-ink">{daily.headline}</p>
                  {dailySentences.length > 0 && (
                    <ul className="flex flex-col gap-2.5">
                      {dailySentences.map((sentence) => (
                        <li key={sentence} className="text-sm leading-relaxed text-ink-soft">
                          {sentence}
                        </li>
                      ))}
                    </ul>
                  )}
                </aside>
              )}
            </div>
          )}

          {/* Boas notícias + resolvido */}
          {(goodNews.length > 0 || recentlyResolved.length > 0) && (
            <div className="grid grid-cols-1 gap-8 border-b border-border-hairline py-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-0">
              {goodNews.length > 0 && (
                <section aria-labelledby="boas-noticias" className="flex flex-col gap-4 lg:pr-8">
                  <h2 id="boas-noticias" className="text-[11px] font-bold uppercase tracking-[0.12em] text-revenue">
                    Boas notícias
                  </h2>
                  <div className="grid grid-cols-1 gap-7 sm:grid-cols-3">
                    {goodNews.map((row) => (
                      <div key={row.label} className="flex flex-col gap-2">
                        <span className="font-serif text-[30px] font-semibold text-revenue">{row.value}</span>
                        <span className="text-sm leading-[1.55] text-ink-soft">{row.read}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {recentlyResolved.length > 0 && (
                <aside
                  aria-labelledby="resolvido"
                  className={cn("flex flex-col gap-3", goodNews.length > 0 && "lg:border-l lg:border-border-hairline lg:pl-8")}
                >
                  <h2 id="resolvido" className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-muted">
                    Resolvido desde a última checagem
                  </h2>
                  <ul className="flex flex-col gap-2.5">
                    {recentlyResolved.map((title) => (
                      <li key={title} className="flex items-start gap-2.5 text-sm leading-snug text-ink">
                        <CheckCircle2 aria-hidden size={15} className="mt-0.5 shrink-0 text-revenue" />
                        {title}
                      </li>
                    ))}
                  </ul>
                </aside>
              )}
            </div>
          )}

          <footer className="flex flex-wrap items-center gap-4 pt-5 text-[13px] text-ink-faint">
            <span>
              {updatedAt
                ? `Resumo gerado às ${updatedAt} com os dados importados até agora.`
                : "Resumo montado com os dados importados até agora."}
            </span>
            {canViewAnalytics && (
              <Link to="/decisao" className="ml-auto font-medium text-accent-muted hover:underline">
                Ir para a Sala de Comando →
              </Link>
            )}
          </footer>
        </>
      )}
    </div>
  );
}
