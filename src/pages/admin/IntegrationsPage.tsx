import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/FormField";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type { ApiKey, ApiKeyCreated } from "@/lib/types";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

/** A chave em texto puro só aparece nesta janela, uma única vez — mesma
 * lógica de TemporaryPasswordModal em UsersPage.tsx (o backend nunca a
 * persiste em texto puro nem a reexibe depois). */
function CreatedKeyModal({ created, onClose }: { created: ApiKeyCreated | null; onClose: () => void }) {
  return (
    <Modal title="Chave de API criada" isOpen={created !== null} onClose={onClose}>
      <p className="mb-3 text-sm text-ink-muted">
        Copie e configure no ERP do cliente agora — esta chave não pode ser recuperada novamente depois de fechar esta janela.
      </p>
      <div className="break-all rounded-sm border border-border bg-canvas-raised px-3 py-2 font-mono text-sm text-ink">{created?.api_key}</div>
      <div className="mt-5 flex justify-end">
        <Button onClick={onClose}>Entendi, já copiei</Button>
      </div>
    </Modal>
  );
}

function CreateKeyModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: (key: ApiKeyCreated) => void }) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: () => apiClient.post<ApiKeyCreated>("/api/v1/integrations/api-keys", { name }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setName("");
      onClose();
      onCreated(created);
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal title="Nova chave de API" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Nome da chave"
          placeholder="Ex: ERP TotalCare — produção"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Gerando..." : "Gerar chave"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function IntegrationsPage() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);

  const { data: keys, isLoading, error } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => apiClient.get<ApiKey[]>("/api/v1/integrations/api-keys"),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete<ApiKey>(`/api/v1/integrations/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      showSuccess("Chave revogada.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Integrações & Webhooks</h1>
          <p className="text-xs text-ink-faint">
            Chaves de API para o ERP/sistema de gestão do cliente enviar dados automaticamente para esta plataforma.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>+ Nova chave</Button>
      </div>

      <Panel>
        {isLoading && <LoadingState />}
        {error && <ErrorState message={getApiErrorMessage(error)} />}
        {!isLoading && !error && (keys ?? []).length === 0 && (
          <EmptyState message="Nenhuma chave de API gerada ainda. Clique em “Nova chave” para conectar o ERP do cliente." />
        )}
        {!isLoading && (keys ?? []).length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">Prefixo</th>
                <th className="px-4 py-2 font-medium">Criada em</th>
                <th className="px-4 py-2 font-medium">Último uso</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(keys ?? []).map((k) => (
                <tr key={k.id} className="border-b border-border-subtle last:border-0 hover:bg-canvas-raised">
                  <td className="px-4 py-2.5 text-ink">{k.name}</td>
                  <td className="px-4 py-2.5 font-mono text-ink-muted">{k.key_prefix}…</td>
                  <td className="px-4 py-2.5 text-ink-muted">{formatDateTime(k.created_at)}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{formatDateTime(k.last_used_at)}</td>
                  <td className="px-4 py-2.5">
                    <span className={k.revoked_at ? "text-ink-faint" : "text-revenue"}>{k.revoked_at ? "Revogada" : "Ativa"}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    {!k.revoked_at && (
                      <Button
                        variant="ghost"
                        className="!px-2 !py-1 text-2xs"
                        disabled={revokeMutation.isPending}
                        onClick={() => revokeMutation.mutate(k.id)}
                      >
                        Revogar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <CreateKeyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onCreated={setCreatedKey} />
      <CreatedKeyModal created={createdKey} onClose={() => setCreatedKey(null)} />
    </div>
  );
}
