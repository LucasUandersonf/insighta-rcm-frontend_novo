import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CalendarClock, ChevronDown, CheckCircle2, ClipboardList, Package, TrendingDown, TrendingUp, TriangleAlert, Users, Wallet } from "lucide-react";
import { LoadingState, ErrorState } from "@/components/ui/Panel";
import { BentoCard } from "@/components/ui/BentoGrid";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import {
  ActionedBadge,
  AssignModal,
  InsightWorkflowButtons,
  insightItemKey,
  toQueueItem,
  useInsightWorkflow,
} from "@/components/dashboard/InsightWorkflowActions";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { cn } from "@/lib/cn";
import type { AgendaFocus, InsightSeverity, SmartInsight, SmartInsights } from "@/lib/types";

/**
 * Redesenho da Sala de Comando ("menos BI, mais consultor"): esta
 * seção é o PRIMEIRO elemento visual da tela — a resposta em texto de
 * "onde está o problema", com o insight de maior impacto financeiro
 * destacado como manchete de bento card grande, e os demais como
 * células de apoio menores ao lado. Os números continuam existindo
 * (na tira de KPIs logo abaixo) — só deixaram de ser o elemento
 * principal da tela.
 */

// Exportado — reaproveitado pela Home (HomePage.tsx) pros cards de
// prioridade usarem o MESMO mapeamento de ícone/cor/badge do feed
// completo da Sala de Comando, em vez de duplicar (e arriscar
// divergir) a paleta severidade -> aparência em dois lugares.
export const SEVERITY_CONFIG: Record<
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

