import type { NoShowRiskLevel } from "@/lib/types";

// Vocabulário DIFERENTE do RiskBadge de glosa de propósito — espelha
// exatamente os valores que app/services/no_show_risk_engine.py produz
// (indeterminado/baixo/medio/alto), não o low/medium/high do motor de glosa.
const config: Record<NoShowRiskLevel, { label: string; className: string }> = {
  indeterminado: { label: "Sem histórico", className: "bg-canvas-raised text-ink-faint border-border" },
  baixo: { label: "Baixo", className: "bg-revenue-bg text-revenue border-revenue/30" },
  medio: { label: "Médio", className: "bg-pending-bg text-pending border-pending/30" },
  alto: { label: "Alto", className: "bg-denied-bg text-denied border-denied/30" },
};

export function NoShowBadge({ level }: { level: NoShowRiskLevel | null }) {
  if (!level) return <span className="text-2xs text-ink-faint">—</span>;
  const cfg = config[level];
  return (
    <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-2xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
