import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { Panel, EmptyState, LoadingState, ErrorState } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField, SelectField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiClient, ApiError } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/query-client";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import type { PasswordResetResponse, PlatformUser, UserCreateRequest, UserRole } from "@/lib/types";

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Diretoria (owner)",
  admin: "Administrador",
  financeiro: "Financeiro",
  atendimento: "Atendimento",
  auditor: "Auditor (somente leitura)",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

/** Mostrada uma única vez, logo após criar usuário ou resetar senha —
 * mesma lógica de "não pode ser reexibida depois" do backend
 * (PasswordResetResponse nunca é persistida em texto puro). */
function TemporaryPasswordModal({ password, onClose }: { password: string | null; onClose: () => void }) {
  return (
    <Modal title="Senha temporária gerada" isOpen={password !== null} onClose={onClose}>
      <p className="mb-3 text-sm text-ink-muted">
        Copie e envie ao colaborador por um canal seguro — esta senha não pode ser recuperada novamente depois de fechar esta janela.
      </p>
      <div className="rounded-md border border-border-default bg-canvas-raised px-3 py-2.5 font-mono text-sm text-ink">{password}</div>
      <div className="mt-5 flex justify-end">
        <Button onClick={onClose}>Entendi, já copiei</Button>
      </div>
    </Modal>
  );
}

function CreateUserModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: (temp: string) => void }) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("atendimento");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (payload: UserCreateRequest) => apiClient.post<PlatformUser>("/api/v1/users", payload),
    onSuccess: async (user) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      // A criação não devolve a senha temporária no corpo (contrato de
      // UserResponse) — busca via o mesmo endpoint de reset administrado,
      // que é o único que a expõe (ver app/api/v1/endpoints/users.py).
      const reset = await apiClient.post<PasswordResetResponse>(`/api/v1/users/${user.id}/reset-password`);
      resetAndClose();
      onCreated(reset.temporary_password);
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
    setEmail("");
    setFullName("");
    setRole("atendimento");
    setFieldErrors({});
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    mutation.mutate({ email, full_name: fullName, role });
  }

  return (
    <Modal title="Novo colaborador" isOpen={isOpen} onClose={resetAndClose}>
      <form onSubmit={handleSubmit}>
        <TextField label="Nome completo" required value={fullName} onChange={(e) => setFullName(e.target.value)} error={fieldErrors["full_name"]} />
        <TextField label="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={fieldErrors["email"]} />
        <SelectField label="Papel de acesso" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <p className="-mt-2 mb-4 text-2xs text-ink-faint">
          Uma senha temporária será gerada automaticamente — o colaborador é obrigado a trocá-la no primeiro acesso.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Criando..." : "Criar usuário"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.get<PlatformUser[]>("/api/v1/users"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiClient.patch<PlatformUser>(`/api/v1/users/${id}`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      showSuccess("Usuário atualizado.");
    },
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) => apiClient.post<PasswordResetResponse>(`/api/v1/users/${id}/reset-password`),
    onSuccess: (reset) => setTemporaryPassword(reset.temporary_password),
    onError: (err) => showError(getApiErrorMessage(err)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Gestão de Usuários"
        subtitle="Colaboradores da clínica e seus papéis de acesso (RBAC)."
        action={
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5">
            <Plus size={14} />
            Novo colaborador
          </Button>
        }
      />

      <Panel>
        {isLoading && <LoadingState />}
        {error && <ErrorState message={getApiErrorMessage(error)} />}
        {!isLoading && !error && (users ?? []).length === 0 && <EmptyState icon={<Users size={17} strokeWidth={1.5} />} message="Nenhum usuário cadastrado ainda." />}
        {!isLoading && (users ?? []).length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-hairline text-2xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">E-mail</th>
                <th className="px-4 py-2.5 font-medium">Papel</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Último acesso</th>
                <th className="px-4 py-2.5 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => {
                const isSelf = u.id === currentUser?.sub;
                return (
                  <tr key={u.id} className="border-b border-border-hairline last:border-0 transition-colors hover:bg-canvas-raised/60">
                    <td className="px-4 py-2.5 text-ink">
                      {u.full_name}
                      {isSelf && <span className="ml-1.5 text-2xs text-ink-faint">(você)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{u.email}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{ROLE_LABELS[u.role]}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium ${
                          u.is_active ? "border-revenue/25 bg-revenue-bg text-revenue" : "border-border-default bg-canvas-raised text-ink-faint"
                        }`}
                      >
                        {u.is_active ? "Ativo" : "Inativo"}
                      </span>
                      {u.must_change_password && <span className="ml-1.5 text-2xs text-ink-faint">(troca de senha pendente)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{formatDateTime(u.last_login_at)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          className="!px-2 !py-1 text-2xs"
                          disabled={resetPasswordMutation.isPending}
                          onClick={() => resetPasswordMutation.mutate(u.id)}
                        >
                          Resetar senha
                        </Button>
                        {!isSelf && (
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1 text-2xs"
                            disabled={toggleActiveMutation.isPending}
                            onClick={() => toggleActiveMutation.mutate({ id: u.id, is_active: !u.is_active })}
                          >
                            {u.is_active ? "Desativar" : "Reativar"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <CreateUserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onCreated={setTemporaryPassword} />
      <TemporaryPasswordModal password={temporaryPassword} onClose={() => setTemporaryPassword(null)} />
    </div>
  );
}
