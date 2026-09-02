import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarX2, Users } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { NarrativeInsight } from "@/components/ui/NarrativeInsight";
import { useTheme } from "@/context/ThemeContext";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { AgendaMetrics } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

// Tooltip custom — substitui o `contentStyle` inline (que só estiliza a
// caixa) por um componente real, com o mesmo tratamento visual de
// card do resto da UI (borda fio-de-cabelo, sombra, tipografia
// consistente) em vez do balão genérico padrão do Recharts.
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border-hairline bg-canvas-surface px-3 py-2 text-xs shadow-elevated">
      {label && <p className="mb-1 font-medium text-ink">{label}</p>}
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <div key={i} className="flex items-center gap-1.5 text-ink-muted">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-mono text-ink">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// Recharts exige cor literal em `style`/`stroke` (não aceita classes
// Tailwind) — por isso os valores ficam hardcoded aqui, um conjunto por
// tema, espelhando os tokens atuais de tailwind.config.ts/index.css
// (canvas.raised, border.subtle, ink.faint, revenue). Trocados em tempo
// real via useTheme() para o Recharts nunca destoar do resto da UI.
const CHART_PALETTE = {
  dark: {
    tooltipBg: "#132436",
    tooltipBorder: "#182535",
    axis: "#7A8498",
    grid: "#1E2433",
    bar: "#16C98D",
    barMuted: "#1E2433",
    label: "#F5F7FA",
  },
  light: {
    tooltipBg: "#FFFFFF",
    tooltipBorder: "#D7DDE7",
    axis: "#586074",
    grid: "#E4E8EE",
    bar: "#0B8760",
    barMuted: "#E4E8EE",
    label: "#0B1420",
  },
};

