import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Panel, LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { InsightActionButton } from "@/components/dashboard/SmartInsightsFeed";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { cn } from "@/lib/cn";
import type { AgendaFocus, InsightCategory, InsightSeverity, PriorityQueue } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const SEVERITY_TONE: Record<InsightSeverity, BadgeTone> = {
  critical: "denied",
  warning: "pending",
  positive: "revenue",
  comparativo: "comparativo",
};

const SEVERITY_LABEL: Record<InsightSeverity, string> = {
  critical: "Crítico",
  warning: "Atenção",
  positive: "Eficiência",
  comparativo: "Comparativo",
};

const CATEGORY_LABEL: Record<InsightCategory, string> = {
  faturamento: "Faturamento",
  agenda: "Agenda",
  estrategia: "Estratégia",
};

/**
 * Épico F1.1 do Plano Diretor ("Fila única de ação priorizada"): "Hoje
 * os 39 mecanismos vivem espalhados em abas [...] O gestor decide
 * sozinho, de cabeça, o que atacar primeiro." Esta é a tela "Hoje" —
 * página inicial da Sala de Comando — consumindo GET /priority-queue
 * (agregação de generate_insights() + os painéis do Raio-X que nunca
 * viram card de feed sozinho, ver DECISÃO no backend).
 *
 * Cada item mostra a categoria de ORIGEM como badge (nunca esconde a
 * proveniência) e o mesmo botão de ação já usado no feed completo
 * (InsightActionButton, reaproveitado — ver DECISÃO em
 * SmartInsightsFeed.tsx) — "marcar como resolvido" fica pra F1.2
 * (ciclo fechado de insight), ainda não implementado.
 */
export function PriorityQueuePanel({
  dateFrom,
  dateTo,
  onNavigateTab,
  onFocusAgenda,
}: {
  dateFrom: string;
  dateTo: string;
  onNavigateTab?: (tabId: string) => void;
  onFocusAgenda?: (focus: AgendaFocus) => void;
}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["analytics", "priority-queue", dateFrom, dateTo],
    queryFn: () =>
      apiClient.get<PriorityQueue>(`/api/v1/analytics/priority-queue?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  return (
    <Panel
      title="O que atacar primeiro"
      subtitle="Fila única, cruzando faturamento, agenda e estratégia — ordenada pelo maior impacto em R$."
    >
      {isLoading && <LoadingState variant="cards" rows={4} />}
      {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
      {!isLoading && !error && data && data.items.length === 0 && (
        <EmptyState
          icon={<CheckCircle2 size={17} strokeWidth={1.5} />}
          message="Nenhuma ação prioritária agora — os alertas abertos estão sob controle nesta janela."
        />
      )}
      {!isLoading && data && data.items.length > 0 && (
        <div className="divide-y divide-border-hairline">
          {data.items.map((item, idx) => (
            <div key={`${item.source}-${idx}`} className="flex gap-3 px-5 py-4">
              <span className="mt-0.5 font-mono text-xs text-ink-faint">{idx + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <Badge tone={SEVERITY_TONE[item.severity]}>{SEVERITY_LABEL[item.severity]}</Badge>
                  <span className="text-2xs text-ink-faint">{CATEGORY_LABEL[item.category]}</span>
                  {item.source === "raiox" && (
                    <span
                      className="rounded-full border border-border-subtle px-2 py-0.5 text-2xs text-ink-faint"
                      title="Extraído de um painel do Raio-X da Receita, não do feed de insights"
                    >
                      Raio-X
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-medium text-ink">{item.title}</h4>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{item.message}</p>
                <div className={cn("mt-2 flex flex-wrap items-center gap-3")}>
                  {item.financial_impact !== null && (
                    <span className="font-mono text-sm font-medium text-ink">
                      {formatCurrency(item.financial_impact)}
                    </span>
                  )}
                  <InsightActionButton
                    insight={item}
                    onNavigateTab={onNavigateTab}
                    onFocusAgenda={onFocusAgenda}
                    toneClass="text-ink-muted"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {data && data.total_considered > data.items.length && (
        <p className="border-t border-border-hairline px-5 py-3 text-2xs text-ink-faint">
          Mostrando {data.items.length} de {data.total_considered} ações abertas nesta janela.
        </p>
      )}
    </Panel>
  );
}
