import { NarrativeInsight } from "@/components/ui/NarrativeInsight";

interface KpiCardProps {
  label: string;
  value: string;
  trend?: { value: string; positive: boolean };
  tone?: "revenue" | "pending" | "denied" | "neutral";
  /** Quando o dado ainda não vem de um endpoint real do backend. */
  isPlaceholder?: boolean;
  /** Frase explicativa automática (ver describeTrend em src/lib/narrative.ts), renderizada abaixo do valor. */
  narrative?: string;
  /**
   * "compact" — usado onde o diagnóstico em texto já apareceu antes em
   * destaque (ex: SmartInsightsFeed na Sala de Comando) e este card
   * serve só como NÚMERO DE APOIO para quem quer conferir a evidência —
   * valor menor, sem narrativa embutida (evita repetir o mesmo texto
   * duas vezes na mesma tela). "default" (padrão) é o card cheio,
   * usado onde não há um insight textual equivalente em outro lugar da
   * tela (ex: Painel operacional).
   */
  size?: "default" | "compact";
}

const toneClasses: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  revenue: "text-revenue",
  pending: "text-pending",
  denied: "text-denied",
  neutral: "text-ink",
};

export function KpiCard({ label, value, trend, tone = "neutral", isPlaceholder, narrative, size = "default" }: KpiCardProps) {
  const compact = size === "compact";
  return (
    <div
      className={`rounded-lg border border-border-hairline bg-canvas-surface/80 shadow-card backdrop-blur-sm transition-shadow hover:shadow-elevated ${
        compact ? "p-3.5" : "p-5"
      }`}
    >
      <div className={`flex items-center justify-between ${compact ? "mb-1.5" : "mb-3"}`}>
        <span className="text-2xs font-medium uppercase tracking-wide text-ink-muted">{label}</span>
        {isPlaceholder && (
          <span
            title="Aguardando endpoint de agregação no backend — valor de exemplo"
            className="rounded-sm bg-canvas-raised px-1.5 py-0.5 text-2xs text-ink-faint"
          >
            exemplo
          </span>
        )}
      </div>
      <div className={`tabular font-mono font-semibold ${toneClasses[tone]} ${compact ? "text-xl" : "text-3xl"}`}>{value}</div>
      {trend && (
        <div
          className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium ${
            trend.positive ? "bg-revenue-bg text-revenue" : "bg-denied-bg text-denied"
          }`}
        >
          <span aria-hidden>{trend.positive ? "↑" : "↓"}</span>
          {trend.value}
        </div>
      )}
      {!compact && narrative && (
        <div className="mt-3 border-t border-border-hairline pt-2">
          <NarrativeInsight text={narrative} />
        </div>
      )}
    </div>
  );
}
