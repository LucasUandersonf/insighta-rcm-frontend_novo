import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Plus, ShieldAlert } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { TextField, SelectField } from "@/components/ui/FormField";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import { apiClient, ApiError } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type {
  AppealStatus,
  AppealType,
  DenialAppeal,
  DenialAppealCreateRequest,
  DenialAppealResolveRequest,
  PaginatedResponse,
} from "@/lib/types";

const APPEALS_PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

const APPEAL_TYPE_LABELS: Record<AppealType, string> = {
  tecnica: "Técnica",
  administrativa: "Administrativa",
  medica: "Médica",
};

const STATUS_LABELS: Record<AppealStatus, string> = {
  aberto: "Aberto",
  protocolado: "Protocolado",
  deferido: "Deferido",
  indeferido: "Indeferido",
  nip_aberta: "NIP aberta na ANS",
};

const STATUS_TONE: Record<AppealStatus, BadgeTone> = {
  aberto: "neutral",
  protocolado: "pending",
  deferido: "revenue",
  indeferido: "denied",
  nip_aberta: "denied",
};

const DUE_SOON_HORIZON_DAYS = 5;

function deadlineClass(deadlineAt: string, status: AppealStatus): string {
  if (status !== "aberto" && status !== "protocolado") return "text-ink-muted";
  const daysLeft = Math.floor((new Date(deadlineAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return "font-medium text-denied";
  if (daysLeft <= DUE_SOON_HORIZON_DAYS) return "font-medium text-pending";
  return "text-ink-muted";
}

// ---------------------------------------------------------------------
// Novo recurso
// ---------------------------------------------------------------------

function CreateAppealModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [billingId, setBillingId] = useState("");
  const [appealType, setAppealType] = useState<AppealType>("administrativa");
  const [operatorDenialReason, setOperatorDenialReason] = useState("");
  const [deniedAt, setDeniedAt] = useState("");
  const [deadlineOverride, setDeadlineOverride] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (payload: DenialAppealCreateRequest) => apiClient.post<DenialAppeal>("/api/v1/denial-appeals", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["denial-appeals"] });
      showSuccess("Recurso de glosa aberto com sucesso.");
      resetAndClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.campos) {
        const mapped: Record<string, string> = {};
        for (const c of err.campos) mapped[c.campo] = c.problema;
        setFieldErrors(mapped);
      } else {
        showError(getApiErrorMessage(err));
      }
    },
  });

  function resetAndClose() {
    setBillingId("");
    setAppealType("administrativa");
    setOperatorDenialReason("");
    setDeniedAt("");
    setDeadlineOverride("");
    setFieldErrors({});
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    mutation.mutate({
      billing_id: billingId,
      appeal_type: appealType,
      operator_denial_reason: operatorDenialReason || null,
      denied_at: deniedAt,
      deadline_at: deadlineOverride || null,
    });
  }

  return (
    <Modal title="Abrir recurso de glosa" isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-xs text-ink-faint">
          Para uma negativa FORMAL recebida da operadora (glosa administrativa ou médica) — diferente do alerta de
          risco pré-envio do Painel Anti-Glosa. O ID do faturamento aparece na tela de Faturamento.
        </p>
        <TextField
          label="ID do faturamento"
          placeholder="UUID do billing"
          required
          value={billingId}
          onChange={(e) => setBillingId(e.target.value)}
          error={fieldErrors["billing_id"]}
        />
        <SelectField
          label="Tipo de glosa"
          required
          value={appealType}
          onChange={(e) => setAppealType(e.target.value as AppealType)}
        >
          <option value="administrativa">Administrativa (documental)</option>
          <option value="medica">Médica (negativa de cobertura)</option>
          <option value="tecnica">Técnica (erro de preenchimento pós-envio)</option>
        </SelectField>
        <TextField
          label="Justificativa da operadora"
          value={operatorDenialReason}
          onChange={(e) => setOperatorDenialReason(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Data da negativa"
            type="date"
            required
            value={deniedAt}
            onChange={(e) => setDeniedAt(e.target.value)}
            error={fieldErrors["denied_at"]}
          />
          <TextField
            label="Prazo (opcional)"
            type="date"
            value={deadlineOverride}
            onChange={(e) => setDeadlineOverride(e.target.value)}
            error={fieldErrors["deadline_at"]}
          />
        </div>
        <p className="mb-4 -mt-2 text-2xs text-ink-faint">
          Deixe em branco para calcular automaticamente a partir do prazo cadastrado na operadora do plano (ou do
          padrão geral, se a operadora ainda não tem prazo configurado).
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Abrir recurso"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Registrar decisão (deferido / indeferido / NIP)
// ---------------------------------------------------------------------

function ResolveAppealModal({ appeal, onClose }: { appeal: DenialAppeal | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [resolutionStatus, setResolutionStatus] = useState<"deferido" | "indeferido" | "nip_aberta">("deferido");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: ({ appealId, payload }: { appealId: string; payload: DenialAppealResolveRequest }) =>
      apiClient.post<DenialAppeal>(`/api/v1/denial-appeals/${appealId}/resolve`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["denial-appeals"] });
      showSuccess("Decisão registrada.");
      handleClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleClose() {
    setResolutionStatus("deferido");
    setNotes("");
    onClose();
  }

  if (!appeal) return null;

  return (
    <Modal title="Registrar decisão do recurso" isOpen={Boolean(appeal)} onClose={handleClose}>
      <SelectField
        label="Resultado"
        value={resolutionStatus}
        onChange={(e) => setResolutionStatus(e.target.value as typeof resolutionStatus)}
      >
        <option value="deferido">Deferido (operadora aceitou o recurso)</option>
        <option value="indeferido">Indeferido (operadora manteve a negativa)</option>
        <option value="nip_aberta">Escalar para NIP na ANS</option>
      </SelectField>
      <TextField label="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={handleClose}>
          Cancelar
        </Button>
        <Button
          onClick={() =>
            mutation.mutate({ appealId: appeal.id, payload: { status: resolutionStatus, resolution_notes: notes || null } })
          }
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Salvando..." : "Registrar"}
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Anexos
// ---------------------------------------------------------------------

function AttachmentsModal({ appeal, onClose }: { appeal: DenialAppeal | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: ({ appealId, formData }: { appealId: string; formData: FormData }) =>
      apiClient.upload(`/api/v1/denial-appeals/${appealId}/attachments`, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["denial-appeals"] });
      showSuccess("Anexo enviado.");
      setFile(null);
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  if (!appeal) return null;

  function handleUpload() {
    if (!appeal || !file) return;
    const formData = new FormData();
    formData.append("file", file);
    mutation.mutate({ appealId: appeal.id, formData });
  }

  return (
    <Modal title="Anexos do recurso" isOpen={Boolean(appeal)} onClose={onClose}>
      {appeal.attachments.length === 0 ? (
        <EmptyState icon={<Paperclip size={17} strokeWidth={1.5} />} message="Nenhum anexo enviado ainda." />
      ) : (
        <ul className="mb-4 divide-y divide-border-subtle">
          {appeal.attachments.map((a) => (
            <li key={a.id} className="py-2 text-sm text-ink">
              {a.filename} <span className="text-2xs text-ink-faint">— {formatDate(a.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block flex-1 text-sm text-ink-muted file:mr-3 file:rounded-sm file:border-0 file:bg-canvas-raised file:px-3 file:py-1.5 file:text-xs file:text-ink"
        />
        <Button onClick={handleUpload} disabled={!file || mutation.isPending}>
          {mutation.isPending ? "Enviando..." : "Enviar"}
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------

export function DenialAppealsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [resolvingAppealId, setResolvingAppealId] = useState<string | null>(null);
  const [attachmentsAppealId, setAttachmentsAppealId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [appealsOffset, setAppealsOffset] = useState(0);
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const {
    data: appealsPage,
    isLoading,
    error,
    refetch: refetchAppeals,
  } = useQuery({
    queryKey: ["denial-appeals", statusFilter, appealsOffset],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(APPEALS_PAGE_SIZE), offset: String(appealsOffset) });
      if (statusFilter) params.set("status", statusFilter);
      return apiClient.get<PaginatedResponse<DenialAppeal>>(`/api/v1/denial-appeals?${params.toString()}`);
    },
  });
  const appeals = appealsPage?.items;

  const resolvingAppeal = (appeals ?? []).find((a) => a.id === resolvingAppealId) ?? null;
  const attachmentsAppeal = (appeals ?? []).find((a) => a.id === attachmentsAppealId) ?? null;

  const fileMutation = useMutation({
    mutationFn: (appealId: string) => apiClient.post<DenialAppeal>(`/api/v1/denial-appeals/${appealId}/file`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["denial-appeals"] });
      showSuccess("Recurso marcado como protocolado.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldAlert}
        title="Recurso de glosa"
        subtitle="Negativas formais da operadora (administrativa ou médica) — diferente do Painel Anti-Glosa, que previne erro de preenchimento antes do envio. Aqui é o processo de contestação, com prazo."
        action={
          <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-1.5">
            <Plus size={14} />
            Abrir recurso
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(["", "aberto", "protocolado", "deferido", "indeferido", "nip_aberta"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s);
              setAppealsOffset(0);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-2xs font-medium transition-colors",
              statusFilter === s
                ? "border-accent/30 bg-accent-bg text-accent"
                : "border-border-subtle text-ink-faint hover:border-border hover:text-ink"
            )}
          >
            {s === "" ? "Todos" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <Panel>
        {isLoading && <LoadingState variant="table" rows={4} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetchAppeals()} />}
        {!isLoading && !error && (appeals ?? []).length === 0 && (
          <EmptyState icon={<ShieldAlert size={17} strokeWidth={1.5} />} message="Nenhum recurso de glosa nesta visão." />
        )}
        {!isLoading && (appeals ?? []).length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">Negativa em</th>
                <th className="px-4 py-2.5 font-medium">Prazo</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(appeals ?? []).map((a) => (
                <tr key={a.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                  <td className="px-4 py-2.5 text-ink">{APPEAL_TYPE_LABELS[a.appeal_type]}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{formatDate(a.denied_at)}</td>
                  <td className={`tabular px-4 py-2.5 ${deadlineClass(a.deadline_at, a.status)}`}>
                    {formatDate(a.deadline_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                  </td>
                  <td className="space-x-2 px-4 py-2.5 text-right">
                    {a.status === "aberto" && (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => fileMutation.mutate(a.id)}
                        disabled={fileMutation.isPending}
                      >
                        Protocolar
                      </Button>
                    )}
                    {(a.status === "protocolado" || a.status === "nip_aberta") && (
                      <Button variant="secondary" size="xs" onClick={() => setResolvingAppealId(a.id)}>
                        Registrar decisão
                      </Button>
                    )}
                    <Button variant="ghost" size="xs" onClick={() => setAttachmentsAppealId(a.id)}>
                      Anexos ({a.attachments.length})
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {appealsPage && appealsPage.total > 0 && (
          <Pagination
            total={appealsPage.total}
            limit={APPEALS_PAGE_SIZE}
            offset={appealsOffset}
            onOffsetChange={setAppealsOffset}
          />
        )}
      </Panel>

      <CreateAppealModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      <ResolveAppealModal appeal={resolvingAppeal} onClose={() => setResolvingAppealId(null)} />
      <AttachmentsModal appeal={attachmentsAppeal} onClose={() => setAttachmentsAppealId(null)} />
    </div>
  );
}
