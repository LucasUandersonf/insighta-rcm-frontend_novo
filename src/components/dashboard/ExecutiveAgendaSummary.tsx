import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoGrid";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { AgendaRevenueForecastPanel } from "@/components/dashboard/AgendaRevenueForecastPanel";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { cn } from "@/lib/cn";
import type { AgendaFocus, AgendaMetrics, AppointmentListItem, PaginatedResponse, RecallCandidates } from "@/lib/types";

// Mesmo mapa de STATUS_LABELS de AppointmentsPage.tsx — vocabulário
// fechado idêntico (_KNOWN_STATUSES em app/schemas/appointment.py),
// duplicado aqui de propósito (é só rótulo de exibição, não lógica de
// validação — não é o mesmo tipo de "duas portas" que motivou extrair
// text_utils.py) pra esta seção não depender de outra página.
const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendada",
  completed: "Realizada",
  cancelled: "Cancelada",
  no_show: "Faltou",
};

function formatAppointmentDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}

const APPOINTMENT_LIST_PAGE_SIZE = 10;

/**
 * "Agendamentos do período" — tela que faltava depois do Achado 12 da
 * Auditoria de Templates e Insights: os insights de canal de
 * agendamento/motivo de cancelamento concentrado (ver
 * smart_insights_engine.py::_booking_channel_no_show_insight/
 * _cancellation_reason_insight, que apontam pra "#agenda-resumo") já
 * tinham o dado exposto pela API, mas não existia NENHUMA tela que
 * listasse agendamentos individuais mostrando QUAL agendamento tem qual
 * canal/motivo — só o card de "Risco de falta" acima, que é outro
 * recorte (risco preditivo de falta futura, não canal/motivo
 * histórico). Espelha GET /appointments (AppointmentListItem, backend).
 */
function AppointmentListPanel({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [offset, setOffset] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["appointments", "list", dateFrom, dateTo, offset],
    queryFn: () =>
      apiClient.get<PaginatedResponse<AppointmentListItem>>(
        `/api/v1/appointments?date_from=${dateFrom}&date_to=${dateTo}&limit=${APPOINTMENT_LIST_PAGE_SIZE}&offset=${offset}`
      ),
  });

  return (
    <BentoCard colSpan={12}>
      <p className="mb-1 text-2xs font-medium text-ink-muted">Agendamentos do período</p>
      <p className="mb-4 max-w-2xl text-xs text-ink-muted">
        Canal de agendamento e motivo de cancelamento por consulta — o detalhe individual por trás dos insights de Agenda acima.
      </p>
      {isLoading && <LoadingState rows={4} />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.total === 0 && (
        <EmptyState message="Nenhum agendamento nesse período." />
      )}
      {data && data.total > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-medium">Paciente</th>
                  <th className="px-4 py-2.5 font-medium">Data</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Canal de agendamento</th>
                  <th className="px-4 py-2.5 font-medium">Motivo de cancelamento</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                    <td className="px-4 py-2.5 text-ink">{item.patient_name}</td>
                    <td className="tabular px-4 py-2.5 font-mono text-ink-muted">{formatAppointmentDateTime(item.scheduled_at)}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{APPOINTMENT_STATUS_LABELS[item.status] ?? item.status}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{item.booking_channel ?? "—"}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{item.cancellation_reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={data.total} limit={data.limit} offset={data.offset} onOffsetChange={setOffset} />
        </>
      )}
    </BentoCard>
  );
}

// Seg..Dom para exibição — o backend usa a convenção 0=domingo..6=sábado
// (EXTRACT(DOW) do Postgres, ver AnalyticsRepository.appointment_weekday_histogram),
// então a ORDEM de exibição precisa reindexar, não só relabelar.
const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const WEEKDAY_LABELS_FULL = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
// Mesmas 7 labels, mas indexadas DIRETO pelo número do dia (0=domingo..
// 6=sábado, convenção EXTRACT(DOW)/AgendaFocus) — diferente dos dois
// arrays acima, que são indexados pela ORDEM DE EXIBIÇÃO (segunda
// primeiro). Usado só para traduzir um AgendaFocus de volta em texto.
const WEEKDAY_LABELS_BY_DOW = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

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
// Narrativa em texto simples acima do gráfico — antes esta seção inteira
// (Agenda & Capacidade) era só barra/gráfico/lista, sem nenhuma frase,
// na contramão do resto da tela (achado do usuário: "menos BI, mais
// consultor" não tinha chegado até aqui). Só aponta o dia mais fraco
// quando a diferença é grande o bastante pra valer a pena mencionar —
// um dia levemente mais fraco que os outros é variação normal, não notícia.
function weakestDayNote(values: number[], labels: string[]): string | null {
  // Só considera dias com pelo menos 1 consulta — do contrário, o
  // "dia mais fraco" seria sempre sábado/domingo numa clínica comum
  // (que não atende no fim de semana), o que não é notícia nenhuma.
  const workingDays = values.map((v, i) => ({ v, i })).filter((d) => d.v > 0);
  if (workingDays.length < 3) return null; // amostra pequena demais pra comparar dia a dia
  const max = Math.max(...workingDays.map((d) => d.v));
  const weakest = workingDays.reduce((min, d) => (d.v < min.v ? d : min));
  if (weakest.v > max * 0.6) return null; // diferença pequena, não vale destacar
  return `${labels[weakest.i]} costuma ser seu dia mais fraco da semana.`;
}

