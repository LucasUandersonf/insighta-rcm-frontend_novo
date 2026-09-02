import { cn } from "@/lib/cn";

const riskConfig = {
  low: { label: "Baixo", className: "bg-revenue-bg text-revenue border-revenue/25" },
  medium: { label: "Médio", className: "bg-pending-bg text-pending border-pending/25" },
  high: { label: "Alto", className: "bg-denied-bg text-denied border-denied/25" },
} as const;

export function RiskBadge({ level }: { level: keyof typeof riskConfig }) {
  const cfg = riskConfig[level];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium", cfg.className)}>
      {cfg.label}
    </span>
  );
}
