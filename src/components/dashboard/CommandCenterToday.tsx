import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Check, Minus } from "lucide-react";
import { HeroInsight, SecondaryInsightCard, formatCurrency } from "@/components/dashboard/SmartInsightsFeed";
import { AssignModal, insightItemKey, useInsightWorkflow } from "@/components/dashboard/InsightWorkflowActions";
import { apiClient } from "@/lib/api-client";
import { describeTrend } from "@/lib/narrative";
import { cn } from "@/lib/cn";
import type {
  AgendaFocus,
  ExecutiveSummary,
  PayerOverview,
  PeriodKpi,
  PriorityQueue,
  RecoveredValue,
  SmartInsights,
  WeeklyTrend,
} from "@/lib/types";

/**
 * Aba "Hoje" da Sala de Comando — canvas "Insighta RCM — Redesign 2026"
 * (artboard "Sala de Comando"): tira de 4 indicadores com uma frase cada,
 * "O que atacar primeiro" (manchete + 3 cards de apoio), "Sua fila de
 * hoje" (checklist), "Faturado vs. glosado" (8 semanas, com a anotação
 * do salto de glosa), "O que já mudou por sua causa" e "De onde vem seu
 * faturamento". Todos os números vêm de rotas reais; bloco sem dado some.
 */

const CATEGORY_LABEL: Record<string, string> = {
  faturamento: "Faturamento",
  agenda: "Agenda",
  estoque: "Estoque",
  prontuario: "Prontuário",
  estrategia: "Estratégia",
};

const SHARE_COLORS = ["bg-brand", "bg-accent", "bg-accent-muted", "bg-[hsl(var(--accent-muted)/0.6)]"];

const compact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

function DeltaLine({ kpi, higherIsBetter }: { kpi: PeriodKpi; higherIsBetter: boolean }) {
  if (kpi.delta_pct === null) return <span className="text-xs text-ink-faint">sem período anterior para comparar</span>;
  const stable = Math.abs(kpi.delta_pct) < 0.5;
  const good = higherIsBetter ? kpi.delta_pct > 0 : kpi.delta_pct < 0;
  const Icon = stable ? Minus : kpi.delta_pct > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("flex items-center gap-1.5 text-xs", stable ? "text-pending" : good ? "text-revenue" : "text-denied")}>
      <Icon aria-hidden size={13} strokeWidth={2.2} />
      {stable ? "estável" : `${Math.abs(kpi.delta_pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs. período anterior`}
    </span>
  );
}

/** Percentual com 1 casa perto de 100% — "100%" com R$ 323 abaixo do
 * contratado no card ao lado contradizia a própria tela. */
