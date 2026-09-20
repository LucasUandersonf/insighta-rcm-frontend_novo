import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Plus, Search } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { TextField, SelectField, TextareaField } from "@/components/ui/FormField";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type {
  Appointment,
  PaginatedResponse,
  Patient,
  PreferredTimeWindow,
  Professional,
  WaitlistEntry,
  WaitlistEntryCreateRequest,
  WaitlistStatus,
} from "@/lib/types";

const STATUS_LABELS: Record<WaitlistStatus, string> = {
  aguardando: "Aguardando",
  agendado: "Agendado",
  cancelado: "Cancelado",
};

const STATUS_TONE: Record<WaitlistStatus, BadgeTone> = {
  aguardando: "pending",
  agendado: "revenue",
  cancelado: "neutral",
};

const TIME_WINDOW_LABELS: Record<PreferredTimeWindow, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}

function CreateWaitlistEntryModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [patientId, setPatientId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [preferredTimeWindow, setPreferredTimeWindow] = useState("");
  const [procedureCode, setProcedureCode] = useState("");
  const [notes, setNotes] = useState("");

  const { data: patientsPage } = useQuery({
    queryKey: ["patients", "all"],
    queryFn: () => apiClient.get<PaginatedResponse<Patient>>("/api/v1/patients?limit=200&offset=0"),
    enabled: isOpen,
  });
  const { data: professionals } = useQuery({
    queryKey: ["professionals"],
    queryFn: () => apiClient.get<Professional[]>("/api/v1/professionals"),
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: (payload: WaitlistEntryCreateRequest) => apiClient.post<WaitlistEntry>("/api/v1/waitlist", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
      showSuccess("Paciente adicionado à lista de espera.");
      resetAndClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function resetAndClose() {
    setPatientId("");
    setProfessionalId("");
    setPreferredTimeWindow("");
    setProcedureCode("");
    setNotes("");
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({
      patient_id: patientId,
      professional_id: professionalId || null,
      preferred_time_window: (preferredTimeWindow || null) as PreferredTimeWindow | null,
      procedure_code: procedureCode || null,
      notes: notes || null,
    });
  }

  return (
    <Modal title="Adicionar à lista de espera" isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <SelectField label="Paciente" required value={patientId} onChange={(e) => setPatientId(e.target.value)}>
          <option value="" disabled>
            Selecione um paciente
          </option>
          {(patientsPage?.items ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Profissional (opcional)" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
          <option value="">Qualquer profissional</option>
          {(professionals ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Período preferido (opcional)" value={preferredTimeWindow} onChange={(e) => setPreferredTimeWindow(e.target.value)}>
            <option value="">Qualquer horário</option>
            {(Object.keys(TIME_WINDOW_LABELS) as PreferredTimeWindow[]).map((w) => (
              <option key={w} value={w}>
                {TIME_WINDOW_LABELS[w]}
              </option>
            ))}
          </SelectField>
          <TextField label="Código do procedimento (opcional)" value={procedureCode} onChange={(e) => setProcedureCode(e.target.value)} />
        </div>
        <TextareaField label="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending || !patientId}>
            {mutation.isPending ? "Salvando..." : "Adicionar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResolveWaitlistEntryModal({ entry, onClose }: { entry: WaitlistEntry | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [appointmentId, setAppointmentId] = useState("");

  const { data: appointments } = useQuery({
    queryKey: ["appointments", "by-patient", entry?.patient_id],
    queryFn: () => apiClient.get<Appointment[]>(`/api/v1/appointments/by-patient/${entry!.patient_id}`),
    enabled: entry !== null,
  });

  const mutation = useMutation({
    mutationFn: (id: string) => apiClient.post<WaitlistEntry>(`/api/v1/waitlist/${entry!.id}/resolve`, { appointment_id: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
      showSuccess("Entrada vinculada à consulta e marcada como agendada.");
      setAppointmentId("");
      onClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  return (
    <Modal title={`Vincular consulta — ${entry?.patient_full_name ?? ""}`} isOpen={entry !== null} onClose={onClose}>
      <p className="mb-4 text-xs text-ink-faint">
        Crie a consulta normalmente em Agendamentos, depois selecione ela aqui para marcar esta entrada como resolvida.
      </p>
      <SelectField label="Consulta" required value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
        <option value="" disabled>
          {(appointments ?? []).length === 0 ? "Nenhuma consulta encontrada para este paciente" : "Selecione uma consulta"}
        </option>
        {(appointments ?? []).map((a) => (
          <option key={a.id} value={a.id}>
            {formatDateTime(a.scheduled_at)} — {a.status}
          </option>
        ))}
      </SelectField>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Fechar
        </Button>
        <Button
          type="button"
          disabled={!appointmentId || mutation.isPending}
          onClick={() => mutation.mutate(appointmentId)}
        >
          {mutation.isPending ? "Salvando..." : "Vincular e marcar como agendado"}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Onda 5 do Plano de Ação, item 16 ("agenda avançada") — lista de
 * espera de verdade, ver DECISÃO completa em
 * app/sql/057_waitlist_entries.sql (backend). Mesmo espírito de
 * MarketingSpendPage.tsx/CostEntriesPage.tsx: lançamento manual, sem
 * integração automática (a recepção adiciona/resolve/cancela).
 */
const WAITLIST_PAGE_SIZE = 20;

export function WaitlistPage() {
  const [statusFilter, setStatusFilter] = useState<WaitlistStatus>("aguardando");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [resolvingEntry, setResolvingEntry] = useState<WaitlistEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  // Achado da Auditoria de Prontidão v1: sem busca, uma fila de espera
  // com muitas entradas (ex: alta demanda sazonal) obrigava a recepção
  // a rolar a tela inteira até achar o paciente certo, com um limite
  // fixo de 100 registros que escondia o resto sem nenhum aviso.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  useEffect(() => {
    setOffset(0);
  }, [statusFilter, debouncedSearch]);

  const { data: entriesPage, isLoading, error, refetch } = useQuery({
    queryKey: ["waitlist", statusFilter, debouncedSearch, offset],
    queryFn: () =>
      apiClient.get<PaginatedResponse<WaitlistEntry>>(
        `/api/v1/waitlist?status=${statusFilter}&search=${encodeURIComponent(debouncedSearch)}&limit=${WAITLIST_PAGE_SIZE}&offset=${offset}`
      ),
  });
  const entries = entriesPage?.items ?? [];

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiClient.post<WaitlistEntry>(`/api/v1/waitlist/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
      showSuccess("Entrada cancelada.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarClock}
        title="Lista de espera"
        subtitle="Pacientes esperando vaga — por onde começar a oferecer quando a agenda abrir."
        action={
          <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-1.5">
            <Plus size={14} />
            Adicionar à lista
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {(Object.keys(STATUS_LABELS) as WaitlistStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={
                statusFilter === s
                  ? "rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white"
                  : "rounded-md border border-border-hairline px-3 py-1.5 text-xs text-ink-muted hover:bg-canvas-raised"
              }
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs sm:w-64">
          <Search aria-hidden size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar paciente..."
            aria-label="Buscar paciente na lista de espera"
            className="w-full rounded-md border border-border-default bg-canvas-raised py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
          />
        </div>
      </div>

      <Panel>
        {isLoading && <LoadingState variant="table" rows={4} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
        {!isLoading && !error && entries.length === 0 && (
          <EmptyState
            icon={<CalendarClock size={17} strokeWidth={1.5} />}
            message={
              debouncedSearch
                ? `Nenhum paciente encontrado para "${debouncedSearch}" com status "${STATUS_LABELS[statusFilter]}".`
                : `Nenhuma entrada com status "${STATUS_LABELS[statusFilter]}".`
            }
          />
        )}
        {!isLoading && entries.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Paciente</th>
                <th className="px-4 py-2.5 font-medium">Profissional</th>
                <th className="px-4 py-2.5 font-medium">Período</th>
                <th className="px-4 py-2.5 font-medium">Desde</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                  <td className="px-4 py-2.5 text-ink">{entry.patient_full_name}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{entry.professional_full_name ?? "Qualquer profissional"}</td>
                  <td className="px-4 py-2.5 text-ink-muted">
                    {entry.preferred_time_window ? TIME_WINDOW_LABELS[entry.preferred_time_window] : "Qualquer horário"}
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{formatDateTime(entry.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONE[entry.status]}>{STATUS_LABELS[entry.status]}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {entry.status === "aguardando" && (
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="xs" onClick={() => setResolvingEntry(entry)}>
                          Vincular consulta
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-denied"
                          onClick={() => cancelMutation.mutate(entry.id)}
                          disabled={cancelMutation.isPending}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {entriesPage && entriesPage.total > 0 && (
          <Pagination total={entriesPage.total} limit={WAITLIST_PAGE_SIZE} offset={offset} onOffsetChange={setOffset} />
        )}
      </Panel>

      <CreateWaitlistEntryModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      <ResolveWaitlistEntryModal entry={resolvingEntry} onClose={() => setResolvingEntry(null)} />
    </div>
  );
}
