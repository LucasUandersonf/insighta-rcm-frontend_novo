import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, HeartPulse } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, ErrorState } from "@/components/ui/Panel";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { cn } from "@/lib/cn";
import type { HealthScore } from "@/lib/types";

/**
 * Nota de Saúde Financeira — Sala de Comando 2.0, Nível 2 do roadmap
 * (dado que já entra hoje, sem tela de operação nova). Widget PERSISTENTE
 * no topo da aba Diagnóstico (diferente do feed de insights abaixo, que
 * troca de card conforme o que dói mais na semana) — é um estado que se
 * acompanha ao longo dos meses, não um alerta que aparece e some.
 *
 * DECISÃO — tendência real, só quando existe histórico de verdade
 * -------------------------------------------------------------------
 * O backend agora guarda uma fotografia mensal da nota (ver
 * core.health_score_snapshots + app/worker/health_score_snapshot_job.py)
 * e só preenche `trend` quando já existe uma fotografia de referência
 * de ~90 dias atrás — em bases novas, sem 3 meses de histórico ainda,
 * `trend` vem `null` e a pílula simplesmente não aparece. Nunca uma
 * variação inventada (mesmo espírito de honestidade de
 * health_score_engine.py).
 *
 * DECISÃO — anel com cor por FAIXA de nota, não uma cor fixa
 * -------------------------------------------------------------------
 * O conceito de design usava uma cor fixa (tier2/azul) só para bater
 * com a pílula "Nível 2". Aqui o anel usa a MESMA lógica de
 * revenue/pending/denied do resto do produto (nota boa = verde, média =
 * âmbar, baixa = vermelho) — uma nota de 20 pintada de azul "bonito"
 * comunicaria segurança que não existe. A pílula "Nível 2 · Novo" abaixo
 * é só sobre o RECURSO ser novo na plataforma (fato verdadeiro), não
 * sobre o valor da nota — por isso pode usar a cor do conceito sem
 * conflito com a honestidade do anel.
 */

const RING_RADIUS = 32;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function scoreTone(score: number): { stroke: string; text: string } {
  if (score >= 70) return { stroke: "hsl(var(--revenue))", text: "text-revenue" };
  if (score >= 40) return { stroke: "hsl(var(--pending))", text: "text-pending" };
  return { stroke: "hsl(var(--denied))", text: "text-denied" };
}

// "mês/ano" curto — mais fácil de escanear numa pílula pequena do que a
// data ISO completa que o backend devolve (sempre o dia 1 do mês).
function formatReferenceMonth(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(
    new Date(Number(year), Number(month) - 1, 1)
  );
}

export function HealthScoreWidget() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "health-score"],
    queryFn: () => apiClient.get<HealthScore>("/api/v1/analytics/health-score"),
  });

  if (isLoading) {
    return (
      <BentoCard colSpan={12} className="mb-4">
        <LoadingState rows={1} />
      </BentoCard>
    );
  }

  if (error) {
    return (
      <BentoCard colSpan={12} className="mb-4">
        <ErrorState message={getApiErrorMessage(error)} />
      </BentoCard>
    );
  }

  if (!data) return null;

  if (data.score === null) {
    return (
      <BentoCard colSpan={12} glow="accent" className="mb-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas-raised text-ink-faint">
            <HeartPulse size={17} strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">Nota de saúde financeira</p>
            <p className="text-xs text-ink-muted">
              Ainda não há faturamento, agenda ou recurso de glosa suficiente nos últimos {data.window_days} dias para calcular
              — volte depois que a clínica tiver mais movimento.
            </p>
          </div>
        </div>
      </BentoCard>
    );
  }

  const tone = scoreTone(data.score);
  const dashOffset = RING_CIRCUMFERENCE * (1 - data.score / 100);

  return (
    <BentoCard colSpan={12} glow="accent" className="mb-4">
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative h-20 w-20 shrink-0">
          <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
            <circle cx="40" cy="40" r={RING_RADIUS} fill="none" stroke="hsl(var(--canvas-raised))" strokeWidth="8" />
            <circle
              cx="40"
              cy="40"
              r={RING_RADIUS}
              fill="none"
              stroke={tone.stroke}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
            />
          </svg>
          <div className={cn("absolute inset-0 flex items-center justify-center font-serif text-xl font-medium", tone.text)}>
            <AnimatedNumber value={data.score} format={(n) => n.toFixed(0)} durationSeconds={0.8} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ink">Nota de saúde financeira</p>
            {data.trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium",
                  data.trend.delta >= 0 ? "bg-revenue-bg text-revenue" : "bg-denied-bg text-denied"
                )}
              >
                {data.trend.delta >= 0 ? <ArrowUp aria-hidden size={10} /> : <ArrowDown aria-hidden size={10} />}
                {Math.abs(data.trend.delta).toFixed(0)} pontos desde {formatReferenceMonth(data.trend.reference_month)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Combina taxa de glosa, taxa de falta e sucesso em recurso — janela dos últimos {data.window_days} dias.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
            {data.components.map((c) => (
              <span key={c.key} className="text-2xs text-ink-faint">
                {c.label}: <span className="font-medium text-ink-muted">{(c.rate * 100).toFixed(1)}%</span>
              </span>
            ))}
          </div>
        </div>
        {/* "Nível 2" = classificação do roadmap (Sala de Comando 2.0) —
            dado que já cabia no sistema, sem tela de operação nova.
            "Novo" é verdadeiro (recurso lançado nesta rodada); a nota em
            si NÃO fica azul por causa desta pílula (ver DECISÃO acima). */}
        <div className="self-start">
          <Badge tone="novo">Nível 2 · Novo</Badge>
        </div>
      </div>
    </BentoCard>
  );
}
