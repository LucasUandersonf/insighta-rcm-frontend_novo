import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CalendarClock, FileText, Package, Search, UserRound, X } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { NoShowBadge } from "@/components/ui/NoShowBadge";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import type { PatientFicha, PatientSearchItem } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendada",
  completed: "Realizada",
  cancelled: "Cancelada",
  no_show: "Faltou",
};

function PatientSearchBox({ onSelect }: { onSelect: (item: PatientSearchItem) => void }) {
  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedTerm(term), 300);
    return () => clearTimeout(handle);
  }, [term]);

  const query = useQuery({
    queryKey: ["patients", "search", debouncedTerm],
    queryFn: () => apiClient.get<PatientSearchItem[]>(`/api/v1/patients/search?q=${encodeURIComponent(debouncedTerm)}`),
    enabled: debouncedTerm.trim().length >= 2,
  });

  return (
    <div className="mx-auto max-w-lg">
      <label htmlFor="patient-search" className="mb-1.5 block text-xs font-medium text-ink-muted">
        Buscar paciente por nome ou CPF
      </label>
      <div className="relative">
        <Search aria-hidden size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          id="patient-search"
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Ex.: Maria da Silva"
          className="w-full rounded-md border border-border-default bg-canvas-raised py-2.5 pl-8 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
        />
      </div>
      {debouncedTerm.trim().length >= 2 && (
        <div className="mt-1.5 max-h-72 overflow-y-auto rounded-md border border-border-hairline bg-canvas-surface">
          {query.isLoading && <p className="px-3 py-2.5 text-xs text-ink-faint">Buscando...</p>}
          {query.data && query.data.length === 0 && (
            <p className="px-3 py-2.5 text-xs text-ink-faint">Nenhum paciente encontrado com esse nome/CPF.</p>
          )}
          {query.data && query.data.length > 0 && (
            <ul>
              {query.data.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(item);
                      setTerm("");
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-canvas-raised/60"
                  >
                    <span className="truncate text-sm text-ink">{item.full_name}</span>
                    {item.cpf && <span className="shrink-0 font-mono text-2xs text-ink-faint">{item.cpf}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Ficha do Paciente (Roadmap "Rumo à Nota 9", Fase 4) — pedido direto do
 * usuário: "podemos juntar dados de pessoa física, com os dados de
 * agendamento, com os dados de atendimento... cada conta possui um
 * registro depois da abertura de atendimento, não seria legal termos
 * isto". Uma única tela junta os três, hoje espalhados em telas
 * diferentes (Painel, Agenda, Recurso de glosa). Acessível pela busca
 * aqui mesmo, ou por `?patient_id=` (ver DECISÃO em AgendaRiscoPage.tsx —
 * cada linha da Agenda de risco linka pra cá).
 */
export function PatientFichaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const patientId = searchParams.get("patient_id");

  const { data, isLoading, error } = useQuery({
    queryKey: ["patients", "ficha", patientId],
    queryFn: () => apiClient.get<PatientFicha>(`/api/v1/patients/${patientId}/ficha`),
    enabled: !!patientId,
  });

  function selectPatient(item: PatientSearchItem) {
    setSearchParams({ patient_id: item.id });
  }

  function clearPatient() {
    setSearchParams((params) => {
      params.delete("patient_id");
      return params;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserRound}
        title="Ficha do Paciente"
        subtitle="Pessoa física, agendamento e atendimento/faturamento numa única visão."
        action={
          patientId && (
            <button
              type="button"
              onClick={clearPatient}
              className="flex items-center gap-1 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
            >
              <X aria-hidden size={12} />
              Buscar outro paciente
            </button>
          )
        }
      />

      {!patientId && <PatientSearchBox onSelect={selectPatient} />}

      {patientId && isLoading && <LoadingState variant="table" rows={5} />}
      {patientId && error && <ErrorState message={getApiErrorMessage(error)} />}

      {patientId && data && (
        <div className="space-y-6">
          <div>
            <h2 className="font-serif text-xl font-medium tracking-tightest text-ink">{data.patient.full_name}</h2>
            {data.patient.cpf && <p className="mt-0.5 font-mono text-xs text-ink-faint">CPF {data.patient.cpf}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard colSpan={1} label="Atendimentos" value={String(data.summary.total_appointments)} numericValue={data.summary.total_appointments} format={(n) => String(Math.round(n))} tone="neutral" />
            <KpiCard
              colSpan={1}
              label="Taxa de falta"
              value={data.summary.no_show_rate !== null ? formatPct(data.summary.no_show_rate) : "—"}
              numericValue={data.summary.no_show_rate ?? undefined}
              format={formatPct}
              tone={data.summary.no_show_rate !== null && data.summary.no_show_rate > 0.2 ? "pending" : "neutral"}
            />
            <KpiCard colSpan={1} label="Total faturado" value={formatCurrency(data.summary.total_billed)} numericValue={data.summary.total_billed} format={formatCurrency} tone="neutral" />
            <KpiCard colSpan={1} label="Valor salvo por correção" value={formatCurrency(data.summary.total_value_saved)} numericValue={data.summary.total_value_saved} format={formatCurrency} tone="revenue" />
            <KpiCard
              colSpan={1}
              label="Última visita realizada"
              value={data.summary.last_visit_at ? formatDateTime(data.summary.last_visit_at) : "—"}
              tone="neutral"
            />
          </div>

          <Panel title="Histórico de atendimentos" subtitle="Mais recente primeiro — cada atendimento com os faturamentos gerados a partir dele">
            {data.appointments.length === 0 && (
              <EmptyState icon={<CalendarClock size={17} strokeWidth={1.5} />} message="Nenhum atendimento registrado para este paciente." />
            )}
            {data.appointments.length > 0 && (
              <ul className="divide-y divide-border-hairline">
                {data.appointments.map((appointment) => (
                  <li key={appointment.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="tabular font-mono text-ink">{formatDateTime(appointment.scheduled_at)}</span>
                        <span className="text-ink-faint">·</span>
                        <span className="text-ink-muted">{APPOINTMENT_STATUS_LABELS[appointment.status] ?? appointment.status}</span>
                        {appointment.professional_name && <span className="text-ink-muted">· {appointment.professional_name}</span>}
                        {appointment.insurance_plan_name && <span className="text-ink-muted">· {appointment.insurance_plan_name}</span>}
                      </div>
                      <NoShowBadge level={appointment.no_show_risk_level} />
                    </div>
                    {appointment.billings.length > 0 && (
                      <ul className="mt-2 space-y-1 pl-4">
                        {appointment.billings.map((billing) => (
                          <li key={billing.id} className="flex items-center gap-2 text-2xs text-ink-faint">
                            <span className="tabular font-mono text-ink-muted">{formatCurrency(billing.charged_value)}</span>
                            <span>· {billing.status}</span>
                            <RiskBadge level={billing.denial_risk_level} />
                          </li>
                        ))}
                      </ul>
                    )}
                    {appointment.stock_movements.length > 0 && (
                      <ul className="mt-2 space-y-1 pl-4">
                        {appointment.stock_movements.map((movement) => (
                          <li key={movement.id} className="flex items-center gap-2 text-2xs text-ink-faint">
                            <Package aria-hidden size={11} className="shrink-0 text-ink-faint" />
                            <span className="text-ink-muted">{movement.material_name}</span>
                            <span>· {movement.tipo} de {movement.quantidade}</span>
                            {movement.valor_total_custo !== null && (
                              <span className="tabular font-mono">{formatCurrency(movement.valor_total_custo)}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {appointment.clinical_evolutions.length > 0 && (
                      <ul className="mt-2 space-y-1 pl-4">
                        {appointment.clinical_evolutions.map((evolution) => (
                          <li key={evolution.id} className="flex items-start gap-2 text-2xs text-ink-faint">
                            <FileText aria-hidden size={11} className="mt-0.5 shrink-0 text-ink-faint" />
                            <span>
                              {evolution.professional_name && <span className="text-ink-muted">{evolution.professional_name} · </span>}
                              {evolution.hipotese_diagnostica_principal ?? evolution.conduta_terapeutica_plano ?? "Evolução clínica registrada"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
