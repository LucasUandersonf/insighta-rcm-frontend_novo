import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/FormField";
import { apiClient, ApiError } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type { ReportRecipient } from "@/lib/types";

// Espelha app/schemas/report_recipient.py — "" (todos os tipos) é o
// valor mais comum; os demais existem para restringir um contato a um
// disparo específico (ex: só o resumo semanal, não alertas pontuais).
const REPORT_TYPE_LABELS: Record<string, string> = {
  weekly_summary: "Resumo semanal (WhatsApp)",
};

function reportTypesLabel(types: string[]): string {
  if (types.length === 0) return "Todos os relatórios";
  return types.map((t) => REPORT_TYPE_LABELS[t] ?? t).join(", ");
}

interface RecipientFormValues {
  name: string;
  phone_whatsapp: string;
  email: string;
  report_types: string[];
}

const EMPTY_FORM: RecipientFormValues = { name: "", phone_whatsapp: "", email: "", report_types: [] };

function RecipientModal({
  isOpen,
  onClose,
  editing,
}: {
  isOpen: boolean;
  onClose: () => void;
  editing: ReportRecipient | null;
}) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [values, setValues] = useState<RecipientFormValues>(
    editing
      ? {
          name: editing.name,
          phone_whatsapp: editing.phone_whatsapp ?? "",
          email: editing.email ?? "",
          report_types: editing.report_types,
        }
      : EMPTY_FORM
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editing
        ? apiClient.patch<ReportRecipient>(`/api/v1/report-recipients/${editing.id}`, payload)
        : apiClient.post<ReportRecipient>("/api/v1/report-recipients", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-recipients"] });
      showSuccess(editing ? "Destinatário atualizado." : "Destinatário cadastrado.");
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
    setValues(EMPTY_FORM);
    setFieldErrors({});
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    mutation.mutate({
      name: values.name,
      phone_whatsapp: values.phone_whatsapp || null,
      email: values.email || null,
      report_types: values.report_types,
    });
  }

  return (
    <Modal title={editing ? "Editar destinatário" : "Novo destinatário"} isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Nome"
          required
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          error={fieldErrors["name"]}
        />
        <TextField
          label="WhatsApp (com DDI/DDD)"
          placeholder="+55 11 91234-5678"
          value={values.phone_whatsapp}
          onChange={(e) => setValues((v) => ({ ...v, phone_whatsapp: e.target.value }))}
          error={fieldErrors["phone_whatsapp"]}
        />
        <TextField
          label="E-mail"
          type="email"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          error={fieldErrors["email"]}
        />
        <p className="-mt-2 mb-4 text-2xs text-ink-faint">Informe pelo menos um canal de contato (WhatsApp ou e-mail).</p>

        <label className="mb-1 block text-xs font-medium text-ink-muted">Relatórios que este contato recebe</label>
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => {
            const checked = values.report_types.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setValues((v) => ({
                    ...v,
                    report_types: checked ? v.report_types.filter((t) => t !== value) : [...v.report_types, value],
                  }))
                }
                className={`rounded-full border px-3 py-1 text-2xs font-medium transition-colors ${
                  checked
                    ? "border-accent bg-accent-bg text-accent"
                    : "border-border text-ink-faint hover:text-ink"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="-mt-2 mb-4 text-2xs text-ink-faint">
          Nenhum selecionado = recebe todos os tipos de relatório disparados para o tenant.
        </p>

        {fieldErrors["__root__"] && <p className="mb-3 text-xs text-denied">{fieldErrors["__root__"]}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar destinatário"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ReportRecipientsPage() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: recipients, isLoading, error, refetch } = useQuery({
    queryKey: ["report-recipients"],
    queryFn: () => apiClient.get<ReportRecipient[]>("/api/v1/report-recipients"),
  });

  const editing = (recipients ?? []).find((r) => r.id === editingId) ?? null;

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient.patch<ReportRecipient>(`/api/v1/report-recipients/${id}`, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-recipients"] });
      showSuccess("Destinatário atualizado.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/report-recipients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-recipients"] });
      showSuccess("Destinatário removido.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Destinatários de Relatórios</h1>
          <p className="text-xs text-ink-faint">
            Quem recebe os disparos automatizados (WhatsApp/e-mail) — cadastre todos os responsáveis para garantir
            que o resumo semanal e os alertas cheguem às pessoas certas, não só a um número fixo.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>+ Novo destinatário</Button>
      </div>

      <Panel>
        {isLoading && <LoadingState variant="table" rows={3} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
        {!isLoading && !error && (recipients ?? []).length === 0 && (
          <EmptyState
            message="Nenhum destinatário cadastrado ainda — os relatórios automatizados não têm para quem ir."
            action={<Button onClick={() => setIsModalOpen(true)}>Cadastrar o primeiro destinatário</Button>}
          />
        )}
        {!isLoading && (recipients ?? []).length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">WhatsApp</th>
                <th className="px-4 py-2 font-medium">E-mail</th>
                <th className="px-4 py-2 font-medium">Recebe</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(recipients ?? []).map((r) => (
                <tr key={r.id} className="border-b border-border-subtle last:border-0 hover:bg-canvas-raised">
                  <td className="px-4 py-2.5 text-ink">{r.name}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{r.phone_whatsapp ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{r.email ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{reportTypesLabel(r.report_types)}</td>
                  <td className="px-4 py-2.5">
                    <span className={r.active ? "text-revenue" : "text-ink-faint"}>{r.active ? "Ativo" : "Inativo"}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2">
                      <Button variant="ghost" className="!px-2 !py-1 text-2xs" onClick={() => setEditingId(r.id)}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        className="!px-2 !py-1 text-2xs"
                        disabled={toggleActiveMutation.isPending}
                        onClick={() => toggleActiveMutation.mutate({ id: r.id, active: !r.active })}
                      >
                        {r.active ? "Desativar" : "Reativar"}
                      </Button>
                      <Button
                        variant="ghost"
                        className="!px-2 !py-1 text-2xs text-denied"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm(`Remover ${r.name} da lista de destinatários?`)) deleteMutation.mutate(r.id);
                        }}
                      >
                        Remover
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
          valores do registro editado anteriormente (mesmo bug já corrigido
          antes em DenialAppealsPage: estado de modal com referência velha). */}
      <RecipientModal
        key={editingId ?? "new"}
        isOpen={isModalOpen || editingId !== null}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
        }}
        editing={editing}
      />
    </div>
  );
}
