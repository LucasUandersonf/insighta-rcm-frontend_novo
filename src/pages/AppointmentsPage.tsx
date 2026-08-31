import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, SelectField } from "@/components/ui/FormField";
import { NoShowBadge } from "@/components/ui/NoShowBadge";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type { Appointment, AppointmentCreateRequest, PaginatedResponse, Patient, Professional } from "@/lib/types";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendada",
  completed: "Realizada",
  cancelled: "Cancelada",
  no_show: "Faltou",
};

function CreateAppointmentModal({
  isOpen,
  onClose,
  patients,
  professionals,
  preselectedPatientId,
}: {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  professionals: Professional[];
  preselectedPatientId: string;
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [patientId, setPatientId] = useState(preselectedPatientId);
  const [professionalId, setProfessionalId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [procedureCode, setProcedureCode] = useState("");
  const [cidCode, setCidCode] = useState("");

  const mutation = useMutation({
    mutationFn: (payload: AppointmentCreateRequest) => apiClient.post<Appointment>("/api/v1/appointments", payload),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["appointments", created.patient_id] });
      // O risco de falta já vem calculado na resposta — vale a pena o
      // usuário ver isso imediatamente, não só depois de recarregar a lista.
      const riskNote = created.no_show_risk_level && created.no_show_risk_level !== "indeterminado"
        ? ` Risco de falta: ${created.no_show_risk_level}.`
        : "";
      showSuccess(`Consulta agendada com sucesso.${riskNote}`);
      resetAndClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function resetAndClose() {
    setProfessionalId("");
    setScheduledAt("");
    setDurationMinutes("30");
    setProcedureCode("");
    setCidCode("");
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({
      patient_id: patientId,
      professional_id: professionalId || null,
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_minutes: durationMinutes ? Number(durationMinutes) : null,
      procedure_code: procedureCode || null,
      cid_code: cidCode || null,
    });
  }

  return (
    <Modal title="Nova consulta" isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <SelectField label="Paciente" required value={patientId} onChange={(e) => setPatientId(e.target.value)}>
          <option value="" disabled>
            Selecione um paciente
          </option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </SelectField>

        <SelectField label="Profissional (opcional)" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
          <option value="">Sem profissional definido</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </SelectField>

        <TextField
          label="Data e horário"
          type="datetime-local"
          required
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
        <TextField
          label="Duração (minutos)"
          type="number"
          min={1}
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
        />
        <TextField label="Código do procedimento" value={procedureCode} onChange={(e) => setProcedureCode(e.target.value)} />
        <TextField
          label="CID"
          value={cidCode}
          onChange={(e) => setCidCode(e.target.value)}
        />

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending || !patientId}>
            {mutation.isPending ? "Agendando..." : "Agendar consulta"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function AppointmentsPage() {
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // GET /api/v1/patients devolve o envelope paginado
  // {items, total, limit, offset} (ver app/api/v1/endpoints/patients.py) —
  // NÃO um array bruto. Consumir isso como Patient[] direto (como esta tela
  // fazia antes) resulta em `patients.map is not a function` e derruba a
  // página inteira em produção. limit=200 (teto do endpoint) cobre o
  // seletor por ora; para clínicas com mais de 200 pacientes isto precisa
  // virar um combobox com busca no servidor antes do GA (ver auditoria).
  const { data: patientsPage, isLoading: patientsLoading } = useQuery({
    queryKey: ["patients", "for-appointment-selector"],
    queryFn: () => apiClient.get<PaginatedResponse<Patient>>("/api/v1/patients?limit=200&offset=0"),
  });
  const patients = patientsPage?.items;

  const { data: professionals } = useQuery({
    queryKey: ["professionals"],
    queryFn: () => apiClient.get<Professional[]>("/api/v1/professionals"),
  });

  const {
    data: appointments,
    isLoading: appointmentsLoading,
    error: appointmentsError,
  } = useQuery({
    queryKey: ["appointments", selectedPatientId],
    queryFn: () => apiClient.get<Appointment[]>(`/api/v1/appointments/by-patient/${selectedPatientId}`),
    enabled: !!selectedPatientId, // só busca depois que um paciente foi escolhido
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">Consultas</h1>
        <Button onClick={() => setIsModalOpen(true)} disabled={patientsLoading || (patients ?? []).length === 0}>
          + Nova consulta
        </Button>
      </div>

      <div className="mb-4 max-w-xs">
        <SelectField
          label="Ver consultas do paciente"
          value={selectedPatientId}
          onChange={(e) => setSelectedPatientId(e.target.value)}
          disabled={patientsLoading}
        >
          <option value="">Selecione um paciente</option>
          {(patients ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </SelectField>
      </div>

      <Panel>
        {!selectedPatientId && <EmptyState message="Selecione um paciente acima para ver as consultas dele." />}
        {selectedPatientId && appointmentsLoading && <LoadingState />}
        {selectedPatientId && appointmentsError && <ErrorState message={getApiErrorMessage(appointmentsError)} />}
        {selectedPatientId && !appointmentsLoading && (appointments ?? []).length === 0 && (
          <EmptyState message="Este paciente ainda não tem consultas registradas." />
        )}
        {selectedPatientId && !appointmentsLoading && (appointments ?? []).length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Procedimento</th>
                <th className="px-4 py-2 font-medium">CID</th>
                <th className="px-4 py-2 font-medium">Risco de falta</th>
              </tr>
            </thead>
            <tbody>
              {(appointments ?? [])
                .slice()
                .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
                .map((a) => (
                  <tr key={a.id} className="border-b border-border-subtle last:border-0 hover:bg-canvas-raised">
                    <td className="tabular px-4 py-2.5 font-mono text-ink">{formatDateTime(a.scheduled_at)}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{STATUS_LABELS[a.status] ?? a.status}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{a.procedure_code ?? "—"}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{a.cid_code ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <NoShowBadge level={a.no_show_risk_level} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </Panel>

      <CreateAppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        patients={patients ?? []}
        professionals={professionals ?? []}
        preselectedPatientId={selectedPatientId}
      />
    </div>
  );
}
