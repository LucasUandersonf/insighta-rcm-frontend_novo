import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { NarrativeInsight } from "@/components/ui/NarrativeInsight";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { AgendaMetrics } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

// Recharts exige cor literal em `style`/`stroke` (não aceita classes
// Tailwind) — por isso os valores ficam hardcoded aqui, mas DEVEM
// espelhar os tokens atuais de tailwind.config.ts (canvas.raised,
// border.subtle, ink.faint) para não destoar do resto da UI nem
// reintroduzir o bug de contraste WCAG AA já corrigido no token.
const CHART_TOOLTIP_STYLE = { background: "#132436", border: "1px solid #182535", borderRadius: 4, fontSize: 12 };
const CHART_AXIS_STYLE = { stroke: "#7A8498", fontSize: 11 };

// 0=domingo .. 6=sábado — mesma convenção do backend (ver
// capacity_service.py, WeekdayBucket em app/schemas/analytics.py).
const WEEKDAY_SHORT_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function AgendaAnalyticsPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
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
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Horários de pico" subtitle="Volume de consultas por hora do dia">
        {isLoading && <LoadingState />}
        {error && <ErrorState message={getApiErrorMessage(error)} />}
        {!isLoading && !error && peakHoursData.length === 0 && <EmptyState message="Sem agendamentos nesta janela." />}
        {!isLoading && peakHoursData.length > 0 && (
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={peakHoursData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" vertical={false} />
                <XAxis dataKey="hora" {...CHART_AXIS_STYLE} tickLine={false} axisLine={{ stroke: "#1E2433" }} />
                <YAxis {...CHART_AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={{ color: "#F5F7FA" }} />
                <Bar dataKey="consultas" fill="#10B981" radius={[2, 2, 0, 0]} name="Consultas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel title="Agenda por dia da semana" subtitle="Evidência do insight de queda de agenda, ao lado — volume de consultas por dia">
        {isLoading && <LoadingState />}
        {error && <ErrorState message={getApiErrorMessage(error)} />}
        {!isLoading && !error && weekdayData.length === 0 && <EmptyState message="Sem agendamentos nesta janela." />}
        {!isLoading && weekdayData.length > 0 && (
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weekdayData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" vertical={false} />
                <XAxis dataKey="dia" {...CHART_AXIS_STYLE} tickLine={false} axisLine={{ stroke: "#1E2433" }} />
                <YAxis {...CHART_AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={{ color: "#F5F7FA" }} />
                <Bar dataKey="consultas" fill="#10B981" radius={[2, 2, 0, 0]} name="Consultas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel title="Ocupação por profissional" subtitle="Ocupação vs. ociosidade da agenda no período">
        {isLoading && <LoadingState />}
        {!isLoading && !error && professionalData.length === 0 && <EmptyState message="Nenhum profissional com grade cadastrada." />}
        {!isLoading && professionalData.length > 0 && (
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={professionalData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" horizontal={false} />
                <XAxis type="number" {...CHART_AXIS_STYLE} tickLine={false} axisLine={{ stroke: "#1E2433" }} unit="%" />
                <YAxis type="category" dataKey="nome" {...CHART_AXIS_STYLE} tickLine={false} axisLine={false} width={110} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={{ color: "#F5F7FA" }} formatter={(v: number) => `${v}%`} />
                <Bar dataKey="ocupacao" stackId="a" fill="#10B981" name="Ocupação" />
                <Bar dataKey="ociosidade" stackId="a" fill="#1E2433" name="Ociosidade" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel title="Detalhe por profissional" action={data && <span className="text-2xs text-ink-faint">{data.professionals.length} ativo(s)</span>}>
        {noShowNarrative && (
          <div className="border-b border-border-hairline px-4 py-3">
            <NarrativeInsight text={noShowNarrative} tone={avgNoShowRate !== null && avgNoShowRate > 0.2 ? "warning" : "positive"} />
          </div>
        )}
        {!isLoading && (data?.professionals ?? []).length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2 font-medium">Profissional</th>
                <th className="px-4 py-2 font-medium">Ocupação</th>
                <th className="px-4 py-2 font-medium">Taxa de no-show</th>
                <th className="px-4 py-2 font-medium">Consultas</th>
              </tr>
            </thead>
            <tbody>
              {(data?.professionals ?? []).map((p) => (
                <tr key={p.professional_id} className="border-b border-border-subtle last:border-0 hover:bg-canvas-raised">
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

      <Panel title="Risco preditivo de falta (no-show)" subtitle="Agendamentos futuros, por nível de risco">
        {!isLoading && data && (
          <div className="p-4">
            <ul className="mb-3 space-y-1.5 text-sm">
              {data.no_show_risk_breakdown.map((bucket) => (
                <li key={bucket.level} className="flex items-center justify-between">
                  <span className="capitalize text-ink-muted">{bucket.level}</span>
                  <span className="font-mono text-ink">{bucket.count}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-border-subtle pt-2 text-xs text-ink-faint">
              Receita cessante estimada:{" "}
              <span className="font-mono text-denied">{formatCurrency(data.estimated_revenue_at_risk)}</span>
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
