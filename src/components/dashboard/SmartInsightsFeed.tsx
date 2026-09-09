import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CalendarClock, CheckCircle2, TrendingDown, TrendingUp, TriangleAlert, Users, Wallet } from "lucide-react";
import { LoadingState, ErrorState } from "@/components/ui/Panel";
import { BentoCard } from "@/components/ui/BentoGrid";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { cn } from "@/lib/cn";
import type { InsightSeverity, SmartInsight, SmartInsights } from "@/lib/types";

/**
 * Redesenho da Sala de Comando ("menos BI, mais consultor"): esta
 * seção é o PRIMEIRO elemento visual da tela — a resposta em texto de
 * "onde está o problema", com o insight de maior impacto financeiro
 * destacado como manchete de bento card grande, e os demais como
 * células de apoio menores ao lado. Os números continuam existindo
 * (na tira de KPIs logo abaixo) — só deixaram de ser o elemento
 * principal da tela.
 */

const SEVERITY_CONFIG: Record<
  InsightSeverity,
  {
    label: string;
    icon: typeof TrendingUp;
    text: string;
    border: string;
    bg: string;
    dot: string;
    glow: "revenue" | "pending" | "denied" | "comparativo";
    badgeTone: BadgeTone;
  }
> = {
  critical: { label: "Crítico", icon: TrendingDown, text: "text-denied", border: "border-denied/25", bg: "bg-denied-bg", dot: "bg-denied", glow: "denied", badgeTone: "denied" },
  warning: { label: "Atenção", icon: TriangleAlert, text: "text-pending", border: "border-pending/25", bg: "bg-pending-bg", dot: "bg-pending", glow: "pending", badgeTone: "pending" },
  positive: { label: "Eficiência", icon: TrendingUp, text: "text-revenue", border: "border-revenue/25", bg: "bg-revenue-bg", dot: "bg-revenue", glow: "revenue", badgeTone: "revenue" },
  // Comparativo entre clínicas (Sala de Comando 2.0, Nível 1) — tom
  // próprio (tier1/violeta, ver DECISÃO em index.css), deliberadamente
  // FORA da paleta crítico/atenção/positivo: não é um veredito sobre a
  // clínica, é uma comparação com a rede.
  comparativo: { label: "Comparativo", icon: Users, text: "text-tier1", border: "border-tier1/25", bg: "bg-tier1-bg", dot: "bg-tier1", glow: "comparativo", badgeTone: "comparativo" },
};

