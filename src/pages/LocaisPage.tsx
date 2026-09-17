import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import type { Local, LocalCreateRequest, LocalUpdateRequest } from "@/lib/types";

function CreateLocalModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [nome, setNome] = useState("");

  const mutation = useMutation({
    mutationFn: (payload: LocalCreateRequest) => apiClient.post<Local>("/api/v1/locais", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locais"] });
      showSuccess("Local cadastrado.");
      resetAndClose();
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  function resetAndClose() {
    setNome("");
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    mutation.mutate({ nome: nome.trim() });
  }

  return (
    <Modal title="Novo local de atendimento" isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-xs text-ink-faint">
          Ex.: "Pronto Socorro Adulto", "Recepção Central", "Unidade 2 — Zona Sul". Fica disponível como opção de
          "Local" ao marcar uma consulta.
        </p>
        <TextField label="Nome" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Unidade Centro" />
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending || !nome.trim()}>
            {mutation.isPending ? "Cadastrando..." : "Cadastrar local"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Local de Atendimento (Unidade/Setor) — Fase 4 do plano de adequação
 * ao fluxo real de mercado (Agendamento -> Atendimento -> Faturamento).
 * O backend (POST/GET/PATCH /locais) já existia pronto desde essa fase,
 * mas nenhuma tela consumia — sem cadastro aqui, o seletor de "Local"
 * na Nova Consulta (AppointmentsPage.tsx) nunca teria opção nenhuma
 * pra oferecer.
 */
export function LocaisPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const {
    data: locais,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["locais", showInactive],
    queryFn: () => apiClient.get<Local[]>(`/api/v1/locais?include_inactive=${showInactive}`),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiClient.patch<Local>(`/api/v1/locais/${id}`, { is_active } satisfies LocalUpdateRequest),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["locais"] });
      showSuccess(updated.is_active ? `${updated.nome} reativado.` : `${updated.nome} desativado.`);
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const items = locais ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={MapPin}
        title="Locais de atendimento"
        subtitle="Unidades e setores da clínica (Pronto Socorro, Recepção Central...) — disponíveis como filtro ao marcar uma consulta."
        action={
          <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-1.5">
            <Plus size={14} />
            Novo local
          </Button>
        }
      />

      <label className="flex w-fit items-center gap-2 text-xs text-ink-muted">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          className="accent-[hsl(var(--accent))]"
        />
        Mostrar locais desativados
      </label>

      <Panel>
        {isLoading && <LoadingState variant="table" rows={3} />}
        {error && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}
        {!isLoading && !error && items.length === 0 && (
          <EmptyState icon={<MapPin size={17} strokeWidth={1.5} />} message="Nenhum local cadastrado ainda." />
        )}
        {!isLoading && items.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                  <td className="px-4 py-2.5 text-ink">{l.nome}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={l.is_active ? "neutral" : "denied"}>{l.is_active ? "Ativo" : "Desativado"}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={toggleActiveMutation.isPending}
                      onClick={() => toggleActiveMutation.mutate({ id: l.id, is_active: !l.is_active })}
                    >
                      {l.is_active ? "Desativar" : "Reativar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <CreateLocalModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
}
