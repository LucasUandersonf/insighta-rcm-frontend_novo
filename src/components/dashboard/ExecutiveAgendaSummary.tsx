import { useQuery } from "@tanstack/react-query";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { cn } from "@/lib/cn";
import type { AgendaMetrics } from "@/lib/types";

// Seg..Dom para exibição — o backend usa a convenção 0=domingo..6=sábado
// (EXTRACT(DOW) do Postgres, ver AnalyticsRepository.appointment_weekday_histogram),
// então a ORDEM de exibição precisa reindexar, não só relabelar.
const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const CHART_LEFT = 4;
const CHART_RIGHT = 336;
const CHART_TOP = 12;
const CHART_BOTTOM = 80;
const GRID_LINES = [12, 34.4, 56.9, 80];

/**
 * Gráfico de área "Volume de consultas — 7 dias" — SVG cru com grid
 * horizontal e rótulos de dia da semana no eixo, substituindo o
 * sparkline anterior (ver canvas de design, Main.dc.html). Mesmo
 * raciocínio de DonutChart.tsx: é um único traço estático sem
 * interação/tooltip, não justifica puxar Recharts.
 */
function AppointmentVolumeChart({ weekdayHistogram }: { weekdayHistogram: AgendaMetrics["weekday_histogram"] }) {
  const countByWeekday = new Map(weekdayHistogram.map((b) => [b.weekday, b.appointment_count]));
  const values = WEEKDAY_DISPLAY_ORDER.map((day) => countByWeekday.get(day) ?? 0);
  const total = values.reduce((sum, v) => sum + v, 0);
  const max = Math.max(...values, 1);

  const step = (CHART_RIGHT - CHART_LEFT) / (values.length - 1);
  const points = values.map((v, i) => ({
    x: CHART_LEFT + i * step,
    y: CHART_BOTTOM - (v / max) * (CHART_BOTTOM - CHART_TOP),
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${CHART_RIGHT} ${CHART_BOTTOM} L ${CHART_LEFT} ${CHART_BOTTOM} Z`;
  const last = points[points.length - 1];

  return (
    <div>
      <p className="mb-1 text-2xs font-medium text-ink-muted">Volume de consultas — 7 dias</p>
      <div className="tabular mb-1.5 text-[26px] font-semibold tracking-tightest text-ink">{total} consultas</div>
      <svg viewBox="0 0 340 104" className="block h-[104px] w-full" role="img" aria-label={`${total} consultas na semana, distribuídas de segunda a domingo`}>
        <defs>
          <linearGradient id="appointment-volume-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--aura-1))" stopOpacity="0.32" />
            <stop offset="100%" stopColor="hsl(var(--aura-1))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {GRID_LINES.map((y) => (
          <line key={y} x1={CHART_LEFT} y1={y} x2={CHART_RIGHT} y2={y} stroke="hsl(var(--border-hairline-base) / 0.12)" strokeWidth={1} />
        ))}
        <path d={areaPath} fill="url(#appointment-volume-gradient)" />
        <path d={linePath} fill="none" stroke="hsl(var(--aura-2))" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last.x} cy={last.y} r={2.5} fill="hsl(var(--aura-2))" />
      </svg>
      <div className="mt-1.5 flex justify-between text-2xs text-ink-faint">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

// Mesmo limiar em 2 pontos de corte — ocupação alta (bom, verde),
// ocupação baixa (atenção, âmbar), meio-termo na cor de marca — ver
// canvas de design: dos 4 profissionais mostrados, o de maior ocupação
// (92%) vem em revenue, o de menor (54%) em pending, os do meio (78%/65%)
// no gradiente de marca. Limiares escolhidos para reproduzir exatamente
// essa distribuição, não um valor arbitrário novo.
function occupancyBarClass(rate: number): string {
  if (rate >= 0.85) return "bg-revenue";
  if (rate < 0.6) return "bg-pending";
  return "bg-aura-line";
}

function relativeDateLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Hoje, ${time}`;
  if (diffDays === 1) return `Amanhã, ${time}`;
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${time}`;
}

const RISK_CONFIG = {
  medio: { tone: "pending", label: "Médio" },
  alto: { tone: "denied", label: "Alto" },
} as const;

/**
 * Seção "Agenda & Capacidade Operacional" da Sala de Comando — versão
 * COMPACTA e específica desta tela (3 cards fixos), diferente da
 * AgendaAnalyticsPanel completa usada na aba Agenda do Painel (5
 * widgets: horários de pico, ocupação detalhada em tabela, risco por
 * nível, lista vermelha histórica). Mesmo endpoint/dado (`agenda-metrics`),
 * apresentação deliberadamente mais enxuta — a Sala de Comando é
 * diagnóstico rápido, o Painel é auditoria completa (ver canvas de
 * design: as duas telas nunca mostram os mesmos 5 widgets).
 */
export function ExecutiveAgendaSummary({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "agenda-metrics", dateFrom, dateTo],
    queryFn: () => apiClient.get<AgendaMetrics>(`/api/v1/analytics/agenda-metrics?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  if (isLoading) return <LoadingState variant="cards" rows={3} />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  const topProfessionals = [...data.professionals].sort((a, b) => b.utilization_rate - a.utilization_rate).slice(0, 4);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <BentoCard colSpan={4}>
        <p className="mb-3.5 text-2xs font-medium text-ink-muted">Ocupação por profissional</p>
        {topProfessionals.length === 0 ? (
          <p className="text-xs text-ink-faint">Nenhum profissional com grade cadastrada.</p>
        ) : (
          <div className="space-y-3">
            {topProfessionals.map((p) => (
              <div key={p.professional_id} className="flex items-center gap-3">
                <span className="w-[168px] shrink-0 truncate text-[12.5px] text-ink-muted">{p.full_name}</span>
                <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-canvas-raised">
                  <div
                    className={cn("h-full rounded-full", occupancyBarClass(p.utilization_rate))}
                    style={{ width: `${Math.min(p.utilization_rate * 100, 100)}%` }}
                  />
                </div>
                <span className="tabular w-16 shrink-0 text-right text-xs text-ink">{(p.utilization_rate * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}
      </BentoCard>

      <BentoCard colSpan={4}>
        <AppointmentVolumeChart weekdayHistogram={data.weekday_histogram} />
      </BentoCard>

      <BentoCard colSpan={4}>
        <p className="mb-1.5 text-2xs font-medium text-ink-muted">Risco de falta — próximos dias</p>
        {data.upcoming_risk_appointments.length === 0 ? (
          <p className="py-2 text-xs text-ink-faint">Nenhum agendamento de alto risco nos próximos dias.</p>
        ) : (
          <div>
            {data.upcoming_risk_appointments.map((appt) => {
              const cfg = RISK_CONFIG[appt.risk_level];
              return (
                <div key={appt.appointment_id} className="flex items-center justify-between border-b border-border-hairline py-[9px] last:border-0">
                  <div>
                    <p className="text-[12.5px] text-ink">{appt.patient_full_name}</p>
                    <p className="text-2xs text-ink-faint">{relativeDateLabel(appt.scheduled_at)}</p>
                  </div>
                  <Badge tone={cfg.tone}>{cfg.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </BentoCard>
    </div>
  );
}
