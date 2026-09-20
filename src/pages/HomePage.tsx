import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, CheckCircle2, Sparkles, UploadCloud } from "lucide-react";
import { LoadingState } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SEVERITY_CONFIG, formatCurrency } from "@/components/dashboard/SmartInsightsFeed";
import { RecentlyResolvedList } from "@/components/dashboard/RecentlyResolvedList";
import { apiClient } from "@/lib/api-client";
import { firstNameFrom, useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/cn";
import type { ExecutiveNarrative, IngestionFileEntry, PaginatedResponse, SmartInsight } from "@/lib/types";

// Achado ALTO da Auditoria de Prontidão v1 ("sem wizard de tenant novo"):
// mesmo RBAC de /upload (ingestion.py/_CAN_MANAGE) — quem não pode subir
// dado (atendimento/auditor) recebe uma mensagem diferente, pedindo pra
// avisar quem pode, em vez de um botão que levaria a uma tela 403.
const _CAN_UPLOAD_ROLES = ["owner", "admin", "financeiro"];

/**
 * Achado ALTO da Auditoria de Prontidão v1: uma clínica nova caía direto
 * nesta tela com a mensagem "Tudo tranquilo por aqui" — tecnicamente
 * verdade (não há nada urgente porque não há dado NENHUM), mas enganosa
 * pra quem só precisa saber "por onde eu começo" no primeiro acesso. O
 * sinal usado aqui é o MESMO que UploadCenterPage já usa pro próprio
 * estado vazio (GET /ingestion/files, total=0) — nenhum endpoint novo,
 * nenhuma heurística inventada à parte.
 */
function FirstRunWizard({ canUpload }: { canUpload: boolean }) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col items-start gap-3 rounded-lg border border-accent/25 bg-accent-bg p-5"
    >
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas-surface/70 text-accent">
        <UploadCloud size={18} strokeWidth={2} />
      </span>
      <div>
        <p className="text-sm font-medium text-ink">Vamos começar? Sua clínica ainda não tem nenhum dado importado.</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          {canUpload
            ? "Suba sua agenda, faturamento ou tabela de convênio na Central de Upload — é o primeiro passo para a Sala de Comando começar a gerar insights de verdade."
            : "Peça para o owner, administrador(a) ou financeiro da clínica subir os primeiros dados na Central de Upload — depois disso, esta tela passa a mostrar as prioridades reais do dia."}
        </p>
      </div>
      {canUpload && (
        <Button type="button" size="sm" onClick={() => navigate("/upload")} className="inline-flex items-center gap-1.5">
          Ir para Central de Upload
          <ArrowRight aria-hidden size={13} />
        </Button>
      )}
    </motion.div>
  );
}

/**
 * Home estilo Jarvis (Roadmap "Rumo à Nota 9", Fase 1) — pedido direto do
 * usuário: "quero uma home com as informações mais pertinentes geradas
 * pela ia... o sistema abre na home, um sistema estilo o jarvis, passando
 * mensagens que mudam dinamicamente". Substitui a Sala de Comando como
 * primeira tela (ver DECISÃO em App.tsx) — não repete o feed inteiro de
 * insights nem os KPIs, só responde "por onde eu começo hoje" em texto e
 * em até 3 cards, escolhidos pelo MESMO ranking de prioridade que já
 * decide a manchete da Sala de Comando (ver AnalyticsService.
 * get_executive_narrative::top_priorities, backend — nunca um ranking
 * inventado à parte). A Sala de Comando continua existindo por inteiro,
 * um clique daqui — ela é quem cuida da profundidade (ver DECISÃO no
 * Roadmap, Seção 2).
 *
 * DECISÃO — nunca um card de erro aqui, mesmo princípio de
 * ExecutiveNarrativeBanner.tsx: esta é a primeira coisa que o gestor vê
 * ao abrir o sistema. Sem narrativa (IA indisponível) ou sem prioridades
 * (nada relevante agora), a tela sempre mostra alguma frase de abertura
 * e nunca fica em branco nem exibe erro técnico.
 */
function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * DECISÃO — a Home não tem abas nem seções locais como a Sala de Comando
 * (ver InsightActionButton em SmartInsightsFeed.tsx, que interpreta
 * "#tab:"/"#weekday:"/"#professional:"/"#id" DENTRO da própria tela). Uma
 * rota real ("/...") navega direto; qualquer destino "#..." vira uma
 * query string que a Sala de Comando lê na montagem (ver DECISÃO em
 * ExecutiveOverviewPage.tsx) e resolve pro mesmo lugar que resolveria se
 * o clique tivesse acontecido lá dentro — corrige o Achado 2 da
 * Avaliação Home/Sala de Comando (antes, todo "#..." caía no Diagnóstico
 * genérico, mesmo quando o destino real era outra aba).
 */
