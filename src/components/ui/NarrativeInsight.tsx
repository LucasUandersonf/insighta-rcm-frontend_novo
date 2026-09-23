import { ArrowDownRight, ArrowUpRight, Circle, Diamond } from "lucide-react";
import { cn } from "@/lib/cn";

export { describeTrend } from "@/lib/narrative";
export type { DescribeTrendOptions, MetricShape } from "@/lib/narrative";

export type NarrativeTone = "positive" | "warning" | "critical" | "neutral";

interface NarrativeInsightProps {
  text: string;
  tone?: NarrativeTone;
}

const toneConfig: Record<NarrativeTone, { icon: typeof Circle; className: string }> = {
  positive: { icon: ArrowUpRight, className: "text-revenue" },
  warning: { icon: Circle, className: "text-pending" },
  critical: { icon: ArrowDownRight, className: "text-denied" },
  neutral: { icon: Diamond, className: "text-accent" },
};

/** Callout compacto de texto explicativo automático ao lado/abaixo de um
 * KPI — frase corrida (não lista), tom sutil via ícone + cor. Alimentado
 * por texto já pronto (ver `describeTrend` em src/lib/narrative.ts para
 * gerar a frase a partir de um valor + delta). Sem dado embutido — puro
 * componente de apresentação. */
export function NarrativeInsight({ text, tone = "neutral" }: NarrativeInsightProps) {
  const cfg = toneConfig[tone];
  const Icon = cfg.icon;
  return (
    <p className="flex items-start gap-1.5 text-[13px] leading-relaxed text-ink-soft">
      <Icon aria-hidden size={12} className={cn("mt-1 shrink-0", cfg.className)} />
      <span>{text}</span>
    </p>
  );
}
