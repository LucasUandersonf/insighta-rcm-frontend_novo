import { cn } from "@/lib/cn";

export interface DonutSegment {
  label: string;
  value: number;
  tone: "revenue" | "pending" | "denied" | "neutral" | "accent";
}

const TONE_VAR: Record<DonutSegment["tone"], string> = {
  revenue: "var(--revenue)",
  pending: "var(--pending)",
  denied: "var(--denied)",
  neutral: "var(--border-default)",
  accent: "var(--accent)",
};

const TONE_DOT_CLASS: Record<DonutSegment["tone"], string> = {
  revenue: "bg-revenue",
  pending: "bg-pending",
  denied: "bg-denied",
  neutral: "bg-border-default",
  accent: "bg-accent",
};

/**
 * Gráfico de rosca (donut) com legenda lateral — ex: distribuição de
 * risco de glosa no Painel (ver canvas de design, Painel.dc.html).
 * `conic-gradient` nativo em vez de uma lib de gráfico: é um anel
 * estático sem interação/tooltip, mesmo raciocínio do SVG cru já usado
 * no gráfico de área de Volume de Consultas — não vale a pena puxar
 * Recharts para desenhar um círculo.
 */
export function DonutChart({
  segments,
  centerLabel,
  centerValue,
  size = 120,
}: {
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: string;
  size?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let cursor = 0;
  const stops = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const start = cursor;
      cursor += total > 0 ? (s.value / total) * 360 : 0;
      return `hsl(${TONE_VAR[s.tone]}) ${start.toFixed(1)}deg ${cursor.toFixed(1)}deg`;
    });
  const gradient = stops.length > 0 ? `conic-gradient(${stops.join(", ")})` : "conic-gradient(hsl(var(--border-default)) 0deg 360deg)";
  const summary = `${centerLabel}: ${centerValue}. ${segments.map((s) => `${s.label}: ${s.value}`).join(", ")}`;

  return (
    <div className="flex items-center gap-5">
      <div
        role="img"
        aria-label={summary}
        className="relative shrink-0 rounded-full"
        style={{ width: size, height: size, background: gradient }}
      >
        <div aria-hidden className="absolute inset-[15px] flex flex-col items-center justify-center rounded-full bg-canvas-surface">
          <span className="text-[9.5px] font-medium uppercase tracking-wide text-ink-faint">{centerLabel}</span>
          <span className="tabular mt-0.5 text-[19px] font-semibold tracking-tightest text-ink">{centerValue}</span>
        </div>
      </div>
      <div className="flex-1 space-y-3">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT_CLASS[s.tone])} />
            <span className="text-xs text-ink-muted">{s.label}</span>
            <span className="tabular ml-auto text-xs text-ink">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