function formatShare(value: number): string {
  const nearEdge = (value >= 99 && value < 100) || (value > 0 && value < 1);
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: nearEdge ? 1 : 0 })}%`;
}

function KpiStrip({ summary, payers }: { summary: ExecutiveSummary; payers?: PayerOverview }) {
  const topLoss = payers?.rows.slice().sort((a, b) => b.denied_value - a.denied_value)[0];
  const slowest = payers?.verdicts.find((v) => v.kind === "slowest");
  const margin = summary.margin_vs_contracted_pct;
  const shortfall = margin !== null ? 100 - margin : null;
  const cells: {
    label: string;
    value: string;
    kpi: PeriodKpi | null;
    higherIsBetter: boolean;
    note?: string;
    text: string;
  }[] = [
    {
      label: "Buraco financeiro",
      value: formatCurrency(summary.financial_hole.value),
      kpi: summary.financial_hole,
      higherIsBetter: false,
      text: describeTrend("o que foi cobrado abaixo do contratado", summary.financial_hole.value, summary.financial_hole.delta_pct, { shape: "currency" }),
    },
    {
      label: "Caixa protegido",
      value: formatCurrency(summary.total_value_saved.value),
      kpi: summary.total_value_saved,
      higherIsBetter: true,
      text: "Guias que o motor de risco segurou e corrigiu antes de ir para o convênio.",
    },
    {
      label: "Você faturou do que podia",
      value: margin !== null ? formatShare(margin) : "—",
      kpi: null,
      higherIsBetter: true,
      note: "do valor contratado",
      text:
        shortfall === null
          ? "Precisa de contrato homologado para comparar com o faturado."
          : shortfall <= 0
            ? "Tudo foi cobrado pelo valor contratado."
            : shortfall < 0.05
              ? "Menos de 0,1% ficou abaixo do valor contratado."
              : `Os ${formatShare(shortfall)} restantes ficaram abaixo do valor contratado.`,
    },
    {
      label: "Prazo médio de recebimento",
      value: summary.avg_days_to_receive ? `${summary.avg_days_to_receive.value.toFixed(0)} dias` : "—",
      kpi: summary.avg_days_to_receive,
      higherIsBetter: false,
      note: "sem pagamento de convênio no período",
      text: !summary.avg_days_to_receive
        ? "Nenhum convênio pagou cobranças deste período ainda."
        : slowest
          ? `${slowest.name} ainda leva mais que a média — é quem segura seu caixa.`
          : topLoss
            ? `Nenhum convênio fora do padrão de prazo nesta janela.`
            : "Sem pagamentos conciliados no período ainda.",
    },
  ];
  return (
    <section aria-label="Indicadores" className="grid grid-cols-1 overflow-hidden rounded-[20px] border border-border-hairline bg-glass sm:grid-cols-2 xl:grid-cols-4">
      {cells.map((cell, index) => (
        <div
          key={cell.label}
          className={cn("flex flex-col gap-2.5 px-6 py-5", index > 0 && "border-t border-border-hairline sm:border-t-0 xl:border-l", index === 2 && "sm:border-t xl:border-t-0", index === 3 && "sm:border-l sm:border-t xl:border-t-0")}
        >
          <span className="text-[13px] text-ink-muted">{cell.label}</span>
          <span className="tabular text-[30px] font-semibold leading-tight tracking-[-0.02em] text-ink">{cell.value}</span>
          {cell.kpi ? <DeltaLine kpi={cell.kpi} higherIsBetter={cell.higherIsBetter} /> : <span className="text-xs text-pending">{cell.note ?? ""}</span>}
          <p className="text-[13px] leading-normal text-ink-soft">{cell.text}</p>
        </div>
      ))}
    </section>
  );
}

/** Frente 1 — no máximo 5 prioridades por vez: mais que isso vira ruído. */
export const MAX_TODAY_PRIORITIES = 5;

function TodayQueue({ dateFrom, dateTo, workflow }: { dateFrom: string; dateTo: string; workflow: ReturnType<typeof useInsightWorkflow> }) {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "priority-queue", dateFrom, dateTo],
    queryFn: () => apiClient.get<PriorityQueue>(`/api/v1/analytics/priority-queue?date_from=${dateFrom}&date_to=${dateTo}`),
  });
  const all = data?.items ?? [];
  const items = all.slice(0, MAX_TODAY_PRIORITIES);
  const hidden = all.length - items.length;
  const done = items.filter((item) => workflow.actionedKeys[insightItemKey(item)]).length;

  return (
    <aside aria-labelledby="fila" className="flex flex-col gap-4 rounded-[20px] border border-border-hairline bg-glass p-6">
      <div className="flex items-center gap-2.5">
        <h2 id="fila" className="text-base font-semibold text-ink">
          Sua fila de hoje
        </h2>
        {items.length > 0 && <span className="ml-auto text-xs text-ink-faint">{done} de {items.length} feitas</span>}
      </div>
      {items.length > 0 && (
        <div className="flex h-1.5 overflow-hidden rounded-full bg-canvas-raised" aria-hidden>
          <span className="bg-revenue transition-all" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
      )}
      {isLoading && <p className="text-sm text-ink-muted">Carregando a fila…</p>}
      {!isLoading && items.length === 0 && (
        <p className="text-sm leading-relaxed text-ink-muted">Nenhuma ação prioritária agora — os alertas abertos estão sob controle nesta janela.</p>
      )}
      {items.map((item) => {
        const actioned = workflow.actionedKeys[insightItemKey(item)];
        return (
          <div key={insightItemKey(item)} className="flex gap-3 rounded-[14px] border border-border-hairline bg-canvas/45 p-3">
            <button
              type="button"
              disabled={!!actioned || !workflow.canManage || workflow.resolveMutation.isPending}
              onClick={() => workflow.resolveMutation.mutate(item)}
              aria-label={actioned ? `Feita: ${item.title}` : `Marcar como feita: ${item.title}`}
              className={cn(
                "mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border transition-colors",
                actioned ? "border-revenue bg-revenue" : "border-ink-faint/60 hover:border-revenue"
              )}
            >
              {actioned && <Check aria-hidden size={12} strokeWidth={3} className="text-canvas" />}
            </button>
            <div className="flex min-w-0 flex-col gap-1">
              <span className={cn("text-[13px] font-medium leading-snug", actioned ? "text-ink-faint line-through" : "text-ink")}>{item.title}</span>
              <span className="text-xs text-ink-faint">
                {CATEGORY_LABEL[item.category] ?? "Geral"} · {item.source === "raiox" ? "Raio-X" : "insight"}
                {actioned === "atribuido" && " · atribuído"}
              </span>
            </div>
            {item.financial_impact !== null && (
              <span className={cn("tabular ml-auto shrink-0 text-[13px] font-semibold", actioned ? "text-ink-faint" : "text-ink")}>
                {compact.format(item.financial_impact)}
              </span>
            )}
          </div>
        );
      })}
      {hidden > 0 && (
        <p className="text-xs text-ink-muted">
          Mais {hidden} {hidden === 1 ? "item espera" : "itens esperam"} na fila — {hidden === 1 ? "entra" : "entram"} aqui conforme você
          conclui estes.
        </p>
      )}
      <p className="mt-1 text-xs leading-normal text-ink-faint">
        A fila junta insights e itens do Raio-X, na ordem que mais devolve dinheiro por minuto de trabalho.
      </p>
    </aside>
  );
}

function TrendChart({ trend }: { trend: WeeklyTrend }) {
  const W = 820;
  const H = 230;
  const left = 48;
  const right = 10;
  const top = 16;
  const bottom = 200;
  const max = Math.max(1, ...trend.points.map((p) => Math.max(p.billed, p.denied)));
  const step = (W - left - right) / Math.max(1, trend.points.length - 1);
  const x = (i: number) => left + i * step;
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const path = (key: "billed" | "denied") =>
    trend.points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");
  const ai = trend.annotation_index;
  const ticks = [0, 1 / 3, 2 / 3, 1].map((f) => max * f);
  const boxW = 272;
  const boxX = ai !== null ? Math.min(x(ai) + 12, W - boxW - 4) : 0;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 14}`} role="img" aria-label={trend.summary ?? "Faturado e glosado por semana"}>
      <defs>
        <pattern id="trend-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="hsl(var(--ink) / 0.09)" strokeWidth="2" />
        </pattern>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} y1={y(t)} x2={W - right} y2={y(t)} stroke="hsl(var(--ink) / 0.06)" />
          <text x="0" y={y(t) + 4} fill="hsl(var(--ink-faint))" fontSize="11">
            {compact.format(t).replace("R$", "").trim()}
          </text>
        </g>
      ))}
      {ai !== null && <rect x={x(ai) - step / 2} y={top} width={W - right - (x(ai) - step / 2)} height={bottom - top} fill="url(#trend-hatch)" />}
      <path d={path("billed")} fill="none" stroke="hsl(var(--accent))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={path("denied")} fill="none" stroke="hsl(var(--denied))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {ai !== null && (
        <>
          <line x1={x(ai)} y1={top} x2={x(ai)} y2={bottom} stroke="hsl(var(--ink) / 0.25)" strokeDasharray="3 4" />
          <circle cx={x(ai)} cy={y(trend.points[ai].denied)} r="5" fill="hsl(var(--denied))" stroke="hsl(var(--canvas))" strokeWidth="2" />
          <rect x={boxX} y={top + 6} width={boxW} height="62" rx="10" fill="hsl(var(--canvas-overlay))" stroke="hsl(var(--ink) / 0.12)" />
          <text x={boxX + 14} y={top + 28} fill="hsl(var(--ink))" fontSize="12" fontWeight="600">
            {trend.annotation_title}
          </text>
          <text x={boxX + 14} y={top + 48} fill="hsl(var(--ink-muted))" fontSize="12">
            {trend.annotation_text}
          </text>
        </>
      )}
      {trend.points.map((p, i) => (
        <text key={p.week_start} x={x(i)} y={H - 4} fill="hsl(var(--ink-faint))" fontSize="11" textAnchor="middle">
          {p.label}
        </text>
      ))}
    </svg>
  );
}