function resolveHref(href: string): string {
  if (href.startsWith("/")) return href;
  if (href.startsWith("#tab:")) return `/decisao?tab=${href.slice("#tab:".length)}`;
  if (href.startsWith("#weekday:")) return `/decisao?weekday=${href.slice("#weekday:".length)}&scrollTo=agenda-resumo`;
  if (href.startsWith("#professional:")) return `/decisao?professional=${href.slice("#professional:".length)}&scrollTo=agenda-resumo`;
  if (href.startsWith("#")) return `/decisao?scrollTo=${href.slice(1)}`;
  return "/decisao";
}

function PriorityCard({ insight, index }: { insight: SmartInsight; index: number }) {
  const navigate = useNavigate();
  const cfg = SEVERITY_CONFIG[insight.severity];
  const Icon = cfg.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: "easeOut" }}
      className={cn("rounded-lg border p-4", cfg.border, cfg.bg)}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas-surface/70", cfg.text)}>
          <Icon size={15} strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <Badge tone={cfg.badgeTone}>{cfg.label}</Badge>
          <p className="mt-1.5 text-sm font-medium text-ink">{insight.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{insight.message}</p>
          {insight.financial_impact !== null && (
            <p className="mt-1.5 font-mono text-2xs text-ink-faint">Impacto estimado: {formatCurrency(insight.financial_impact)}</p>
          )}
          {insight.action_label && insight.action_href && (
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => navigate(resolveHref(insight.action_href!))}
              className={cn("mt-3 inline-flex items-center gap-1", cfg.text)}
            >
              {insight.action_label}
              <ArrowRight aria-hidden size={11} />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useCurrentUserProfile();
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "executive-narrative"],
    queryFn: () => apiClient.get<ExecutiveNarrative>("/api/v1/analytics/executive-narrative"),
    retry: false,
  });
  // Achado ALTO da Auditoria de Prontidão v1 — mesmo sinal que
  // UploadCenterPage já usa pro próprio estado vazio (limit=1 porque só
  // o `total` importa aqui, nunca a lista em si).
  const { data: ingestionHistory, isLoading: isLoadingIngestion } = useQuery({
    queryKey: ["ingestion-files", "first-run-check"],
    queryFn: () => apiClient.get<PaginatedResponse<IngestionFileEntry>>("/api/v1/ingestion/files?limit=1&offset=0"),
  });

  const priorities = data?.top_priorities ?? [];
  const recentlyResolved = data?.recently_resolved ?? [];
  const greeting = profile ? `${timeOfDayGreeting()}, ${firstNameFrom(profile.full_name)}.` : null;
  const isFirstRun = !isLoadingIngestion && ingestionHistory?.total === 0;
  const canUpload = !!user && _CAN_UPLOAD_ROLES.includes(user.role);

  return (
    <div className="mx-auto max-w-3xl space-y-10 py-6">
      <div>
        {greeting && <p className="text-sm text-ink-muted">{greeting}</p>}
        {isLoading || isLoadingIngestion ? (
          <div className="mt-4">
            <LoadingState rows={2} />
          </div>
        ) : isFirstRun ? (
          <p className="mt-3 font-serif text-2xl font-medium tracking-tightest text-ink">
            Sua clínica ainda não tem dado importado — vamos resolver isso.
          </p>
        ) : data?.narrative ? (
          <motion.p
            key={data.narrative}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="mt-3 text-balance font-serif text-[1.65rem] font-medium leading-snug tracking-tightest text-ink sm:text-[1.9rem]"
          >
            {data.narrative}
          </motion.p>
        ) : (
          <p className="mt-3 font-serif text-2xl font-medium tracking-tightest text-ink">
            {error
              ? "Bem-vindo de volta. Os números de hoje já estão prontos na Sala de Comando."
              : priorities.length === 0
                ? "Tudo tranquilo por aqui — nada precisou da sua atenção nesta janela."
                : "Aqui está o resumo de hoje — confira as prioridades abaixo."}
          </p>
        )}
        {!isLoading && !isFirstRun && <div className="mt-3"><RecentlyResolvedList titles={recentlyResolved} /></div>}
      </div>

      {isFirstRun ? (
        <FirstRunWizard canUpload={canUpload} />
      ) : priorities.length > 0 ? (
        <div className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-ink-faint">
            <Sparkles aria-hidden size={12} />
            Por onde começar hoje
          </h2>
          <div className="space-y-3">
            {priorities.map((insight, idx) => (
              <PriorityCard key={idx} insight={insight} index={idx} />
            ))}
          </div>
        </div>
      ) : !isLoading ? (
        <div className="flex items-start gap-3 rounded-lg border border-revenue/25 bg-revenue-bg p-4">
          <CheckCircle2 aria-hidden size={16} className="mt-0.5 shrink-0 text-revenue" />
          <p className="text-sm text-ink-muted">Nenhuma prioridade urgente agora — tudo dentro do esperado.</p>
        </div>
      ) : null}

      <div className="flex justify-center">
        <Button type="button" variant="secondary" size="sm" onClick={() => navigate("/decisao")} className="inline-flex items-center gap-1.5">
          Ver tudo na Sala de Comando
          <ArrowUpRight aria-hidden size={13} />
        </Button>
      </div>
    </div>
  );
}