// 0=domingo .. 6=sábado — mesma convenção do backend (ver
// capacity_service.py, WeekdayBucket em app/schemas/analytics.py).
const WEEKDAY_SHORT_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function AgendaAnalyticsPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { resolvedTheme } = useTheme();
  const palette = CHART_PALETTE[resolvedTheme];
  const axisStyle = { stroke: palette.axis, fontSize: 11 };

  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "agenda-metrics", dateFrom, dateTo],
    queryFn: () => apiClient.get<AgendaMetrics>(`/api/v1/analytics/agenda-metrics?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  const peakHoursData = (data?.peak_hours ?? []).map((b) => ({ hora: `${String(b.hour).padStart(2, "0")}h`, consultas: b.appointment_count }));
  const weekdayData = (data?.weekday_histogram ?? []).map((b) => ({ dia: WEEKDAY_SHORT_LABELS[b.weekday], consultas: b.appointment_count }));
  const professionalData = (data?.professionals ?? []).map((p) => ({
    nome: p.full_name,
    ocupacao: Math.round(p.utilization_rate * 100),
    ociosidade: Math.round((1 - p.utilization_rate) * 100),
  }));

  // Narrativa automática da taxa de no-show — pedido explícito do
  // usuário: "não só números, mas texto que explica a taxa de no-show
  // das agendas". Sem histórico de período anterior aqui (métrica
  // agregada só do período atual), então o texto é baseado em limiar em
  // vez de describeTrend (que exige delta).
  const professionals = data?.professionals ?? [];
  const avgNoShowRate =
    professionals.length > 0 ? professionals.reduce((sum, p) => sum + p.no_show_rate, 0) / professionals.length : null;
  const atRiskProfessionals = professionals.filter((p) => p.no_show_rate > 0.2);
  const noShowNarrative =
    avgNoShowRate === null
      ? null
      : avgNoShowRate > 0.2
        ? `A taxa média de no-show da equipe está em ${(avgNoShowRate * 100).toFixed(0)}%, acima do patamar saudável de 20%. ${
            atRiskProfessionals.length > 0
              ? `${atRiskProfessionals.length} profissional(is) concentram o maior risco de falta — vale reforçar confirmação de agenda com eles.`
              : ""
          }`
        : `A taxa média de no-show da equipe está em ${(avgNoShowRate * 100).toFixed(0)}%, dentro do patamar saudável — sem sinal de agenda ociosa por faltas.`;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="lg:col-span-6">
        <Panel title="Horários de pico" subtitle="Volume de consultas por hora do dia">
          {isLoading && <LoadingState />}
          {error && <ErrorState message={getApiErrorMessage(error)} />}
          {!isLoading && !error && peakHoursData.length === 0 && <EmptyState icon={<CalendarX2 size={17} strokeWidth={1.5} />} message="Sem agendamentos nesta janela." />}
          {!isLoading && peakHoursData.length > 0 && (
            <div className="p-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={peakHoursData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGradientHours" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={palette.bar} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={palette.bar} stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                  <XAxis dataKey="hora" {...axisStyle} tickLine={false} axisLine={{ stroke: palette.grid }} />
                  <YAxis {...axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: palette.grid, opacity: 0.35 }} />
                  <Bar dataKey="consultas" fill="url(#barGradientHours)" radius={[3, 3, 0, 0]} name="Consultas" animationDuration={700} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <div className="lg:col-span-6">
        <Panel title="Agenda por dia da semana" subtitle="Evidência do insight de queda de agenda, ao lado — volume de consultas por dia">
          {isLoading && <LoadingState />}
          {error && <ErrorState message={getApiErrorMessage(error)} />}
          {!isLoading && !error && weekdayData.length === 0 && <EmptyState icon={<CalendarX2 size={17} strokeWidth={1.5} />} message="Sem agendamentos nesta janela." />}
          {!isLoading && weekdayData.length > 0 && (
            <div className="p-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weekdayData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGradientWeekday" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={palette.bar} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={palette.bar} stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                  <XAxis dataKey="dia" {...axisStyle} tickLine={false} axisLine={{ stroke: palette.grid }} />
                  <YAxis {...axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: palette.grid, opacity: 0.35 }} />
                  <Bar dataKey="consultas" fill="url(#barGradientWeekday)" radius={[3, 3, 0, 0]} name="Consultas" animationDuration={700} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <div className="lg:col-span-6">
        <Panel title="Ocupação por profissional" subtitle="Ocupação vs. ociosidade da agenda no período">
          {isLoading && <LoadingState />}
          {!isLoading && !error && professionalData.length === 0 && <EmptyState icon={<Users size={17} strokeWidth={1.5} />} message="Nenhum profissional com grade cadastrada." />}
          {!isLoading && professionalData.length > 0 && (
            <div className="p-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={professionalData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGradientProf" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={palette.bar} stopOpacity={0.75} />
                      <stop offset="100%" stopColor={palette.bar} stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} horizontal={false} />
                  <XAxis type="number" {...axisStyle} tickLine={false} axisLine={{ stroke: palette.grid }} unit="%" />
                  <YAxis type="category" dataKey="nome" {...axisStyle} tickLine={false} axisLine={false} width={110} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: palette.grid, opacity: 0.35 }} formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="ocupacao" stackId="a" fill="url(#barGradientProf)" name="Ocupação" animationDuration={700} />
                  <Bar dataKey="ociosidade" stackId="a" fill={palette.barMuted} name="Ociosidade" radius={[0, 3, 3, 0]} animationDuration={700} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <div className="lg:col-span-6">
        <Panel title="Detalhe por profissional" action={data && <span className="text-2xs text-ink-faint">{data.professionals.length} ativo(s)</span>}>
          {noShowNarrative && (
            <div className="border-b border-border-hairline px-4 py-3">
              <NarrativeInsight text={noShowNarrative} tone={avgNoShowRate !== null && avgNoShowRate > 0.2 ? "warning" : "positive"} />
            </div>
          )}
          {!isLoading && (data?.professionals ?? []).length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-medium">Profissional</th>
                  <th className="px-4 py-2.5 font-medium">Ocupação</th>
                  <th className="px-4 py-2.5 font-medium">Taxa de no-show</th>
                  <th className="px-4 py-2.5 font-medium">Consultas</th>
                </tr>
              </thead>
              <tbody>
                {(data?.professionals ?? []).map((p) => (
                  <tr key={p.professional_id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                    <td className="px-4 py-2.5 text-ink">{p.full_name}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{formatPct(p.utilization_rate)}</td>
                    <td className={`px-4 py-2.5 ${p.no_show_rate > 0.2 ? "text-denied" : "text-ink-muted"}`}>{formatPct(p.no_show_rate)}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{p.total_appointments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className="lg:col-span-12">
        <Panel title="Risco preditivo de falta (no-show)" subtitle="Agendamentos futuros, por nível de risco">
          {!isLoading && data && (
            <div className="grid grid-cols-1 gap-6 p-4 sm:grid-cols-[1fr_auto]">
              <ul className="space-y-1.5 text-sm">
                {data.no_show_risk_breakdown.map((bucket) => (
                  <li key={bucket.level} className="flex items-center justify-between gap-6">
                    <span className="capitalize text-ink-muted">{bucket.level}</span>
                    <span className="tabular font-mono text-ink">{bucket.count}</span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-border-hairline pt-2 text-xs text-ink-faint sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0">
                Receita cessante estimada
                <br />
                <span className="tabular font-mono text-base text-denied">{formatCurrency(data.estimated_revenue_at_risk)}</span>
              </p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
