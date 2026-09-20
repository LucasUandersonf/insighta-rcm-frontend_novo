import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CalendarClock, Pencil, Plus, X } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TextField, SelectField } from "@/components/ui/FormField";
import { FilterBar } from "@/components/ui/FilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type {
  AvailabilityBlock,
  ContractType,
  PlannedAbsence,
  PlannedAbsenceCreateRequest,
  Professional,
  ProfessionalCreateRequest,
  ProfessionalUpdateRequest,
} from "@/lib/types";

// "Mapa de Dados Insighta" — Domínio Profissional (Onda 2).
const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  clt: "CLT",
  pj: "PJ",
  autonomo: "Autônomo",
  cooperado: "Cooperado",
};

// Módulo trazido de volta especificamente para isto — ver DECISÃO em
// app/services/normalization_service.py::_get_or_create_professional
// (backend): hoje o profissional em si já entra sozinho pela ingestão
// (extraído da própria linha de faturamento), mas SEMPRE sem grade
// semanal — um CSV de faturamento não carrega horário de atendimento.
// Sem uma tela pra configurar isso, Agenda & Capacidade fica
// estruturalmente inviável para qualquer clínica que opere só via
// ingestão de arquivo. Não é uma reintrodução do CRUD operacional de
// Profissionais removido no reposicionamento de produto (App.tsx) —
// é configuração de um parâmetro de cálculo deste próprio produto, que
// não tem (nem pode ter) outra fonte de dado.
const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatDateBR(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`)
  );
}

function displayTime(apiTime: string): string {
  return apiTime.slice(0, 5); // "08:00:00" -> "08:00"
}

function toApiTime(displayValue: string): string {
  return displayValue.length === 5 ? `${displayValue}:00` : displayValue;
}

function blockLabel(block: AvailabilityBlock): string {
  return `${WEEKDAY_SHORT[block.weekday]} ${displayTime(block.start_time)}–${displayTime(block.end_time)}`;
}

/** Editor de grade semanal — mesmo padrão de "lista de linhas com
 * adicionar/remover" já usado em ModalConferenciaIA (ContractsPage) e
 * no formulário de contrato manual: cada bloco é dia da semana + início
 * + fim, sem persistir nada sozinho — quem grava é o formulário pai,
 * de uma vez, no submit. */
function AvailabilityEditor({ blocks, onChange }: { blocks: AvailabilityBlock[]; onChange: (blocks: AvailabilityBlock[]) => void }) {
  function updateBlock(index: number, patch: Partial<AvailabilityBlock>) {
    onChange(blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }
  function removeBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }
  function addBlock() {
    onChange([...blocks, { weekday: 1, start_time: "08:00:00", end_time: "12:00:00" }]);
  }

  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-xs font-medium text-ink-muted">Grade semanal de disponibilidade</label>
      {blocks.length === 0 && (
        <p className="mb-2 rounded-md border border-dashed border-border-default bg-canvas-raised/40 px-3 py-2.5 text-2xs text-ink-faint">
          Nenhum bloco configurado — sem grade, este profissional não entra no cálculo de ocupação/ociosidade da agenda.
        </p>
      )}
      {blocks.length > 0 && (
        <div className="mb-2 space-y-2">
          {blocks.map((block, index) => (
            <div key={index} className="grid grid-cols-[1fr_auto_auto_28px] items-center gap-2">
              <select
                value={block.weekday}
                onChange={(e) => updateBlock(index, { weekday: Number(e.target.value) })}
                className="w-full appearance-none rounded-md border border-border-default bg-canvas-raised px-2.5 py-1.5 text-xs text-ink transition-colors focus:border-accent focus:outline-none"
              >
                {WEEKDAY_LABELS.map((label, wd) => (
                  <option key={wd} value={wd}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={displayTime(block.start_time)}
                onChange={(e) => updateBlock(index, { start_time: toApiTime(e.target.value) })}
                className="rounded-md border border-border-default bg-canvas-raised px-2 py-1.5 text-xs text-ink transition-colors focus:border-accent focus:outline-none"
              />
              <input
                type="time"
                value={displayTime(block.end_time)}
                onChange={(e) => updateBlock(index, { end_time: toApiTime(e.target.value) })}
                className="rounded-md border border-border-default bg-canvas-raised px-2 py-1.5 text-xs text-ink transition-colors focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeBlock(index)}
                aria-label="Remover bloco"
                className="flex h-7 w-7 items-center justify-center text-denied transition-colors hover:text-denied/70"
              >
                <X size={13} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}
      <Button type="button" variant="ghost" size="xs" onClick={addBlock}>
        + Adicionar bloco
      </Button>
    </div>
  );
}

/**
 * "Mapa de Dados Insighta" — Domínio Profissional (Onda 1): ausência
 * futura planejada (férias, licença) — DIFERENTE de AvailabilityEditor
 * acima: cada ausência é lançada/removida com uma chamada própria
 * (POST/DELETE imediatos), não acumulada em estado local até o submit
 * do formulário inteiro — mesmo raciocínio do backend
 * (add_planned_absence/remove_planned_absence, nunca um "substituir
 * tudo"): uma nova ausência nunca deveria apagar uma já cadastrada.
 * Por isso só aparece editando um profissional que JÁ EXISTE (precisa
 * de um id pra anexar a ausência).
 */
function PlannedAbsencesEditor({
  professionalId,
  absences,
  onChange,
}: {
  professionalId: string;
  absences: PlannedAbsence[];
  onChange: (absences: PlannedAbsence[]) => void;
}) {
  const { showSuccess, showError } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [absenceToRemove, setAbsenceToRemove] = useState<PlannedAbsence | null>(null);

  const addMutation = useMutation({
    mutationFn: (payload: PlannedAbsenceCreateRequest) =>
      apiClient.post<PlannedAbsence>(`/api/v1/professionals/${professionalId}/planned-absences`, payload),
    onSuccess: (created) => {
      onChange([...absences, created].sort((a, b) => a.start_date.localeCompare(b.start_date)));
      setStartDate("");
      setEndDate("");
      setReason("");
      showSuccess("Ausência registrada.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (absenceId: string) =>
      apiClient.delete(`/api/v1/professionals/${professionalId}/planned-absences/${absenceId}`),
    onSuccess: (_data, absenceId) => {
      onChange(absences.filter((a) => a.id !== absenceId));
      setAbsenceToRemove(null);
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleAdd() {
    if (!startDate || !endDate) return;
    addMutation.mutate({ start_date: startDate, end_date: endDate, reason: reason || null });
  }

  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-xs font-medium text-ink-muted">Ausências planejadas (férias, licença)</label>
      {absences.length === 0 && (
        <p className="mb-2 rounded-md border border-dashed border-border-default bg-canvas-raised/40 px-3 py-2.5 text-2xs text-ink-faint">
          Nenhuma ausência futura cadastrada — sem isso, a previsão de capacidade só enxerga o passado.
        </p>
      )}
      {absences.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {absences.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border-default bg-canvas-raised px-2.5 py-1.5 text-xs text-ink-muted"
            >
              <span>
                {formatDateBR(a.start_date)}–{formatDateBR(a.end_date)}
                {a.reason ? ` — ${a.reason}` : ""}
              </span>
              <button
                type="button"
                onClick={() => setAbsenceToRemove(a)}
                disabled={removeMutation.isPending}
                aria-label={`Remover ausência de ${formatDateBR(a.start_date)} a ${formatDateBR(a.end_date)}`}
                className="shrink-0 text-denied transition-colors hover:text-denied/70"
              >
                <X size={13} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <TextField label="Início" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <TextField label="Fim" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <TextField label="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={handleAdd}
          disabled={addMutation.isPending || !startDate || !endDate}
        >
          + Adicionar
        </Button>
      </div>

      <ConfirmDialog
        isOpen={!!absenceToRemove}
        title="Remover ausência planejada"
        message={
          absenceToRemove
            ? `A ausência de ${formatDateBR(absenceToRemove.start_date)} a ${formatDateBR(absenceToRemove.end_date)} será removida — a previsão de capacidade volta a considerar esse período como disponível.`
            : ""
        }
        onConfirm={() => absenceToRemove && removeMutation.mutate(absenceToRemove.id)}
        onCancel={() => setAbsenceToRemove(null)}
        isConfirming={removeMutation.isPending}
      />
    </div>
  );
}

interface FormState {
  full_name: string;
  professional_registry: string;
  specialty: string;
  contract_type: "" | ContractType;
  commission_rate: string;
  availability: AvailabilityBlock[];
}

const EMPTY_FORM: FormState = {
  full_name: "",
  professional_registry: "",
  specialty: "",
  contract_type: "",
  commission_rate: "",
  availability: [],
};

function ProfessionalFormModal({
  isOpen,
  onClose,
  editing,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** null = criar; um Professional = editar (formulário pré-preenchido). */
  editing: Professional | null;
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [form, setForm] = useState<FormState>(
    editing
      ? {
          full_name: editing.full_name,
          professional_registry: editing.professional_registry ?? "",
          specialty: editing.specialty ?? "",
          contract_type: editing.contract_type ?? "",
          commission_rate: editing.commission_rate === null ? "" : String(editing.commission_rate),
          availability: editing.availability,
        }
      : EMPTY_FORM
  );
  // Estado à parte de `form` — ausências planejadas são gravadas
  // imediatamente (POST/DELETE próprios), não no submit do formulário
  // inteiro. Ver DECISÃO em PlannedAbsencesEditor acima.
  const [absences, setAbsences] = useState<PlannedAbsence[]>(editing?.planned_absences ?? []);

  const createMutation = useMutation({
    mutationFn: (payload: ProfessionalCreateRequest) => apiClient.post<Professional>("/api/v1/professionals", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professionals"] });
      showSuccess("Profissional cadastrado.");
      onClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: ProfessionalUpdateRequest) =>
      apiClient.patch<Professional>(`/api/v1/professionals/${editing!.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professionals"] });
      showSuccess("Profissional atualizado.");
      onClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const basePayload = {
      full_name: form.full_name,
      professional_registry: form.professional_registry || null,
      specialty: form.specialty || null,
      contract_type: (form.contract_type || null) as ContractType | null,
      commission_rate: form.commission_rate === "" ? null : Number(form.commission_rate),
      availability: form.availability,
    };
    if (editing) {
      updateMutation.mutate(basePayload);
    } else {
      createMutation.mutate(basePayload);
    }
  }

  return (
    <Modal title={editing ? "Editar profissional" : "Novo profissional"} isOpen={isOpen} onClose={onClose} size="2xl">
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <TextField
            label="Nome completo"
            required
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            placeholder="Ex: Dra. Ana Beatriz Prado"
          />
          <TextField
            label="Registro profissional (opcional)"
            value={form.professional_registry}
            onChange={(e) => setForm((f) => ({ ...f, professional_registry: e.target.value }))}
            placeholder="Ex: CRM-12345"
          />
        </div>
        <TextField
          label="Especialidade (opcional)"
          value={form.specialty}
          onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
          placeholder="Ex: Clínico Geral"
        />

        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <SelectField
            label="Tipo de contrato (opcional)"
            value={form.contract_type}
            onChange={(e) => setForm((f) => ({ ...f, contract_type: e.target.value as "" | ContractType }))}
          >
            <option value="">Não informado</option>
            {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Comissão sobre faturamento (%, opcional)"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={form.commission_rate}
            onChange={(e) => setForm((f) => ({ ...f, commission_rate: e.target.value }))}
            placeholder="Ex: 35"
          />
        </div>

        <AvailabilityEditor
          blocks={form.availability}
          onChange={(availability) => setForm((f) => ({ ...f, availability }))}
        />

        {editing && <PlannedAbsencesEditor professionalId={editing.id} absences={absences} onChange={setAbsences} />}

        <div className="mt-5 flex justify-end gap-2 border-t border-border-hairline pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending || !form.full_name.trim()}>
            {isPending ? "Salvando..." : editing ? "Salvar alterações" : "Criar profissional"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ProfessionalsPage() {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [showInactive, setShowInactive] = useState(false);
  const [modalState, setModalState] = useState<{ open: boolean; editing: Professional | null }>({
    open: false,
    editing: null,
  });

  // Deep-link do botão de ação do Radar de Profissional Fora do Padrão
  // (ver DECISÃO em smart_insights_engine.py::_professional_outlier_insight,
  // backend): o insight já chega aqui sabendo QUAL profissional disparou
  // o card — a tela rola até a linha exata e a realça, em vez de deixar
  // o usuário procurar sozinho na lista.
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);

  const { data: professionals, isLoading, error, refetch } = useQuery({
    queryKey: ["professionals", showInactive],
    queryFn: () =>
      apiClient.get<Professional[]>(`/api/v1/professionals?include_inactive=${showInactive}`),
  });

  useEffect(() => {
    if (highlightId && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, professionals]);

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiClient.patch<Professional>(`/api/v1/professionals/${id}`, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["professionals"] }),
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  // Mesmo estado que já vira alerta em Agenda & Capacidade
  // (professionals_without_availability_count) — aqui, onde a grade é de
  // fato cadastrada, um profissional ATIVO sem grade é a ação pendente.
  const hasActiveProfessionalWithoutAvailability = (professionals ?? []).some(
    (p) => p.is_active && p.availability.length === 0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarClock}
        title="Profissionais & grade de agenda"
        subtitle="Especialistas e a grade semanal de disponibilidade de cada um — a base de cálculo de ocupação e ociosidade da agenda."
        action={
          <Button onClick={() => setModalState({ open: true, editing: null })} className="flex items-center gap-1.5">
            <Plus size={14} />
            Novo profissional
          </Button>
        }
      />

      <Panel glow={hasActiveProfessionalWithoutAvailability ? "pending" : "none"}>
        <FilterBar>
          <label className="flex items-center gap-2 pb-1.5 text-xs text-ink-muted">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-3.5 w-3.5 rounded-sm border-border-default accent-accent"
            />
            Mostrar inativos
          </label>
        </FilterBar>
        {isLoading && <LoadingState variant="table" rows={4} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
        {!isLoading && !error && (professionals ?? []).length === 0 && (
          <EmptyState
            icon={<CalendarClock size={17} strokeWidth={1.5} />}
            message="Nenhum profissional cadastrado ainda — clique em “Novo profissional” ou envie um lote de faturamento com o nome do profissional na linha."
          />
        )}
        {!isLoading && (professionals ?? []).length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Registro</th>
                <th className="px-4 py-2.5 font-medium">Especialidade</th>
                <th className="px-4 py-2.5 font-medium">Contrato</th>
                <th className="px-4 py-2.5 font-medium">Grade semanal</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(professionals ?? []).map((p) => (
                <tr
                  key={p.id}
                  ref={p.id === highlightId ? highlightedRowRef : undefined}
                  className={cn(
                    "border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60",
                    p.id === highlightId && "bg-pending-bg ring-1 ring-inset ring-pending"
                  )}
                >
                  <td className="px-4 py-2.5 text-ink">{p.full_name}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{p.professional_registry ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{p.specialty ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-muted">
                    {p.contract_type
                      ? `${CONTRACT_TYPE_LABELS[p.contract_type]}${p.commission_rate !== null ? ` · ${p.commission_rate}%` : ""}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.availability.length === 0 ? (
                      <span className="text-2xs text-pending">Sem grade configurada</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {p.availability.map((block, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full border border-border-default bg-canvas-raised px-2 py-0.5 text-2xs text-ink-muted"
                          >
                            {blockLabel(block)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={p.is_active ? "revenue" : "neutral"}>{p.is_active ? "Ativo" : "Inativo"}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="xs"
                        className="flex items-center gap-1"
                        onClick={() => setModalState({ open: true, editing: p })}
                      >
                        <Pencil size={11} />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={toggleActiveMutation.isPending}
                        onClick={() => toggleActiveMutation.mutate({ id: p.id, is_active: !p.is_active })}
                      >
                        {p.is_active ? "Desativar" : "Reativar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* key força remount ao trocar de alvo de edição (ou abrir "novo" depois
          de editar) — sem isso, o useState interno do modal manteria os
          valores do profissional editado anteriormente (mesmo bug já
          corrigido em ReportRecipientsPage/DenialAppealsPage). */}
      <ProfessionalFormModal
        key={modalState.editing?.id ?? "new"}
        isOpen={modalState.open}
        onClose={() => setModalState({ open: false, editing: null })}
        editing={modalState.editing}
      />
    </div>
  );
}
