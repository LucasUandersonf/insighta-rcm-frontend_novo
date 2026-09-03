import type { NoShowRiskLevel } from "@/lib/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

// Vocabulário DIFERENTE do RiskBadge de glosa de propósito — espelha
// exatamente os valores que app/services/no_show_risk_engine.py produz
// (indeterminado/baixo/medio/alto), não o low/medium/high do motor de glosa.
const config: Record<NoShowRiskLevel, { label: string; tone: BadgeTone }> = {
  indeterminado: { label: "Sem histórico", tone: "neutral" },
  baixo: { label: "Baixo", tone: "revenue" },
  medio: { label: "Médio", tone: "pending" },
  alto: { label: "Alto", tone: "denied" },
};

export function NoShowBadge({ level }: { level: NoShowRiskLevel | null }) {
  if (!level) return <span className="text-2xs text-ink-faint">—</span>;
  const cfg = config[level];
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}