// Valor de destaque em texto-gradiente + leve brilho (drop-shadow na cor
// do próprio tom) — ver canvas de design, Main.dc.html: o número de
// impacto do card de manchete usa `grad-text-tone grad-denied` com
// `filter:drop-shadow(0 0 24px hsl(var(--denied)/.35))`, nunca cor
// sólida. Esse é justamente o elemento que o pedido original chamou de
// "números de destaque... com gradiente e leve brilho, não cor sólida".
const IMPACT_GRADIENT_CLASSES: Record<InsightSeverity, string> = {
  critical: "bg-grad-denied bg-clip-text text-transparent drop-shadow-[0_0_24px_hsl(var(--denied)/0.35)]",
  warning: "bg-grad-pending bg-clip-text text-transparent drop-shadow-[0_0_24px_hsl(var(--pending)/0.35)]",
  positive: "bg-grad-revenue bg-clip-text text-transparent drop-shadow-[0_0_24px_hsl(var(--revenue)/0.35)]",
  comparativo: "bg-grad-tier1 bg-clip-text text-transparent drop-shadow-[0_0_24px_hsl(var(--tier1)/0.35)]",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const MESH_CSS_VAR: Record<InsightSeverity, string> = {
  critical: "--denied",
  warning: "--pending",
  positive: "--revenue",
  comparativo: "--tier1",
};

/**
 * Botão de ação real do card (pedido explícito do usuário: "cada card
 * deveria abrir um detalhe da análise" — antes todo insight era um beco
 * sem saída, o texto apontava um problema mas nunca levava a lugar
 * nenhum). `action_href` vem do backend em 3 formatos (ver DECISÃO em
 * smart_insights_engine.Insight):
 *   "/rota"   -> navega pra outra página (ex: fila de faturamento de
 *                alto risco, que já existe no Painel).
 *   "#tab:id" -> troca de aba dentro da própria Sala de Comando (ex:
 *                "Ver comparativo completo" abre a aba Comparativo).
 *   "#id"     -> rola até aquele card na MESMA tela (ex: os 3 cards de
 *                Agenda & Capacidade, que já mostram a lista completa).
 * Nunca inventa destino: só aponta pra telas/seções que já existem.
 */
function InsightActionButton({
  insight,
  onNavigateTab,
  toneClass,
}: {
  insight: SmartInsight;
  onNavigateTab?: (tabId: string) => void;
  toneClass: string;
}) {
  const navigate = useNavigate();
  if (!insight.action_label || !insight.action_href) return null;

  function handleClick() {
    const href = insight.action_href!;
    if (href.startsWith("#tab:")) {
      onNavigateTab?.(href.slice("#tab:".length));
      return;
    }
    if (href.startsWith("#")) {
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    navigate(href);
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="xs"
      onClick={handleClick}
      className={cn("mt-3 inline-flex items-center gap-1", toneClass)}
    >
      {insight.action_label}
      <ArrowRight aria-hidden size={11} />
    </Button>
  );
}

function HeroInsight({ insight, onNavigateTab }: { insight: SmartInsight; onNavigateTab?: (tabId: string) => void }) {
  const cfg = SEVERITY_CONFIG[insight.severity];
  const Icon = cfg.icon;
  const meshVar = MESH_CSS_VAR[insight.severity];
  return (
    <BentoCard colSpan={8} glow={cfg.glow} className={cn("border", cfg.border, cfg.bg)}>
      {/* Malha de gradiente decorativa — respira suavemente ao fundo do
          card, dando o card de manchete peso visual de "elemento de
          assinatura" em vez de mais um retângulo entre outros. Puramente
          decorativo: não compete com o texto (baixíssima opacidade). */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, hsl(var(${meshVar}) / 0.28), transparent 70%)` }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative flex items-start gap-3.5">
        <span aria-hidden className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas-surface/70", cfg.text)}>
          <Icon size={17} strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={cfg.badgeTone}>{cfg.label}</Badge>
            {insight.is_new && <Badge tone="novo">Novo</Badge>}
            <h2 className="font-serif text-lg font-medium tracking-premium text-ink sm:text-xl">{insight.title}</h2>
          </div>
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-[0.95rem]">{insight.message}</p>
          {insight.financial_impact !== null && (
            <div className="mt-4">
              <span className="text-2xs font-medium uppercase tracking-wide text-ink-faint">Impacto estimado</span>
              <div className={cn("tabular font-sans text-3xl font-semibold tracking-tightest sm:text-4xl", IMPACT_GRADIENT_CLASSES[insight.severity])}>
                <AnimatedNumber value={insight.financial_impact} format={formatCurrency} durationSeconds={1.2} />
              </div>
            </div>
          )}
          <InsightActionButton insight={insight} onNavigateTab={onNavigateTab} toneClass={cfg.text} />
        </div>
      </div>
    </BentoCard>
  );
}

function SecondaryInsightCard({ insight, onNavigateTab }: { insight: SmartInsight; onNavigateTab?: (tabId: string) => void }) {
  const cfg = SEVERITY_CONFIG[insight.severity];
  return (
    <BentoCard colSpan={4} glow={cfg.glow} className="p-4">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", cfg.dot)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">{insight.title}</p>
            <span className="flex shrink-0 items-center gap-1.5">
              {insight.is_new && <Badge tone="novo">Novo</Badge>}
              <Badge tone={cfg.badgeTone}>{cfg.label}</Badge>
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{insight.message}</p>
          {insight.financial_impact !== null && (
            <p className="mt-1.5 font-mono text-2xs text-ink-faint">Impacto estimado: {formatCurrency(insight.financial_impact)}</p>
          )}
          <InsightActionButton insight={insight} onNavigateTab={onNavigateTab} toneClass={cfg.text} />
        </div>
      </div>
    </BentoCard>
  );
}

const CATEGORY_CONFIG: Record<SmartInsight["category"], { label: string; icon: typeof Wallet }> = {
  faturamento: { label: "Faturamento & Convênios", icon: Wallet },
  agenda: { label: "Agenda & Ocupação", icon: CalendarClock },
};

/**
 * DECISÃO — feed agrupado por área (pedido explícito do usuário depois de
 * ver a tela em produção: cobrança/glosa e agenda misturados na mesma
 * lista ficava "embolado", ainda mais com vários cards de convênio
 * seguidos). O card de maior impacto continua como manchete solta, FORA
 * de qualquer seção — é "o problema nº1 agora", não pertence a uma área
 * específica. O resto entra na seção da sua `category` (ver DECISÃO em
 * smart_insights_engine.Insight.category, backend), mantendo a ordem de
 * prioridade que o backend já calculou dentro de cada seção. Seção sem
 * nenhum card não aparece — nunca um título "Agenda & Ocupação" sobre um
 * espaço vazio.
 */
function CategorySection({
  category,
  insights,
  onNavigateTab,
}: {
  category: SmartInsight["category"];
  insights: SmartInsight[];
  onNavigateTab?: (tabId: string) => void;
}) {
  if (insights.length === 0) return null;
  const { label, icon: Icon } = CATEGORY_CONFIG[category];
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-ink-faint">
        <Icon aria-hidden size={13} />
        {label}
      </h3>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {insights.map((insight, idx) => (
          <SecondaryInsightCard key={idx} insight={insight} onNavigateTab={onNavigateTab} />
        ))}
      </div>
    </div>
  );
}

function AllClearHero() {
  return (
    <BentoCard colSpan={12} glow="revenue" className="border border-revenue/25 bg-revenue-bg">
      <div className="flex items-start gap-3.5">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas-surface/70 text-revenue">
          <CheckCircle2 size={17} strokeWidth={2.25} />
        </span>
        <div>
          <h2 className="font-serif text-lg font-medium tracking-premium text-ink">Tudo certo por aqui</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
            Nenhum desvio relevante identificado nesta janela — operação dentro do esperado. Os números de apoio continuam
            disponíveis logo abaixo, caso queira conferir de qualquer forma.
          </p>
        </div>
      </div>
    </BentoCard>
  );
}

export function SmartInsightsFeed({
  dateFrom,
  dateTo,
  onNavigateTab,
}: {
  dateFrom: string;
  dateTo: string;
  /** Ver DECISÃO em InsightActionButton — permite o botão "Ver comparativo
   * completo" trocar de aba dentro da própria Sala de Comando. */
  onNavigateTab?: (tabId: string) => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "smart-insights", dateFrom, dateTo],
    queryFn: () => apiClient.get<SmartInsights>(`/api/v1/analytics/smart-insights?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  const insights = data?.insights ?? [];

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border-hairline bg-canvas-surface shadow-card">
        <LoadingState rows={3} />
      </div>
    );
  }

  if (error) return <ErrorState message={getApiErrorMessage(error)} />;

  if (insights.length === 0) return <AllClearHero />;

  const [topInsight, ...rest] = insights;
  const faturamentoInsights = rest.filter((insight) => insight.category === "faturamento");
  const agendaInsights = rest.filter((insight) => insight.category === "agenda");

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <HeroInsight insight={topInsight} onNavigateTab={onNavigateTab} />
      </div>
      <CategorySection category="faturamento" insights={faturamentoInsights} onNavigateTab={onNavigateTab} />
      <CategorySection category="agenda" insights={agendaInsights} onNavigateTab={onNavigateTab} />
    </motion.div>
  );
}
