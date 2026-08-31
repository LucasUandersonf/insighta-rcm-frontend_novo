const riskConfig = {
  low: { label: "Baixo", className: "bg-revenue-bg text-revenue border-revenue/30" },
  medium: { label: "Médio", className: "bg-pending-bg text-pending border-pending/30" },
  high: { label: "Alto", className: "bg-denied-bg text-denied border-denied/30" },
} as const;

export function RiskBadge({ level }: { level: keyof typeof riskConfig }) {
  const cfg = riskConfig[level];
  return (
    <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-2xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
