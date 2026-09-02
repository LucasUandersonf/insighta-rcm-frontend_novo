import type { NoShowRiskLevel } from "@/lib/types";
import { cn } from "@/lib/cn";

// Vocabulário DIFERENTE do RiskBadge de glosa de propósito — espelha
// exatamente os valores que app/services/no_show_risk_engine.py produz
// (indeterminado/baixo/medio/alto), não o low/medium/high do motor de glosa.
const config: Record<NoShowRiskLevel, { label: string; className: string }> = {
  indeterminado: { label: "Sem histórico", className: "bg-canvas-raised text-ink-faint border-border-default" },
  baixo: { label: "Baixo", className: "bg-revenue-bg text-revenue border-revenue/25" },
  medio: { label: "Médio", className: "bg-pending-bg text-pending border-pending/25" },
  alto: { label: "Alto", className: "bg-denied-bg text-denied border-denied/25" },
};

export function NoShowBadge({ level }: { level: NoShowRiskLevel | null }) {
  if (!level) return <span className="text-2xs text-ink-faint">—</span>;
  const cfg = config[level];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium", cfg.className)}>
      {cfg.label}
    </span>
  );
}
