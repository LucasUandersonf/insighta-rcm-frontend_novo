import { ArrowDown, ArrowUp } from "lucide-react";
import { NarrativeInsight } from "@/components/ui/NarrativeInsight";
import { BentoCard } from "@/components/ui/BentoGrid";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { cn } from "@/lib/cn";

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
  /** Quantas das 12 colunas do bento grid o card ocupa (padrão: 4 no
   * tamanho default, 2 no compact — dá pra caber 6 lado a lado). */
  colSpan?: number;
  /** Quando informado junto de `format`, o número sobe animado de 0 (ou
   * do valor anterior) até este valor em vez de só trocar de texto —
   * `value` continua sendo a versão final em texto, usada por leitores
   * de tela e como fallback. Omitir mantém o comportamento estático. */
  numericValue?: number;
  format?: (n: number) => string;
}

const toneClasses: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  revenue: "text-revenue",
  pending: "text-pending",
  denied: "text-denied",
  neutral: "text-ink",
};

const toneGlow: Record<NonNullable<KpiCardProps["tone"]>, "revenue" | "pending" | "denied" | "accent"> = {
  revenue: "revenue",
  pending: "pending",
  denied: "denied",
  neutral: "accent",
};

const toneBarClasses: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  revenue: "bg-revenue",
  pending: "bg-pending",
  denied: "bg-denied",
  neutral: "bg-border-default",
};

export function KpiCard({
  label,
  value,
  trend,
  tone = "neutral",
  isPlaceholder,
  narrative,
  size = "default",
  colSpan,
  numericValue,
  format,
}: KpiCardProps) {
  const compact = size === "compact";
  return (
    <BentoCard
      colSpan={colSpan ?? (compact ? 2 : 4)}
      glow={toneGlow[tone]}
      className={cn(compact ? "p-3.5" : "p-5")}
    >
      {/* Trilho de cor no topo — identidade visual imediata do tom
          (receita/pendente/glosado) legível mesmo antes de ler o número. */}
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-[3px]", toneBarClasses[tone])} />

      <div className={cn("flex items-center justify-between", compact ? "mb-1.5" : "mb-3")}>
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

      <div className={cn("tabular font-sans font-semibold tracking-tightest", toneClasses[tone], compact ? "text-2xl" : "text-display")}>
        {numericValue !== undefined && format ? (
          <>
            <span aria-hidden="true">
              <AnimatedNumber value={numericValue} format={format} />
            </span>
            <span className="sr-only">{value}</span>
          </>
        ) : (
          value
        )}
      </div>

      {trend && (
        <div
          className={cn(
            "mt-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium",
            trend.positive ? "bg-revenue-bg text-revenue" : "bg-denied-bg text-denied"
          )}
        >
          {trend.positive ? <ArrowUp aria-hidden size={10} /> : <ArrowDown aria-hidden size={10} />}
          {trend.value}
        </div>
      )}

      {!compact && narrative && (
        <div className="mt-3 border-t border-border-hairline pt-2.5">
          <NarrativeInsight text={narrative} />
        </div>
      )}
    </BentoCard>
  );
}
