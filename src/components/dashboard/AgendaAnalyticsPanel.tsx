import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertOctagon, CalendarX2, Users } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { NarrativeInsight } from "@/components/ui/NarrativeInsight";
import { ChartTooltip } from "@/components/dashboard/ChartTooltip";
import { useTheme } from "@/context/ThemeContext";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { CHART_PALETTE } from "@/lib/chartTheme";
import type { AgendaMetrics } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

function formatHoursAndMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${minutes}min`;
}

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
  // Taxa de falta por dia da semana — diferente de weekdayData (volume),
  // responde diretamente "quinta tem taxa de falta X%". Dias sem amostra
  // suficiente (menos de 3 atendimentos resolvidos — mesmo limiar
  // MIN_WEEKDAY_SAMPLE usado no insight textual do backend, ver
  // smart_insights_engine.py) entram como 0 no gráfico em vez de uma
  // taxa ruidosa (1 falta em 1 atendimento seria "100%", estatisticamente
  // vazio) — nunca omitidos, omitir quebraria o alinhamento com
  // WEEKDAY_SHORT_LABELS.
  const WEEKDAY_RATE_MIN_SAMPLE = 3;
  const weekdayRateData = (data?.weekday_no_show_rates ?? []).map((b) => ({
    dia: WEEKDAY_SHORT_LABELS[b.weekday],
    taxa: b.total_appointments >= WEEKDAY_RATE_MIN_SAMPLE && b.no_show_rate !== null ? Math.round(b.no_show_rate * 100) : 0,
  }));
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

      <div className="lg:col-span-12">
        <Panel
          title="Taxa de falta por dia da semana"
          subtitle="Diferente do gráfico de volume acima — aqui é a FRAÇÃO de faltas dentro dos atendimentos já resolvidos (concluído ou faltou) de cada dia, não a contagem de agendamentos"
        >
          {isLoading && <LoadingState />}
          {error && <ErrorState message={getApiErrorMessage(error)} />}
          {!isLoading && !error && weekdayRateData.length === 0 && (
            <EmptyState icon={<CalendarX2 size={17} strokeWidth={1.5} />} message="Sem atendimentos resolvidos nesta janela para calcular taxa de falta." />
          )}
          {!isLoading && weekdayRateData.length > 0 && (
            <div className="p-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weekdayRateData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGradientWeekdayRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={palette.bar} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={palette.bar} stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                  <XAxis dataKey="dia" {...axisStyle} tickLine={false} axisLine={{ stroke: palette.grid }} />
                  <YAxis {...axisStyle} tickLine={false} axisLine={false} allowDecimals={false} unit="%" />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: palette.grid, opacity: 0.35 }} formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="taxa" fill="url(#barGradientWeekdayRate)" radius={[3, 3, 0, 0]} name="Taxa de falta" animationDuration={700} />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-1 text-2xs text-ink-faint">Dias com poucos atendimentos resolvidos (menos de 3) aparecem zerados — amostra insuficiente para uma taxa confiável.</p>
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
              {data && data.total_idle_minutes > 0 && (
                <div className="mt-1 flex items-center justify-between border-t border-border-hairline pt-3 text-xs">
                  <span className="text-ink-faint">
                    {formatHoursAndMinutes(data.total_idle_minutes)} de agenda ociosa nesta janela
                  </span>
                  <span className="tabular font-mono font-medium text-pending">
                    {formatCurrency(data.estimated_revenue_lost_to_idle_capacity)} estimados
                  </span>
                </div>
              )}
              {data && data.professionals_without_availability_count > 0 && (
                <p className="mt-2 text-2xs text-ink-faint">
                  {data.professionals_without_availability_count} profissional(is) sem grade semanal cadastrada — os
                  números de ocupação/ociosidade acima estão incompletos para eles até a grade ser preenchida em
                  Profissionais.
                </p>
              )}
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

      <div className="lg:col-span-12">
        <Panel
          title="Lista vermelha de pacientes"
          subtitle="Ranking por taxa de falta no período — mínimo de 3 atendimentos para entrar na lista"
        >
          {isLoading && <LoadingState variant="table" rows={4} />}
          {!isLoading && !error && (data?.patient_no_show_ranking ?? []).length === 0 && (
            <EmptyState
              icon={<AlertOctagon size={17} strokeWidth={1.5} />}
              message="Nenhum paciente com padrão de falta relevante nesta janela — a lista vermelha está limpa."
            />
          )}
          {!isLoading && (data?.patient_no_show_ranking ?? []).length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-medium">Paciente</th>
                  <th className="px-4 py-2.5 font-medium">Faltas</th>
                  <th className="px-4 py-2.5 font-medium">Atendimentos no período</th>
                  <th className="px-4 py-2.5 text-right font-medium">Taxa de falta</th>
                </tr>
              </thead>
              <tbody>
                {(data?.patient_no_show_ranking ?? []).map((patient) => (
                  <tr key={patient.patient_id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                    <td className="px-4 py-2.5 text-ink">{patient.full_name}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{patient.no_show_count}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{patient.total_appointments}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center rounded-full border border-denied/25 bg-denied-bg px-2 py-0.5 text-2xs font-medium text-denied">
                        {formatPct(patient.no_show_rate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
