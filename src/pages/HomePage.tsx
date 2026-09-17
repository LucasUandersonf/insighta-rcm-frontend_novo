import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, CheckCircle2, Sparkles } from "lucide-react";
import { LoadingState } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SEVERITY_CONFIG, formatCurrency } from "@/components/dashboard/SmartInsightsFeed";
import { apiClient } from "@/lib/api-client";
import { firstNameFrom, useCurrentUserProfile } from "@/lib/useCurrentUserProfile";
import { cn } from "@/lib/cn";
import type { ExecutiveNarrative, SmartInsight } from "@/lib/types";

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
 * DECISÃO — destino de ação simplificado: a Home não tem abas nem seções
 * locais como a Sala de Comando (ver InsightActionButton em
 * SmartInsightsFeed.tsx, que interpreta "#tab:"/"#weekday:"/"#professional:").
 * Uma rota real ("/...") navega direto; qualquer destino "#..." aponta
 * pra Sala de Comando, onde o card completo — e a navegação de aba/seção
 * de verdade — já existe. Nunca inventa um destino que a Home não tem
 * como cumprir sozinha.
 */
function resolveHref(href: string): string {
  return href.startsWith("/") ? href : "/decisao";
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
  const { data: profile } = useCurrentUserProfile();
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "executive-narrative"],
    queryFn: () => apiClient.get<ExecutiveNarrative>("/api/v1/analytics/executive-narrative"),
    retry: false,
  });

  const priorities = data?.top_priorities ?? [];
  const greeting = profile ? `${timeOfDayGreeting()}, ${firstNameFrom(profile.full_name)}.` : null;

  return (
    <div className="mx-auto max-w-3xl space-y-10 py-6">
      <div>
        {greeting && <p className="text-sm text-ink-muted">{greeting}</p>}
        {isLoading ? (
          <div className="mt-4">
            <LoadingState rows={2} />
          </div>
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
              : "Tudo tranquilo por aqui — nada precisou da sua atenção nesta janela."}
          </p>
        )}
      </div>

      {priorities.length > 0 ? (
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
