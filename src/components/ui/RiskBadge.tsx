import { Badge } from "@/components/ui/Badge";

const riskConfig = {
  low: { label: "Baixo", tone: "revenue" },
  medium: { label: "Médio", tone: "pending" },
  high: { label: "Alto", tone: "denied" },
} as const;

export function RiskBadge({ level }: { level: keyof typeof riskConfig }) {
  const cfg = riskConfig[level];
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}
