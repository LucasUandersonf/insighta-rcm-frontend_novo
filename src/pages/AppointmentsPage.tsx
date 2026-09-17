import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Copy, Crown, Pencil, Plus, ShieldOff, Star, UserRound, UserPlus } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, SelectField } from "@/components/ui/FormField";
import { NoShowBadge } from "@/components/ui/NoShowBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import type {
  Appointment,
  AppointmentCreateRequest,
  AppointmentUpdateRequest,
  Local,
  PaginatedResponse,
  Patient,
  PatientCreateRequest,
  PatientUpdateRequest,
  PreferredTimeWindow,
  Professional,
  SatisfactionLinkResponse,
  TipoPaciente,
  VisitIntentTag,
} from "@/lib/types";

const PREFERRED_TIME_WINDOW_LABELS: Record<PreferredTimeWindow, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

// Fase 4 do plano de adequação ao fluxo real de mercado — vocabulário
// FECHADO idêntico ao backend (ver TIPO_PACIENTE_VALUES em
// app/models/appointment.py).
const TIPO_PACIENTE_LABELS: Record<TipoPaciente, string> = {
  ambulatorial: "Ambulatorial",
  internacao: "Internação",
  pronto_socorro: "Pronto-socorro",
};

// "Mapa de Dados Insighta" — Domínio Pós-atendimento (Onda 1).
const VISIT_INTENT_TAG_LABELS: Record<VisitIntentTag, string> = {
  rotina: "Rotina",
  retorno: "Retorno",
  avaliacao: "Avaliação",
  urgencia: "Urgência",
};

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

const ADDON_RESULT_LABELS: Record<"aceito" | "recusado", string> = {
  aceito: "Aceito",
  recusado: "Recusado",
};

/**
 * "Mapa de Dados Insighta" — Domínio Paciente (Onda 1): não existia
 * NENHUMA tela de cadastro manual de paciente no frontend (o dado hoje
 * chega só pela ingestão em massa) — sem isso, os 4 campos relacionais
 * novos (indicação, consentimento, horário preferido, CEP) nunca
 * teriam onde ser capturados de verdade, mesmo com o backend pronto.
 * Cabe aqui, ao lado do seletor de paciente já existente, exatamente o
 * ponto de captura que o mapa de dados recomenda: "cadastro ou primeiro
 * agendamento".
 */
