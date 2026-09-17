import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { NoShowBadge } from "@/components/ui/NoShowBadge";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { PaginatedResponse, UpcomingRiskAppointment } from "@/lib/types";

const PAGE_SIZE = 20;

function formatDayAndTime(iso: string): string {
  const date = new Date(iso);
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  const rest = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
  return `${weekday}, ${rest}`;
}

/**
 * Tela "Agenda de risco" (Painel → Agenda) — Roadmap "Rumo à Nota 9"
 * (Fase 2), achado direto da Auditoria UX: o card de risco de falta na
 * Sala de Comando só mostra CONTAGEM agregada (e, no máximo, uma prévia
 * de 6 nomes) — sem lugar nenhum pra ver a lista COMPLETA de quem está
 * em risco, por dia, com quem confirmar primeiro. Esta tela existe só
 * pra isso: lista nominal, paginada, mais próxima primeiro — o insight
 * "Tem gente com boa chance de não aparecer" (Sala de Comando) linka
 * direto pra cá em vez de só informar um número.
 */
export function AgendaRiscoPage() {
  const [offset, setOffset] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "upcoming-risk-appointments", offset],
    queryFn: () =>
      apiClient.get<PaginatedResponse<UpcomingRiskAppointment>>(
        `/api/v1/analytics/upcoming-risk-appointments?limit=${PAGE_SIZE}&offset=${offset}`
      ),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarClock}
        title="Agenda de risco"
        subtitle="Todos os agendamentos futuros com risco médio ou alto de falta, mais próximos primeiro — quem confirmar antes."
      />

      <Panel>
        {isLoading && <LoadingState variant="table" rows={6} />}
        {error && <ErrorState message={getApiErrorMessage(error)} />}
        {!isLoading && !error && items.length === 0 && (
          <EmptyState
            icon={<CalendarClock size={17} strokeWidth={1.5} />}
            message="Nenhum agendamento futuro com risco relevante de falta agora — a agenda está limpa."
          />
        )}
        {!isLoading && items.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Paciente</th>
                <th className="px-4 py-2.5 font-medium">Dia e horário</th>
                <th className="px-4 py-2.5 font-medium">Profissional</th>
                <th className="px-4 py-2.5 text-right font-medium">Risco</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.appointment_id}
                  className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60"
                >
                  <td className="px-4 py-2.5 text-ink">{item.patient_full_name}</td>
                  <td className="tabular px-4 py-2.5 font-mono text-ink-muted">{formatDayAndTime(item.scheduled_at)}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{item.professional_name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <NoShowBadge level={item.risk_level} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && data.total > 0 && <Pagination total={data.total} limit={PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />}
      </Panel>
    </div>
  );
}
