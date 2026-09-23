import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { ExecutiveNarrative, HealthScore } from "@/lib/types";

/**
 * Briefing do Insighta (Sala de Comando) — canvas Redesign 2026: resumo
 * narrado por IA à esquerda (em cima de números já calculados, ver
 * app/services/executive_narrative_service.py no backend), itens
 * resolvidos como etiquetas logo abaixo e, à direita, a "Saúde do
 * faturamento" (nota 0–100 de GET /analytics/health-score).
 *
 * DECISÃO — silencioso quando não há narrativa, nem itens resolvidos, nem
 * nota: esta é a primeira coisa que o gestor vê ao abrir a tela; um erro
 * de rede aqui nunca deveria virar um alerta vermelho.
 */
export function ExecutiveNarrativeBanner({ topPriorityTitle }: { topPriorityTitle?: string | null }) {
  const { data } = useQuery({
    queryKey: ["analytics", "executive-narrative"],
    queryFn: () => apiClient.get<ExecutiveNarrative>("/api/v1/analytics/executive-narrative"),
    retry: false,
  });
  const { data: health } = useQuery({
    queryKey: ["analytics", "health-score"],
    queryFn: () => apiClient.get<HealthScore>("/api/v1/analytics/health-score"),
    retry: false,
  });

  const recentlyResolved = data?.recently_resolved ?? [];
  const hasHealth = health?.score !== null && health?.score !== undefined;
  if (!data?.narrative && recentlyResolved.length === 0 && !hasHealth) return null;

  const updatedAt = data?.generated_at
    ? new Date(data.generated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;
  const priorityTitle = topPriorityTitle ?? data?.top_priorities[0]?.title ?? null;

  return (
    <section
      aria-label="Resumo do período"
      data-testid="executive-briefing"
      className="grid grid-cols-1 gap-8 rounded-[20px] border border-border-hairline bg-glass px-6 py-7 backdrop-blur-xl sm:px-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10"
    >
      <div className="flex flex-col gap-3.5">
        <span className="flex items-center gap-2 text-xs font-medium text-accent-muted">
          <Sparkles size={14} strokeWidth={2} aria-hidden />
          Briefing do Insighta{updatedAt && ` · atualizado às ${updatedAt}`}
        </span>
        {data?.narrative ? (
          <p className="font-serif text-xl leading-[1.45] text-ink sm:text-[25px]">{data.narrative}</p>
        ) : (
          <p className="font-serif text-xl leading-[1.45] text-ink-soft">O resumo narrado de hoje ainda está sendo preparado.</p>
        )}
        {recentlyResolved.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {recentlyResolved.map((title) => (
              <span key={title} className="rounded-full border border-border-default px-2.5 py-1 text-xs text-ink-muted">
                Resolvido esta semana: {title}
              </span>
            ))}
          </div>
        )}
      </div>

      {hasHealth && (
        <div className="flex flex-col gap-3 lg:border-l lg:border-border-hairline lg:pl-8">
          <span className="text-xs font-medium uppercase tracking-[0.06em] text-ink-faint">Saúde do faturamento</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[52px] font-semibold leading-none tracking-[-0.03em] text-ink">{Math.round(health!.score!)}</span>
            <span className="text-base text-ink-faint">/ 100</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded bg-canvas-raised" aria-hidden>
            <span className="bg-[linear-gradient(90deg,hsl(var(--brand)),hsl(var(--accent)))]" style={{ width: `${Math.max(0, Math.min(100, health!.score!))}%` }} />
          </div>
          <p className="text-[13px] leading-normal text-ink-muted">
            {health!.trend
              ? `${health!.trend.delta >= 0 ? "Subiu" : "Caiu"} ${Math.abs(Math.round(health!.trend.delta))} pontos desde ${new Date(health!.trend.reference_month).toLocaleDateString("pt-BR", { month: "long" })}.`
              : "Nota combinando glosa, faltas e recursos de glosa."}
            {priorityTitle && ` Resolver “${priorityTitle}” é o que mais ajuda a subir a nota.`}
          </p>
        </div>
      )}
    </section>
  );
}