function AppointmentVolumeChart({ weekdayHistogram }: { weekdayHistogram: AgendaMetrics["weekday_histogram"] }) {
  const countByWeekday = new Map(weekdayHistogram.map((b) => [b.weekday, b.appointment_count]));
  const values = WEEKDAY_DISPLAY_ORDER.map((day) => countByWeekday.get(day) ?? 0);
  const total = values.reduce((sum, v) => sum + v, 0);
  const max = Math.max(...values, 1);
  const note = weakestDayNote(values, WEEKDAY_LABELS_FULL);

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
      {note && <p className="mt-2 text-2xs leading-relaxed text-ink-muted">{note}</p>}
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

// Mesma ideia de weakestDayNote acima: uma frase simples explicando o
// que os números abaixo significam, em vez de deixar 4 barras coloridas
// falarem por si só.
function occupancyNote(professionals: AgendaMetrics["professionals"]): string | null {
  const withGrade = professionals.filter((p) => p.available_minutes > 0);
  if (withGrade.length === 0) return null;
  const freeCount = withGrade.filter((p) => p.utilization_rate < 0.6).length;
  if (freeCount === 0) return "Sua equipe está com a agenda bem ocupada — nenhum profissional com muito horário livre.";
  const plural = freeCount === 1 ? "" : "s";
  return `${freeCount} profissional${plural} está${freeCount === 1 ? "" : "ão"} com a agenda bem mais livre que o normal — vale tentar preencher esses horários.`;
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

// "Há X dias/meses/anos" pro card de candidatos a recontato — diferente
// de formatDaysInactive (InactivePatientsPanel.tsx), que nunca mostra
// menos de "há mais de 1 mês" (faz sentido lá: piso de 365 dias já
// garante isso). Aqui days_since_last_appointment pode ser bem pequeno
// (ver DECISÃO em AnalyticsRepository._recall_candidates_last_appointment
// — sem piso de tempo), então precisa de granularidade de dias também.
function formatDaysAgo(days: number): string {
  if (days < 30) return days <= 1 ? "há 1 dia" : `há ${days} dias`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "há 1 mês" : `há ${months} meses`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? "há 1 ano" : `há ${years} anos`;
}

function agendaFocusTitle(focus: AgendaFocus, recallData: RecallCandidates | undefined): string {
  if (focus.type === "weekday") return `Candidatos a recontato — ${WEEKDAY_LABELS_BY_DOW[focus.weekday]}`;
  const name = recallData?.professional_name;
  return name ? `Candidatos a recontato — agenda de ${name}` : "Candidatos a recontato";
}

/**
 * Card de "candidatos a recontato" — o destino real dos botões "Ver quem
 * costumava vir {dia}"/"Ver candidatos pra agenda de {profissional}" (ver
 * DECISÃO em smart_insights_engine.py::_weekday_drop_insight/
 * _weekday_no_show_rate_insight/_capacity_drop_insight). Só aparece
 * quando `focus` está setado — o gestor chega aqui clicando num botão de
 * insight, nunca por padrão (mesmo espírito de InactivePatientsPanel:
 * NÃO é reintrodução do CRUD de Pacientes, é uma lista de leitura
 * rápida, "por onde começar a ligar hoje").
 */
function RecallCandidatesCard({ focus, onClearFocus }: { focus: AgendaFocus; onClearFocus?: () => void }) {
  const query = focus.type === "weekday" ? `weekday=${focus.weekday}` : `professional_id=${focus.professionalId}`;
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "recall-candidates", focus],
    queryFn: () => apiClient.get<RecallCandidates>(`/api/v1/analytics/recall-candidates?${query}`),
  });

  return (
    <BentoCard colSpan={12} glow="pending">
      <div className="mb-1 flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink">{agendaFocusTitle(focus, data)}</p>
        {onClearFocus && (
          <button
            type="button"
            onClick={onClearFocus}
            aria-label="Fechar candidatos a recontato"
            className="shrink-0 rounded-full p-1 text-ink-faint transition-colors hover:bg-canvas-raised hover:text-ink"
          >
            <X size={14} strokeWidth={2} />
          </button>
        )}
      </div>
      {isLoading && <LoadingState rows={2} />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.total_count === 0 && (
        <EmptyState message="Ninguém nessa situação agora — sem candidato a recontato pra mostrar." />
      )}
      {data && data.total_count > 0 && (
        <>
          <p className="mb-4 max-w-2xl text-xs text-ink-muted">
            Já foram atendidos e não têm nenhum retorno marcado — por onde começar a ligar hoje.
          </p>
          <div className="space-y-2.5">
            {data.items.map((patient) => (
              <div
                key={patient.patient_id}
                className="flex items-center justify-between gap-3 rounded-md border border-border-hairline bg-canvas-raised/40 px-3 py-2"
              >
                <span className="truncate text-sm text-ink">{patient.full_name}</span>
                <span className="shrink-0 text-right text-xs text-ink-faint">
                  {patient.last_professional_name && `${patient.last_professional_name} · `}
                  {formatDaysAgo(patient.days_since_last_appointment)}
                </span>
              </div>
            ))}
          </div>
          {data.total_count > data.items.length && (
            <p className="mt-3 text-2xs text-ink-faint">
              Mostrando os {data.items.length} há mais tempo sem retorno de {data.total_count} no total.
            </p>
          )}
        </>
      )}
    </BentoCard>
  );
}

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
export function ExecutiveAgendaSummary({
  dateFrom,
  dateTo,
  focus,
  onClearFocus,
}: {
  dateFrom: string;
  dateTo: string;
  /** Ver AgendaFocus (lib/types.ts) e DECISÃO em RecallCandidatesCard —
   * quando setado, filtra "Risco de falta" pro dia da semana focado (se
   * for esse o tipo de foco) e mostra o card de candidatos a recontato. */
  focus?: AgendaFocus | null;
  onClearFocus?: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "agenda-metrics", dateFrom, dateTo],
    queryFn: () => apiClient.get<AgendaMetrics>(`/api/v1/analytics/agenda-metrics?date_from=${dateFrom}&date_to=${dateTo}`),
  });

  if (isLoading) return <LoadingState variant="cards" rows={3} />;
  if (error) return <ErrorState message={getApiErrorMessage(error)} />;
  if (!data) return null;

  const topProfessionals = [...data.professionals].sort((a, b) => b.utilization_rate - a.utilization_rate).slice(0, 4);
  const occupancyText = occupancyNote(data.professionals);
  // DECISÃO — filtra "Risco de falta" pro dia da semana focado (achado do
  // usuário: o insight de taxa de falta por dia apontava aqui, mas a
  // lista continuava mostrando TODOS os dias — o gestor tinha que
  // caçar sozinho quem era de fato daquele dia). getDay() do JS já usa a
  // mesma convenção 0=domingo..6=sábado do backend, sem conversão.
  const upcomingRiskAppointments =
    focus?.type === "weekday"
      ? data.upcoming_risk_appointments.filter((appt) => new Date(appt.scheduled_at).getDay() === focus.weekday)
      : data.upcoming_risk_appointments;
  const highRiskCount = upcomingRiskAppointments.filter((a) => a.risk_level === "alto").length;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <BentoCard colSpan={4}>
        <p className="mb-3.5 text-2xs font-medium text-ink-muted">Ocupação por profissional</p>
        {topProfessionals.length === 0 ? (
          <p className="text-xs text-ink-faint">Nenhum profissional com grade cadastrada.</p>
        ) : (
          <>
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
            {occupancyText && <p className="mt-3 text-2xs leading-relaxed text-ink-muted">{occupancyText}</p>}
          </>
        )}
      </BentoCard>

      <BentoCard colSpan={4}>
        <AppointmentVolumeChart weekdayHistogram={data.weekday_histogram} />
      </BentoCard>

      <BentoCard colSpan={4}>
        <p className="mb-1.5 text-2xs font-medium text-ink-muted">
          Risco de falta — próximos dias
          {focus?.type === "weekday" && ` (${WEEKDAY_LABELS_BY_DOW[focus.weekday]})`}
        </p>
        {upcomingRiskAppointments.length === 0 ? (
          <p className="py-2 text-xs text-ink-faint">
            {focus?.type === "weekday"
              ? `Ninguém marcado pra ${WEEKDAY_LABELS_BY_DOW[focus.weekday]} com risco relevante de faltar.`
              : "Ninguém com risco relevante de faltar nos próximos dias — pode ficar tranquilo."}
          </p>
        ) : (
          <div>
            {highRiskCount > 0 && (
              <p className="mb-2 text-2xs leading-relaxed text-ink-muted">
                Ligar ou mandar mensagem confirmando a presença costuma evitar boa parte dessas faltas.
              </p>
            )}
            {upcomingRiskAppointments.map((appt) => {
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

      <AgendaRevenueForecastPanel />

      {focus && <RecallCandidatesCard focus={focus} onClearFocus={onClearFocus} />}

      <AppointmentListPanel dateFrom={dateFrom} dateTo={dateTo} />
    </div>
  );
}
