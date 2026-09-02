import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { LoadingState, ErrorState } from "@/components/ui/Panel";
import { BentoCard } from "@/components/ui/BentoGrid";
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
  { label: string; icon: typeof TrendingUp; text: string; border: string; bg: string; dot: string; glow: "revenue" | "pending" | "denied" }
> = {
  critical: { label: "Crítico", icon: TrendingDown, text: "text-denied", border: "border-denied/25", bg: "bg-denied-bg", dot: "bg-denied", glow: "denied" },
  warning: { label: "Atenção", icon: TriangleAlert, text: "text-pending", border: "border-pending/25", bg: "bg-pending-bg", dot: "bg-pending", glow: "pending" },
  positive: { label: "Eficiência", icon: TrendingUp, text: "text-revenue", border: "border-revenue/25", bg: "bg-revenue-bg", dot: "bg-revenue", glow: "revenue" },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const MESH_CSS_VAR: Record<InsightSeverity, string> = {
  critical: "--denied",
  warning: "--pending",
  positive: "--revenue",
};

function HeroInsight({ insight }: { insight: SmartInsight }) {
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
            <span className={cn("rounded-full border px-2 py-0.5 text-2xs font-medium", cfg.border, cfg.text)}>{cfg.label}</span>
            <h2 className="font-serif text-lg font-medium tracking-premium text-ink sm:text-xl">{insight.title}</h2>
          </div>
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-[0.95rem]">{insight.message}</p>
          {insight.financial_impact !== null && (
            <div className="mt-4">
              <span className="text-2xs font-medium uppercase tracking-wide text-ink-faint">Impacto estimado</span>
              <div className={cn("tabular font-sans text-3xl font-semibold tracking-tightest sm:text-4xl", cfg.text)}>
                <AnimatedNumber value={insight.financial_impact} format={formatCurrency} durationSeconds={1.2} />
              </div>
            </div>
          )}
        </div>
      </div>
    </BentoCard>
  );
}

function SecondaryInsightCard({ insight }: { insight: SmartInsight }) {
  const cfg = SEVERITY_CONFIG[insight.severity];
  return (
    <BentoCard colSpan={4} glow={cfg.glow} className="p-4">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", cfg.dot)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">{insight.title}</p>
            <span className={cn("shrink-0 rounded-sm border px-1.5 py-0.5 text-2xs font-medium text-ink-muted", cfg.border)}>{cfg.label}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{insight.message}</p>
          {insight.financial_impact !== null && (
            <p className="mt-1.5 font-mono text-2xs text-ink-faint">Impacto estimado: {formatCurrency(insight.financial_impact)}</p>
          )}
        </div>
      </div>
    </BentoCard>
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

export function SmartInsightsFeed({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
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

  return (
    <motion.div
      className="grid grid-cols-1 gap-4 lg:grid-cols-12"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
    >
      <HeroInsight insight={topInsight} />
      {rest.map((insight, idx) => (
        <SecondaryInsightCard key={idx} insight={insight} />
      ))}
    </motion.div>
  );
}
