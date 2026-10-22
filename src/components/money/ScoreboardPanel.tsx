import { useQuery } from "@tanstack/react-query";
import { brl } from "@/components/money/PreSubmissionIssues";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import type { EventScore, Scoreboard } from "@/lib/types";

const CAN_VIEW = ["owner", "admin", "financeiro", "auditor"];

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function times(high: number | null, low: number | null, template: string): string | null {
  if (high === null || low === null || low <= 0) return null;
  const x = high / low;
  return x >= 1.5 ? template.replace("{x}", `${x.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×`) : null;
}

function Cell({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="space-y-1">
      <p className="text-2xs uppercase tracking-wide text-ink-faint">{title}</p>
      <p className="text-lg font-semibold tabular text-ink">{value}</p>
      <p className="text-xs text-ink-muted">{detail}</p>
    </div>
  );
}

function eventCell(title: string, noun: string, verb: string, ratio: string, e: EventScore, min: number) {
  if (!e.ready || e.hit_rate === null) {
    return (
      <Cell
        title={title}
        value="Aprendendo"
        detail={`${e.events} de ${min} ${noun} resolvidas para medir o acerto.`}
      />
    );
  }
  return (
    <Cell
      title={title}
      value={pct(e.hit_rate)}
      detail={`Das ${e.events} ${noun}, ${e.flagged} ${verb}. ${times(e.high_rate, e.low_rate, ratio) ?? ""}`.trim()}
    />
  );
}

/**
 * Placar de acerto: o que o Insighta previu e o que aconteceu — faltas,
 * glosas e o caixa das últimas semanas. Sem amostra mínima, diz que está
 * aprendendo em vez de mostrar um acerto que não quer dizer nada.
 */
export function ScoreboardPanel() {
  const { user } = useAuth();
  const canView = !!user && CAN_VIEW.includes(user.role);
  const { data } = useQuery({
    queryKey: ["analytics", "placar"],
    queryFn: () => apiClient.get<Scoreboard>("/api/v1/analytics/placar"),
    enabled: canView,
    retry: false,
    staleTime: 10 * 60 * 1000,
  });
  if (!canView || !data) return null;
  const lastWeek = data.cash_weeks[data.cash_weeks.length - 1];

  return (
    <section aria-labelledby="placar-acerto">
      <h2 id="placar-acerto" className="mb-1 text-sm font-medium text-ink">
        Placar de acerto
      </h2>
      <p className="mb-2 text-xs text-ink-muted">
        O que o Insighta previu e o que aconteceu, nos últimos {data.window_days} dias.
      </p>
      <div className="grid gap-4 rounded-lg border border-border-hairline bg-glass px-4 py-3 sm:grid-cols-3">
        {eventCell(
          "Faltas avisadas",
          "faltas",
          "estavam marcadas como risco",
          "Quem estava em risco alto faltou {x} mais que o de risco baixo.",
          data.no_show,
          data.min_events
        )}
        {eventCell(
          "Glosas avisadas",
          "glosas",
          "tinham risco no envio",
          "Conta de risco alto foi glosada {x} mais que a de risco baixo.",
          data.denial,
          data.min_events
        )}
        {lastWeek && data.cash_accuracy !== null ? (
          <Cell
            title="Caixa previsto"
            value={pct(data.cash_accuracy)}
            detail={`Semana passada: previsto ${brl(lastWeek.predicted)}, entrou ${brl(lastWeek.actual)}.`}
          />
        ) : (
          <Cell title="Caixa previsto" value="Aprendendo" detail="A primeira semana conferida aparece na segunda-feira que vem." />
        )}
      </div>
    </section>
  );
}