function NewPatientModal({
  isOpen,
  onClose,
  patients,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  onCreated: (patientId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [consent, setConsent] = useState(false);
  const [preferredWindow, setPreferredWindow] = useState("");
  const [zipCode, setZipCode] = useState("");

  const mutation = useMutation({
    mutationFn: (payload: PatientCreateRequest) => apiClient.post<Patient>("/api/v1/patients", payload),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      showSuccess(`Paciente ${created.full_name} cadastrado.`);
      onCreated(created.id);
      resetAndClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function resetAndClose() {
    setFullName("");
    setCpf("");
    setReferredBy("");
    setConsent(false);
    setPreferredWindow("");
    setZipCode("");
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({
      full_name: fullName,
      cpf: cpf || null,
      referred_by_patient_id: referredBy || null,
      communication_consent: consent,
      preferred_time_window: (preferredWindow || null) as PreferredTimeWindow | null,
      zip_code: zipCode || null,
    });
  }

  return (
    <Modal title="Novo paciente" isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <TextField label="Nome completo" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <TextField label="CPF (opcional)" value={cpf} onChange={(e) => setCpf(e.target.value)} />
        {patients.length > 0 && (
          <SelectField label="Quem indicou (opcional)" value={referredBy} onChange={(e) => setReferredBy(e.target.value)}>
            <option value="">Ninguém indicou / não sei</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </SelectField>
        )}
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Horário preferido (opcional)"
            value={preferredWindow}
            onChange={(e) => setPreferredWindow(e.target.value)}
          >
            <option value="">Não informado</option>
            {Object.entries(PREFERRED_TIME_WINDOW_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <TextField label="CEP (opcional)" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="00000-000" />
        </div>
        <label className="mb-4 flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 accent-[hsl(var(--accent))]"
          />
          Paciente autoriza contato (WhatsApp/e-mail) para campanhas e lembretes — LGPD, base legal de consentimento.
        </label>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending || !fullName}>
            {mutation.isPending ? "Cadastrando..." : "Cadastrar paciente"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * "Mapa de Dados Insighta" — Domínio Paciente (Onda 1): os 4 campos
 * relacionais raramente são conhecidos no primeiro cadastro (um
 * paciente que veio de uma reimportação em massa nunca teve chance de
 * informar CEP/horário preferido). Este modal completa depois, via
 * PATCH /patients/{id} — mesmo contrato parcial de
 * ProfessionalUpdateRequest: só o que for alterado aqui é de fato
 * enviado, nunca limpa um campo já preenchido de volta pra vazio.
 */
function EditPatientContactModal({
  isOpen,
  onClose,
  patient,
  patients,
}: {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  patients: Patient[];
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [referredBy, setReferredBy] = useState("");
  const [consent, setConsent] = useState<"" | "true" | "false">("");
  const [preferredWindow, setPreferredWindow] = useState("");
  const [zipCode, setZipCode] = useState("");

  useEffect(() => {
    if (!patient) return;
    setReferredBy(patient.referred_by_patient_id ?? "");
    setConsent(patient.communication_consent === null ? "" : patient.communication_consent ? "true" : "false");
    setPreferredWindow(patient.preferred_time_window ?? "");
    setZipCode(patient.zip_code ?? "");
  }, [patient]);

  const mutation = useMutation({
    mutationFn: (payload: PatientUpdateRequest) => apiClient.patch<Patient>(`/api/v1/patients/${patient!.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      showSuccess("Dados do paciente atualizados.");
      onClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!patient) return;
    mutation.mutate({
      referred_by_patient_id: referredBy || null,
      communication_consent: consent === "" ? null : consent === "true",
      preferred_time_window: (preferredWindow || null) as PreferredTimeWindow | null,
      zip_code: zipCode || null,
    });
  }

  if (!patient) return null;

  return (
    <Modal title={`Dados de contato — ${patient.full_name}`} isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {patients.length > 0 && (
          <SelectField label="Quem indicou (opcional)" value={referredBy} onChange={(e) => setReferredBy(e.target.value)}>
            <option value="">Ninguém indicou / não sei</option>
            {patients
              .filter((p) => p.id !== patient.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
          </SelectField>
        )}
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Horário preferido (opcional)"
            value={preferredWindow}
            onChange={(e) => setPreferredWindow(e.target.value)}
          >
            <option value="">Não informado</option>
            {Object.entries(PREFERRED_TIME_WINDOW_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <TextField label="CEP (opcional)" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="00000-000" />
        </div>
        <SelectField
          label="Autoriza contato (LGPD)"
          value={consent}
          onChange={(e) => setConsent(e.target.value as "" | "true" | "false")}
        >
          <option value="">Ainda não perguntado</option>
          <option value="true">Sim, autoriza</option>
          <option value="false">Não, recusou</option>
        </SelectField>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CreateAppointmentModal({
  isOpen,
  onClose,
  patients,
  professionals,
  locais,
  preselectedPatientId,
}: {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  professionals: Professional[];
  locais: Local[];
  preselectedPatientId: string;
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [patientId, setPatientId] = useState(preselectedPatientId);
  const [professionalId, setProfessionalId] = useState("");
  const [localId, setLocalId] = useState("");
  const [tipoPaciente, setTipoPaciente] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [procedureCode, setProcedureCode] = useState("");
  const [cidCode, setCidCode] = useState("");
  const [visitIntentTag, setVisitIntentTag] = useState("");
  // Onda 5 do Plano de Ação, item 15 — já conhecido na hora de marcar
  // quando é um encaixe explícito fora da grade normal.
  const [isSqueezeIn, setIsSqueezeIn] = useState(false);
  const selectedPatient = patients.find((p) => p.id === patientId) ?? null;

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
    setLocalId("");
    setTipoPaciente("");
    setScheduledAt("");
    setDurationMinutes("30");
    setProcedureCode("");
    setCidCode("");
    setVisitIntentTag("");
    setIsSqueezeIn(false);
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({
      patient_id: patientId,
      professional_id: professionalId || null,
      local_id: localId || null,
      tipo_paciente: (tipoPaciente || null) as TipoPaciente | null,
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_minutes: durationMinutes ? Number(durationMinutes) : null,
      procedure_code: procedureCode || null,
      cid_code: cidCode || null,
      visit_intent_tag: (visitIntentTag || null) as VisitIntentTag | null,
      is_squeeze_in: isSqueezeIn,
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
              {p.is_vip ? " ★ VIP" : ""}
            </option>
          ))}
        </SelectField>
        {/* "Equilíbrio Insighta" (Balanced Scorecard, perna Cliente) — a
            recepção é avisada em tempo real, no exato momento de marcar,
            não só depois de criar a consulta (ver DECISÃO em
            PatientService.list_patients_paginated, backend). */}
        {selectedPatient?.is_vip && (
          <p className="mb-4 -mt-2 flex items-center gap-1.5 rounded-md border border-tier1/25 bg-tier1-bg px-3 py-2 text-xs text-ink">
            <Crown aria-hidden size={13} className="text-tier1" />
            Paciente de alto valor ({selectedPatient.vip_reasons.join(", ")}) — capricha no atendimento.
          </p>
        )}

        <SelectField label="Profissional (opcional)" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
          <option value="">Sem profissional definido</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </SelectField>

        {/* Fase 4 do plano de adequação ao fluxo real de mercado — ver
            DECISÃO em app/sql/018_locais_tipo_paciente.sql (backend). */}
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Local (opcional)" value={localId} onChange={(e) => setLocalId(e.target.value)}>
            <option value="">Não informado</option>
            {locais.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Tipo de paciente (opcional)"
            value={tipoPaciente}
            onChange={(e) => setTipoPaciente(e.target.value)}
          >
            <option value="">Não informado</option>
            {Object.entries(TIPO_PACIENTE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Código do procedimento" value={procedureCode} onChange={(e) => setProcedureCode(e.target.value)} />
          <TextField label="CID" value={cidCode} onChange={(e) => setCidCode(e.target.value)} />
        </div>
        <SelectField
          label="Motivo do agendamento (opcional)"
          value={visitIntentTag}
          onChange={(e) => setVisitIntentTag(e.target.value)}
        >
          <option value="">Não informado</option>
          {Object.entries(VISIT_INTENT_TAG_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        {/* Onda 5 do Plano de Ação, item 15 — alimenta o gráfico "Taxa de
            encaixe por dia da semana" (Agenda & Capacidade). */}
        <label className="mb-4 flex items-center gap-2 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={isSqueezeIn}
            onChange={(e) => setIsSqueezeIn(e.target.checked)}
            className="accent-[hsl(var(--accent))]"
          />
          Este agendamento é um encaixe (fora da grade normal)
        </label>

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

/**
 * "Mapa de Dados Insighta" — Domínio Pós-atendimento (Onda 2): fecha DUAS
 * lacunas de uma vez. (1) PATCH /appointments/{id} já existia no backend
 * desde a correção do fluxo Agendamento -> Atendimento, mas nenhuma tela
 * chamava esse endpoint — a recepção não tinha como marcar falta/realizada
 * nem preencher procedimento/CID depois da consulta. (2) o funil de upsell
 * (o que foi OFERECIDO no checkout, não só o que virou receita) — pilar
 * Crescimento ativo/upsell, ver DECISÃO em 050_appointment_addon_upsell.sql.
 * addon_declined só é enviado se addon_offered_procedure tiver algum valor
 * (nesta edição ou numa anterior já salva) — mesma regra do backend.
 */
function RegisterVisitModal({
  isOpen,
  onClose,
  appointment,
  locais,
}: {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  locais: Local[];
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [status, setStatus] = useState("");
  const [procedureCode, setProcedureCode] = useState("");
  const [cidCode, setCidCode] = useState("");
  const [localId, setLocalId] = useState("");
  const [tipoPaciente, setTipoPaciente] = useState("");
  const [addonOfferedProcedure, setAddonOfferedProcedure] = useState("");
  const [addonResult, setAddonResult] = useState<"" | "aceito" | "recusado">("");

  useEffect(() => {
    if (!appointment) return;
    setStatus(appointment.status);
    setProcedureCode(appointment.procedure_code ?? "");
    setCidCode(appointment.cid_code ?? "");
    setLocalId(appointment.local_id ?? "");
    setTipoPaciente(appointment.tipo_paciente ?? "");
    setAddonOfferedProcedure(appointment.addon_offered_procedure ?? "");
    setAddonResult(appointment.addon_declined === null ? "" : appointment.addon_declined ? "recusado" : "aceito");
  }, [appointment]);

  const mutation = useMutation({
    mutationFn: (payload: AppointmentUpdateRequest) =>
      apiClient.patch<Appointment>(`/api/v1/appointments/${appointment!.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", appointment!.patient_id] });
      showSuccess("Atendimento atualizado.");
      onClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!appointment) return;
    mutation.mutate({
      status: status || null,
      procedure_code: procedureCode || null,
      cid_code: cidCode || null,
      local_id: localId || null,
      tipo_paciente: (tipoPaciente || null) as TipoPaciente | null,
      addon_offered_procedure: addonOfferedProcedure || null,
      addon_declined: addonResult === "" ? null : addonResult === "recusado",
    });
  }

  if (!appointment) return null;

  return (
    <Modal title="Registrar atendimento" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Código do procedimento" value={procedureCode} onChange={(e) => setProcedureCode(e.target.value)} />
          <TextField label="CID" value={cidCode} onChange={(e) => setCidCode(e.target.value)} />
        </div>
        {/* Fase 4 do plano de adequação ao fluxo real de mercado — nem
            sempre conhecido na hora de marcar, editável aqui também. */}
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Local (opcional)" value={localId} onChange={(e) => setLocalId(e.target.value)}>
            <option value="">Não informado</option>
            {locais.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Tipo de paciente (opcional)"
            value={tipoPaciente}
            onChange={(e) => setTipoPaciente(e.target.value)}
          >
            <option value="">Não informado</option>
            {Object.entries(TIPO_PACIENTE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField
          label="Procedimento/serviço oferecido no checkout (opcional)"
          placeholder="Ex.: Limpeza de pele, drenagem linfática..."
          value={addonOfferedProcedure}
          onChange={(e) => setAddonOfferedProcedure(e.target.value)}
        />
        <SelectField
          label="Resultado da oferta"
          value={addonResult}
          onChange={(e) => setAddonResult(e.target.value as "" | "aceito" | "recusado")}
          disabled={!addonOfferedProcedure}
        >
          <option value="">{addonOfferedProcedure ? "Ainda não sei" : "Nada oferecido / não perguntado"}</option>
          {Object.entries(ADDON_RESULT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * "Mapa de Dados Insighta" — Domínio Pós-atendimento (Onda 2), pilar
 * Satisfação/NPS: mostra o link público gerado por POST /appointments/
 * {id}/satisfaction-link, pronto para a recepção copiar e enviar
 * manualmente ao paciente (WhatsApp Web, SMS) — ver DECISÃO completa em
 * 052_appointment_satisfaction.sql (backend) sobre por que não é uma
 * mensagem automática.
 */
function SatisfactionLinkModal({
  link,
  onClose,
}: {
  link: SatisfactionLinkResponse | null;
  onClose: () => void;
}) {
  const { showSuccess, showError } = useToast();

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      showSuccess("Link copiado.");
    } catch {
      showError("Não foi possível copiar o link automaticamente — selecione e copie manualmente.");
    }
  }

  return (
    <Modal title="Link de avaliação" isOpen={link !== null} onClose={onClose}>
      {link && (
        <div>
          <p className="mb-3 text-xs leading-relaxed text-ink-muted">
            Envie este link para o paciente pelo canal que preferir (WhatsApp, SMS). Ele é de uso único e expira em{" "}
            {formatDateTime(link.expires_at)}.
          </p>
          <div className="mb-4 flex items-center gap-2">
            <input
              readOnly
              value={link.url}
              onFocus={(e) => e.target.select()}
              className="w-full rounded-md border border-border-default bg-canvas-raised px-3 py-2 text-xs text-ink"
            />
            <Button type="button" variant="secondary" size="xs" onClick={handleCopy} className="flex shrink-0 items-center gap-1">
              <Copy size={12} />
              Copiar
            </Button>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// Direito de eliminação do titular (LGPD art. 18, VI) — mesmo RBAC do
// backend (patients.py/_CAN_ANONYMIZE: só admin/owner, ação irreversível
// demais para ficar aberta à recepção).
const _CAN_ANONYMIZE_ROLES = new Set(["admin", "owner"]);

export function AppointmentsPage() {
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState(false);
  const [registeringAppointment, setRegisteringAppointment] = useState<Appointment | null>(null);
  const [satisfactionLink, setSatisfactionLink] = useState<SatisfactionLinkResponse | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError: showSatisfactionLinkError } = useToast();

  const satisfactionLinkMutation = useMutation({
    mutationFn: (appointmentId: string) =>
      apiClient.post<SatisfactionLinkResponse>(`/api/v1/appointments/${appointmentId}/satisfaction-link`),
    onSuccess: (data) => setSatisfactionLink(data),
    onError: (err) => showSatisfactionLinkError(getApiErrorMessage(err)),
  });

  const anonymizeMutation = useMutation({
    mutationFn: (patientId: string) => apiClient.post<Patient>(`/api/v1/patients/${patientId}/anonymize`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      showSuccess("Paciente anonimizado.");
    },
    onError: (err) => showSatisfactionLinkError(getApiErrorMessage(err)),
  });

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
  const selectedPatient = (patients ?? []).find((p) => p.id === selectedPatientId) ?? null;
  const canAnonymize = Boolean(user && _CAN_ANONYMIZE_ROLES.has(user.role));

  const { data: professionals } = useQuery({
    queryKey: ["professionals"],
    queryFn: () => apiClient.get<Professional[]>("/api/v1/professionals"),
  });

  // Fase 4 do plano de adequação ao fluxo real de mercado — ativos
  // apenas (mesmo critério de /professionals acima: não faz sentido
  // oferecer um local desativado num agendamento novo).
  const { data: locais } = useQuery({
    queryKey: ["locais"],
    queryFn: () => apiClient.get<Local[]>("/api/v1/locais"),
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
    <div className="space-y-6">
      <PageHeader
        icon={CalendarCheck}
        title="Consultas"
        subtitle="Agenda de consultas por paciente e risco preditivo de falta."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setIsNewPatientModalOpen(true)}
              disabled={patientsLoading}
              className="flex items-center gap-1.5"
            >
              <UserPlus size={14} />
              Novo paciente
            </Button>
            <Button onClick={() => setIsModalOpen(true)} disabled={patientsLoading || (patients ?? []).length === 0} className="flex items-center gap-1.5">
              <Plus size={14} />
              Nova consulta
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="max-w-xs flex-1">
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
        {selectedPatientId && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="mb-4 flex items-center gap-1.5"
            onClick={() => setIsEditPatientModalOpen(true)}
          >
            <Pencil size={12} />
            Dados de contato
          </Button>
        )}
        {/* Direito de eliminação do titular (LGPD art. 18, VI) — ver
            DECISÃO em PatientService.anonymize_patient (backend):
            irreversível, admin/owner apenas. Um paciente já anonimizado
            não mostra o botão de novo (não existe endpoint de
            "desanonimizar"). */}
        {selectedPatientId && canAnonymize && selectedPatient && !selectedPatient.anonymized_at && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="mb-4 flex items-center gap-1.5 text-denied"
            disabled={anonymizeMutation.isPending}
            onClick={() => {
              if (
                confirm(
                  `Anonimizar ${selectedPatient.full_name}? Isso apaga nome, CPF e data de nascimento permanentemente — não pode ser desfeito.`
                )
              ) {
                anonymizeMutation.mutate(selectedPatient.id);
              }
            }}
          >
            <ShieldOff size={12} />
            Anonimizar (LGPD)
          </Button>
        )}
        {selectedPatientId && selectedPatient?.anonymized_at && (
          <span className="mb-4 text-2xs text-ink-faint">Paciente anonimizado em {formatDateTime(selectedPatient.anonymized_at)}.</span>
        )}
      </div>

      <Panel
        glow={
          (appointments ?? []).some((a) => a.no_show_risk_level === "alto")
            ? "denied"
            : (appointments ?? []).some((a) => a.no_show_risk_level === "medio")
              ? "pending"
              : "none"
        }
      >
        {!selectedPatientId && <EmptyState icon={<UserRound size={17} strokeWidth={1.5} />} message="Selecione um paciente acima para ver as consultas dele." />}
        {selectedPatientId && appointmentsLoading && <LoadingState />}
        {selectedPatientId && appointmentsError && <ErrorState message={getApiErrorMessage(appointmentsError)} />}
        {selectedPatientId && !appointmentsLoading && (appointments ?? []).length === 0 && (
          <EmptyState icon={<CalendarCheck size={17} strokeWidth={1.5} />} message="Este paciente ainda não tem consultas registradas." />
        )}
        {selectedPatientId && !appointmentsLoading && (appointments ?? []).length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Procedimento</th>
                <th className="px-4 py-2.5 font-medium">CID</th>
                <th className="px-4 py-2.5 font-medium">Risco de falta</th>
                <th className="px-4 py-2.5 font-medium">Satisfação</th>
                <th className="px-4 py-2.5 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(appointments ?? [])
                .slice()
                .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
                .map((a) => (
                  <tr key={a.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                    <td className="tabular px-4 py-2.5 font-mono text-ink">{formatDateTime(a.scheduled_at)}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{STATUS_LABELS[a.status] ?? a.status}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{a.procedure_code ?? "—"}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{a.cid_code ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <NoShowBadge level={a.no_show_risk_level} />
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">
                      {a.visit_satisfaction_score !== null ? (
                        <span className="inline-flex items-center gap-1">
                          <Star size={12} className="fill-pending text-pending" />
                          {a.visit_satisfaction_score}/5
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="flex items-center gap-1.5"
                          onClick={() => setRegisteringAppointment(a)}
                        >
                          <Pencil size={12} />
                          Registrar atendimento
                        </Button>
                        {a.status === "completed" && a.visit_satisfaction_score === null && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="flex items-center gap-1.5"
                            disabled={satisfactionLinkMutation.isPending}
                            onClick={() => satisfactionLinkMutation.mutate(a.id)}
                          >
                            <Star size={12} />
                            Link de avaliação
                          </Button>
                        )}
                      </div>
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
        locais={locais ?? []}
        preselectedPatientId={selectedPatientId}
      />

      <NewPatientModal
        isOpen={isNewPatientModalOpen}
        onClose={() => setIsNewPatientModalOpen(false)}
        patients={patients ?? []}
        onCreated={(patientId) => setSelectedPatientId(patientId)}
      />

      <EditPatientContactModal
        isOpen={isEditPatientModalOpen}
        onClose={() => setIsEditPatientModalOpen(false)}
        patient={(patients ?? []).find((p) => p.id === selectedPatientId) ?? null}
        patients={patients ?? []}
      />

      <RegisterVisitModal
        isOpen={registeringAppointment !== null}
        onClose={() => setRegisteringAppointment(null)}
        appointment={registeringAppointment}
        locais={locais ?? []}
      />

      <SatisfactionLinkModal link={satisfactionLink} onClose={() => setSatisfactionLink(null)} />
    </div>
  );
}
