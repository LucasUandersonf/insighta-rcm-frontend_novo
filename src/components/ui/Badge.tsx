import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "revenue" | "pending" | "denied" | "neutral" | "accent";

const TONE_CLASSES: Record<BadgeTone, string> = {
  revenue: "bg-revenue-bg text-revenue border-revenue/25",
  pending: "bg-pending-bg text-pending border-pending/25",
  denied: "bg-denied-bg text-denied border-denied/25",
  neutral: "bg-canvas-raised text-ink-faint border-border-default",
  accent: "bg-accent-bg text-accent border-accent/30",
};

/**
 * Pílula de status genérica — o `.badge` do canvas de design, com os 5
 * tons que aparecem em toda a aplicação (status de contrato/recurso de
 * glosa/importação, papel de usuário, nível de risco). `RiskBadge` e
 * `NoShowBadge` são vocabulários ESPECÍFICOS por cima deste primitivo
 * (mapeiam seus próprios níveis — low/medium/high, indeterminado/baixo/
 * medio/alto — para um tom + rótulo), não uma reimplementação paralela:
 * qualquer ajuste de cor/tamanho de badge no futuro muda aqui uma vez
 * só, para as duas telas de risco e para qualquer tela nova que precise
 * de um badge de status simples (ex: "Homologado", "Aberto").
 */
export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium", TONE_CLASSES[tone])}>
      {children}
    </span>
  );
}
