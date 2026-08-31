export { describeTrend } from "@/lib/narrative";
export type { DescribeTrendOptions, MetricShape } from "@/lib/narrative";

export type NarrativeTone = "positive" | "warning" | "critical" | "neutral";

interface NarrativeInsightProps {
  text: string;
  tone?: NarrativeTone;
}

const toneConfig: Record<NarrativeTone, { icon: string; className: string }> = {
  positive: { icon: "▲", className: "text-revenue" },
  warning: { icon: "●", className: "text-pending" },
  critical: { icon: "▼", className: "text-denied" },
  neutral: { icon: "◆", className: "text-accent" },
};

/** Callout compacto de texto explicativo automático ao lado/abaixo de um
 * KPI — frase corrida (não lista), tom sutil via ícone + cor. Alimentado
 * por texto já pronto (ver `describeTrend` em src/lib/narrative.ts para
 * gerar a frase a partir de um valor + delta). Sem dado embutido — puro
 * componente de apresentação. */
export function NarrativeInsight({ text, tone = "neutral" }: NarrativeInsightProps) {
  const cfg = toneConfig[tone];
  return (
    <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-ink-muted">
      <span aria-hidden className={`mt-0.5 shrink-0 ${cfg.className}`}>
        {cfg.icon}
      </span>
      <span>{text}</span>
    </p>
  );
}