export function CommandCenterToday({
  dateFrom,
  dateTo,
  summary,
  onNavigateTab,
  onFocusAgenda,
}: {
  dateFrom: string;
  dateTo: string;
  summary?: ExecutiveSummary;
  onNavigateTab: (tabId: string) => void;
  onFocusAgenda: (focus: AgendaFocus) => void;
}) {
  const workflow = useInsightWorkflow();
  const { data: insights } = useQuery({
    queryKey: ["analytics", "smart-insights", dateFrom, dateTo],
    queryFn: () => apiClient.get<SmartInsights>(`/api/v1/analytics/smart-insights?date_from=${dateFrom}&date_to=${dateTo}`),
  });
  const { data: trend } = useQuery({
    queryKey: ["analytics", "billed-vs-denied-weekly"],
    queryFn: () => apiClient.get<WeeklyTrend>("/api/v1/analytics/billed-vs-denied-weekly?weeks=8"),
    retry: false,
  });
  const { data: recovered } = useQuery({
    queryKey: ["analytics", "recovered-value"],
    queryFn: () => apiClient.get<RecoveredValue>("/api/v1/analytics/recovered-value"),
    retry: false,
  });
  const { data: payers } = useQuery({
    queryKey: ["analytics", "payer-overview", dateFrom, dateTo],
    queryFn: () => apiClient.get<PayerOverview>(`/api/v1/analytics/payer-overview?date_from=${dateFrom}&date_to=${dateTo}`),
    retry: false,
  });

  const [hero, ...support] = insights?.insights ?? [];
  const shareRows = payers ? [...payers.rows.slice(0, 4)] : [];
  const others = payers ? payers.rows.slice(4) : [];
  const othersBilled = others.reduce((acc, r) => acc + r.billed, 0);
  const othersShare = others.reduce((acc, r) => acc + r.share_pct, 0);

  return (
    <div className="flex flex-col gap-7">
      {summary && <KpiStrip summary={summary} payers={payers} />}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-labelledby="atacar" className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <h2 id="atacar" className="text-lg font-semibold text-ink">
              O que atacar primeiro
            </h2>
            <span className="text-xs text-ink-faint">ordenado por impacto no caixa</span>
          </div>
          {hero ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <HeroInsight insight={hero} onNavigateTab={onNavigateTab} onFocusAgenda={onFocusAgenda} workflow={workflow} />
            </div>
          ) : (
            insights && (
              <p className="rounded-[20px] border border-revenue/25 bg-revenue-bg p-6 text-sm text-ink-muted">
                Nenhum desvio relevante nesta janela — operação dentro do esperado.
              </p>
            )
          )}
          {support.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {support.slice(0, 3).map((insight) => (
                <SecondaryInsightCard key={insight.title} insight={insight} onNavigateTab={onNavigateTab} onFocusAgenda={onFocusAgenda} workflow={workflow} />
              ))}
            </div>
          )}
        </section>
        <TodayQueue dateFrom={dateFrom} dateTo={dateTo} workflow={workflow} />
      </div>

      {(trend || recovered) && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          {trend && trend.points.length > 0 && (
            <section aria-labelledby="tendencia" className="flex flex-col gap-4 rounded-[20px] border border-border-hairline bg-glass p-6">
              <div className="flex flex-wrap items-center gap-4">
                <h2 id="tendencia" className="text-base font-semibold text-ink">
                  Faturado vs. glosado
                </h2>
                <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <span aria-hidden className="h-[3px] w-2.5 rounded bg-accent" />
                  Faturado
                </span>
                <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <span aria-hidden className="h-[3px] w-2.5 rounded bg-denied" />
                  Glosado
                </span>
                <span className="ml-auto text-xs text-ink-faint">últimas {trend.points.length} semanas</span>
              </div>
              {trend.summary && <p className="text-sm leading-relaxed text-ink-soft">{trend.summary}</p>}
              <TrendChart trend={trend} />
            </section>
          )}
          {recovered && (
            <section aria-labelledby="memoria" className="flex flex-col gap-3.5 rounded-[20px] border border-border-hairline bg-glass p-6">
              <h2 id="memoria" className="text-base font-semibold text-ink">
                O que já mudou por sua causa
              </h2>
              <p className="text-[13px] leading-normal text-ink-muted">Insights que você resolveu neste mês e o que eles devolveram.</p>
              {recovered.items.length === 0 ? (
                <p className="text-[13px] text-ink-faint">Nenhum insight resolvido neste mês ainda — marque um como resolvido para ele aparecer aqui.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {recovered.items.map((item) => (
                    <div key={item.title} className="flex items-start gap-3">
                      <span aria-hidden className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-revenue/15">
                        <Check size={12} strokeWidth={3} className="text-revenue" />
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium text-ink">{item.title}</span>
                        {item.value !== null && <span className="text-xs text-revenue">{formatCurrency(item.value)} em jogo resolvidos</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-auto flex flex-col gap-1 rounded-[14px] border border-revenue/20 bg-revenue/[0.07] p-4">
                <span className="text-xs text-ink-muted">Recuperado com o Insighta este mês</span>
                <span className="tabular text-[26px] font-semibold tracking-[-0.02em] text-revenue">{formatCurrency(recovered.total)}</span>
              </div>
            </section>
          )}
        </div>
      )}

      {payers && payers.rows.length > 0 && (
        <section aria-labelledby="estrutura" className="flex flex-col gap-[18px] rounded-[20px] border border-border-hairline bg-glass p-6">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 id="estrutura" className="text-base font-semibold text-ink">
              De onde vem seu faturamento
            </h2>
            {payers.concentration_text && <p className="text-[13px] text-ink-muted">{payers.concentration_text}</p>}
          </div>
          <div
            className="grid gap-1.5 overflow-x-auto"
            style={{
              gridTemplateColumns: [...shareRows.map((r) => `minmax(120px, ${Math.max(r.share_pct, 6)}fr)`), ...(others.length ? [`minmax(120px, ${Math.max(othersShare, 6)}fr)`] : [])].join(" "),
            }}
          >
            {shareRows.map((row, index) => (
              <div key={row.insurance_plan_id} className="flex min-w-0 flex-col gap-2.5">
                <span className="truncate text-xs text-ink-muted">{row.name}</span>
                <span className="tabular truncate text-[22px] font-semibold text-ink">{compact.format(row.billed)}</span>
                <span aria-hidden className={cn("h-14 rounded-xl", SHARE_COLORS[index])} />
                <span className={cn("text-xs", index === 0 && row.share_pct >= 35 ? "text-denied" : "text-ink-faint")}>
                  {Math.round(row.share_pct)}%{index === 0 && row.share_pct >= 35 ? " · concentração alta" : ""}
                </span>
              </div>
            ))}
            {others.length > 0 && (
              <div className="flex min-w-0 flex-col gap-2.5">
                <span className="truncate text-xs text-ink-muted">Outros ({others.length})</span>
                <span className="tabular truncate text-[22px] font-semibold text-ink">{compact.format(othersBilled)}</span>
                <span aria-hidden className="h-14 rounded-xl border border-border-hairline bg-[repeating-linear-gradient(45deg,hsl(var(--ink)/0.12)_0_2px,transparent_2px_7px)]" />
                <span className="text-xs text-ink-faint">{Math.round(othersShare)}%</span>
              </div>
            )}
          </div>
        </section>
      )}

      <AssignModal
        item={workflow.assigningItem}
        onClose={() => workflow.setAssigningItem(null)}
        onAssigned={(item) => workflow.setActionedKeys((prev) => ({ ...prev, [insightItemKey(item)]: "atribuido" }))}
      />
    </div>
  );
}