function formatCurrencyWhole(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** Fatia do retorno de useInsightWorkflow() (ver InsightWorkflowActions.tsx)
 * que HeroInsight/SecondaryInsightCard precisam pra desenhar seus próprios
 * botões de atribuir/resolver — cada card resolve o `actioned`/`queueItem`
 * do SEU insight sozinho, então só passamos a fatia compartilhada
 * (estado + mutation), não o item já resolvido. */
export type InsightWorkflowSlice = Pick<
  ReturnType<typeof useInsightWorkflow>,
  "canManage" | "actionedKeys" | "resolveMutation" | "setAssigningItem"
>;

// Fundo do card manchete — degradê diagonal na cor da severidade, igual
// ao "O que atacar primeiro" do canvas de design (Redesign 2026).
const CATEGORY_LABEL_SHORT: Partial<Record<string, string>> = {
  faturamento: "Convênios",
  agenda: "Agenda",
  estoque: "Estoque",
  prontuario: "Prontuário",
  estrategia: "Estratégia",
};

const HERO_TINT: Record<InsightSeverity, string> = {
  critical: "bg-[linear-gradient(160deg,hsl(var(--denied)/0.12),hsl(var(--denied)/0.02)_60%)]",
  warning: "bg-[linear-gradient(160deg,hsl(var(--pending)/0.11),hsl(var(--pending)/0.02)_60%)]",
  positive: "bg-[linear-gradient(160deg,hsl(var(--revenue)/0.1),hsl(var(--revenue)/0.02)_60%)]",
  comparativo: "bg-[linear-gradient(160deg,hsl(var(--tier1)/0.12),hsl(var(--tier1)/0.02)_60%)]",
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
 *   "#weekday:<n>"/"#professional:<id>" -> foca a seção de Agenda &
 *                Capacidade num dia da semana ou profissional específico
 *                (ver AgendaFocus, lib/types.ts) — dispara onFocusAgenda
 *                em vez de só rolar, porque ExecutiveAgendaSummary
 *                precisa SABER o foco pra buscar e mostrar os candidatos
 *                a recontato certos (ver DECISÃO em
 *                smart_insights_engine.py::_weekday_drop_insight/
 *                _capacity_drop_insight).
 * Nunca inventa destino: só aponta pra telas/seções que já existem.
 */
// Exportado para PriorityQueuePanel.tsx (épico F1.1 do Plano Diretor)
// reaproveitar a MESMA leitura de action_href (4 formatos) em vez de
// duplicar o parser — a fila de hoje mistura insights normais com
// itens sintéticos do Raio-X, mas o botão de ação é idêntico nos dois.
export function InsightActionButton({
  insight,
  onNavigateTab,
  onFocusAgenda,
  toneClass,
  primary = false,
}: {
  insight: SmartInsight;
  onNavigateTab?: (tabId: string) => void;
  onFocusAgenda?: (focus: AgendaFocus) => void;
  toneClass: string;
  /** Manchete do canvas Redesign 2026: botão cheio (violeta), não o link de apoio. */
  primary?: boolean;
}) {
  const navigate = useNavigate();
  if (!insight.action_label || !insight.action_href) return null;

  function handleClick() {
    const href = insight.action_href!;
    if (href.startsWith("#tab:")) {
      onNavigateTab?.(href.slice("#tab:".length));
      return;
    }
    if (href.startsWith("#weekday:")) {
      onFocusAgenda?.({ type: "weekday", weekday: Number(href.slice("#weekday:".length)) });
      document.getElementById("agenda-resumo")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (href.startsWith("#professional:")) {
      onFocusAgenda?.({ type: "professional", professionalId: href.slice("#professional:".length) });
      document.getElementById("agenda-resumo")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      variant={primary ? "primary" : "secondary"}
      size={primary ? "md" : "xs"}
      onClick={handleClick}
      className={cn("inline-flex items-center gap-1.5", !primary && "mt-3", !primary && toneClass)}
    >
      {insight.action_label}
      <ArrowRight aria-hidden size={primary ? 14 : 11} />
    </Button>
  );
}

export function HeroInsight({
  insight,
  onNavigateTab,
  onFocusAgenda,
  workflow,
}: {
  insight: SmartInsight;
  onNavigateTab?: (tabId: string) => void;
  onFocusAgenda?: (focus: AgendaFocus) => void;
  workflow: InsightWorkflowSlice;
}) {
  const cfg = SEVERITY_CONFIG[insight.severity];
  const Icon = cfg.icon;
  const queueItem = toQueueItem(insight);
  const actioned = workflow.actionedKeys[insightItemKey(insight)];
  return (
    <BentoCard colSpan={12} glow={cfg.glow} className={cn("border p-7", cfg.border, HERO_TINT[insight.severity])}>
      <div className="relative flex flex-col gap-[18px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge tone={cfg.badgeTone}>{cfg.label}</Badge>
          {insight.is_new && <Badge tone="novo">Novo</Badge>}
          <ActionedBadge actioned={actioned} />
          <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-faint">
            <Icon aria-hidden size={13} className={cfg.text} />
            {CATEGORY_LABEL_SHORT[insight.category] ?? "Destaque"}
            {insight.detected_days_ago != null && insight.detected_days_ago >= 1
              ? ` · detectado há ${insight.detected_days_ago} ${insight.detected_days_ago === 1 ? "dia" : "dias"}`
              : " · detectado hoje"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(220px,auto)] md:gap-8">
          <div className="flex flex-col gap-3">
            <h2 className="font-serif text-[26px] font-medium leading-tight text-ink">{insight.title}</h2>
            <p className="max-w-3xl text-[15px] leading-relaxed text-ink-soft">{insight.message}</p>
          </div>
          {insight.financial_impact !== null && (
            <div className={cn("flex flex-col gap-1.5 md:border-l md:pl-6", cfg.border)}>
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">Impacto estimado</span>
              <div className={cn("tabular text-[34px] font-semibold tracking-[-0.02em]", cfg.text)}>
                <AnimatedNumber value={insight.financial_impact} format={formatCurrencyWhole} durationSeconds={1.2} />
              </div>
            </div>
          )}
        </div>
        {(insight.why_now || insight.what_to_do || insight.if_ignored) && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              ["Por que agora", insight.why_now],
              ["O que fazer", insight.what_to_do],
              ["Se não fizer nada", insight.if_ignored],
            ].map(([label, text]) =>
              text ? (
                <div key={label} className="flex flex-col gap-1.5 rounded-[14px] border border-border-hairline bg-canvas/50 p-3.5">
                  <span className="text-xs font-semibold text-ink">{label}</span>
                  <span className="text-[13px] leading-normal text-ink-muted">{text}</span>
                </div>
              ) : null
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <InsightActionButton insight={insight} onNavigateTab={onNavigateTab} onFocusAgenda={onFocusAgenda} toneClass={cfg.text} primary />
          <InsightWorkflowButtons
            item={queueItem}
            canManage={workflow.canManage}
            actioned={actioned}
            onResolve={(i) => workflow.resolveMutation.mutate(i)}
            onAssign={workflow.setAssigningItem}
            resolvePending={workflow.resolveMutation.isPending}
            toneClass={cfg.text}
          />
        </div>
      </div>
    </BentoCard>
  );
}

export function SecondaryInsightCard({
  insight,
  onNavigateTab,
  onFocusAgenda,
  workflow,
}: {
  insight: SmartInsight;
  onNavigateTab?: (tabId: string) => void;
  onFocusAgenda?: (focus: AgendaFocus) => void;
  workflow: InsightWorkflowSlice;
}) {
  const cfg = SEVERITY_CONFIG[insight.severity];
  const queueItem = toQueueItem(insight);
  const actioned = workflow.actionedKeys[insightItemKey(insight)];
  return (
    <BentoCard colSpan={4} glow={cfg.glow} data-insight-card="secondary" className={cn("border p-5", cfg.border)}>
      <div className="flex items-start">
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <Badge tone={cfg.badgeTone}>{cfg.label}</Badge>
            {insight.is_new && <Badge tone="novo">Novo</Badge>}
          </span>
          <p className="mt-2.5 text-[15px] font-semibold leading-snug text-ink">{insight.title}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{insight.message}</p>
          {insight.financial_impact !== null && (
            <p className={cn("mt-2 text-[13px] font-semibold", cfg.text)}>Impacto estimado: {formatCurrency(insight.financial_impact)}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <InsightActionButton insight={insight} onNavigateTab={onNavigateTab} onFocusAgenda={onFocusAgenda} toneClass={cfg.text} />
            <ActionedBadge actioned={actioned} />
            <InsightWorkflowButtons
              item={queueItem}
              canManage={workflow.canManage}
              actioned={actioned}
              onResolve={(i) => workflow.resolveMutation.mutate(i)}
              onAssign={workflow.setAssigningItem}
              resolvePending={workflow.resolveMutation.isPending}
              toneClass={cfg.text}
            />
          </div>
        </div>
      </div>
    </BentoCard>
  );
}

// "estrategia" fica fora deste config de propósito: generate_insights()
// nunca emite essa categoria (só PriorityQueuePanel.tsx a usa, pra um
// terceiro badge da fila "Hoje") — CategorySection abaixo só agrupa as
// categorias que o feed de fato produz.
const CATEGORY_CONFIG: Record<"faturamento" | "agenda" | "estoque" | "prontuario", { label: string; icon: typeof Wallet }> = {
  faturamento: { label: "Faturamento & Convênios", icon: Wallet },
  agenda: { label: "Agenda & Ocupação", icon: CalendarClock },
  // Achado do Comitê de Liderança Tecnológica ("5 pernas", Sala de
  // Comando 3.0) — primeira categoria nova desde o agrupamento original
  // em duas seções (ver DECISÃO completa em smart_insights_engine.py::
  // _stock_stockout_risk_insight/_stock_expiring_lot_value_insight).
  estoque: { label: "Estoque & Suprimentos", icon: Package },
  // Segunda categoria nova (mesma rodada, template PEP — ver DECISÃO em
  // smart_insights_engine.py::_pep_documentation_gap_insight/
  // _pep_cid_completeness_insight): documentação clínica não é nem
  // faturamento nem agenda, é a perna assistencial/PEP.
  prontuario: { label: "Prontuário & Documentação Clínica", icon: ClipboardList },
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
  onFocusAgenda,
  workflow,
}: {
  category: "faturamento" | "agenda" | "estoque" | "prontuario";
  insights: SmartInsight[];
  onNavigateTab?: (tabId: string) => void;
  onFocusAgenda?: (focus: AgendaFocus) => void;
  workflow: InsightWorkflowSlice;
}) {
  if (insights.length === 0) return null;
  const { label, icon: Icon } = CATEGORY_CONFIG[category];
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
        <Icon aria-hidden size={13} />
        {label}
      </h3>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {insights.map((insight, idx) => (
          <SecondaryInsightCard key={idx} insight={insight} onNavigateTab={onNavigateTab} onFocusAgenda={onFocusAgenda} workflow={workflow} />
        ))}
      </div>
    </div>
  );
}

function AllClearHero({ scoped = false }: { scoped?: boolean }) {
  return (
    <BentoCard colSpan={12} glow="revenue" className="border border-revenue/25 bg-revenue-bg">
      <div className="flex items-start gap-3.5">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas-surface/70 text-revenue">
          <CheckCircle2 size={17} strokeWidth={2.25} />
        </span>
        <div>
          <h2 className="font-serif text-[22px] font-medium text-ink">Tudo certo por aqui</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
            {scoped
              ? "Nenhum desvio relevante nesta área, nesta janela. Os números de apoio estão logo abaixo, caso queira conferir."
              : "Nenhum desvio relevante identificado nesta janela — operação dentro do esperado. Os números de apoio continuam disponíveis logo abaixo, caso queira conferir de qualquer forma."}
          </p>
        </div>
      </div>
    </BentoCard>
  );
}

// DECISÃO — cap no feed (auditoria de UX): antes `rest` renderizava por
// inteiro, sem limite. Em clínicas com muito dado ativo isso vira uma
// parede de cards que compete pela atenção do gestor logo na entrada da
// Sala de Comando. Mostra as primeiras N (já vêm ordenadas por prioridade
// pelo backend) e deixa o resto atrás de um "ver mais" explícito.
const MAX_VISIBLE_SECONDARY_INSIGHTS = 4;

export function SmartInsightsFeed({
  dateFrom,
  dateTo,
  onNavigateTab,
  onFocusAgenda,
  categories,
}: {
  dateFrom: string;
  dateTo: string;
  /** Redesign 2026: cada aba da Sala de Comando mostra só os insights da
   * sua área (ex: ["agenda"]). Omitido = todos. */
  categories?: string[];
  /** Ver DECISÃO em InsightActionButton — permite o botão "Ver comparativo
   * completo" trocar de aba dentro da própria Sala de Comando. */
  onNavigateTab?: (tabId: string) => void;
  /** Ver DECISÃO em InsightActionButton — permite os botões de agenda
   * ("Ver quem costumava vir quarta", "Ver candidatos pra agenda de X")
   * focarem ExecutiveAgendaSummary num dia da semana/profissional. */
  onFocusAgenda?: (focus: AgendaFocus) => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "smart-insights", dateFrom, dateTo],
    queryFn: () => apiClient.get<SmartInsights>(`/api/v1/analytics/smart-insights?date_from=${dateFrom}&date_to=${dateTo}`),
  });
  const [expanded, setExpanded] = useState(false);
  const workflow = useInsightWorkflow();

  const insights = (data?.insights ?? []).filter((insight) => !categories || categories.includes(insight.category));

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border-hairline bg-canvas-surface shadow-card">
        <LoadingState rows={3} />
      </div>
    );
  }

  if (error) return <ErrorState message={getApiErrorMessage(error)} />;

  if (insights.length === 0) return <AllClearHero scoped={Boolean(categories)} />;

  const [topInsight, ...rest] = insights;
  const visibleRest = expanded ? rest : rest.slice(0, MAX_VISIBLE_SECONDARY_INSIGHTS);
  const hiddenCount = rest.length - visibleRest.length;
  const faturamentoInsights = visibleRest.filter((insight) => insight.category === "faturamento" || insight.category === "estrategia");
  const agendaInsights = visibleRest.filter((insight) => insight.category === "agenda");
  const estoqueInsights = visibleRest.filter((insight) => insight.category === "estoque");
  const prontuarioInsights = visibleRest.filter((insight) => insight.category === "prontuario");

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <HeroInsight insight={topInsight} onNavigateTab={onNavigateTab} onFocusAgenda={onFocusAgenda} workflow={workflow} />
      </div>
      <CategorySection category="faturamento" insights={faturamentoInsights} onNavigateTab={onNavigateTab} onFocusAgenda={onFocusAgenda} workflow={workflow} />
      <CategorySection category="agenda" insights={agendaInsights} onNavigateTab={onNavigateTab} onFocusAgenda={onFocusAgenda} workflow={workflow} />
      <CategorySection category="estoque" insights={estoqueInsights} onNavigateTab={onNavigateTab} onFocusAgenda={onFocusAgenda} workflow={workflow} />
      <CategorySection category="prontuario" insights={prontuarioInsights} onNavigateTab={onNavigateTab} onFocusAgenda={onFocusAgenda} workflow={workflow} />
      {hiddenCount > 0 && (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" size="sm" onClick={() => setExpanded(true)} className="inline-flex items-center gap-1.5">
            Ver mais {hiddenCount} {hiddenCount === 1 ? "insight" : "insights"}
            <ChevronDown aria-hidden size={13} />
          </Button>
        </div>
      )}
      <AssignModal
        item={workflow.assigningItem}
        onClose={() => workflow.setAssigningItem(null)}
        onAssigned={(item) => workflow.setActionedKeys((prev) => ({ ...prev, [insightItemKey(item)]: "atribuido" }))}
      />
    </motion.div>
  );
}
